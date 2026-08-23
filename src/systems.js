import * as THREE from 'three';
import { PALETTE, mat, TASKS, tasksInChapter, chapterCount, rand, randInt, clamp, damp, lerp,
         CHAPTERS, chapterOf, chapterDef, RECORDS, grainTick } from './shared.js';

// ---------------------------------------------------------------------------
// AGENT E — SYSTEMS: lighting, follow camera, input, HUD, WebAudio, perf.
// Every top-level name is prefixed `sys` (bundler shares one scope).
// Zero allocations inside update(): all scratch lives here.
// ---------------------------------------------------------------------------

const sysZERO      = new THREE.Vector3(0, 0, 0);
const sysV1        = new THREE.Vector3();
const sysV2        = new THREE.Vector3();
const sysV3        = new THREE.Vector3();
const sysAnchor    = new THREE.Vector3(0, 1, 22);
const sysLook      = new THREE.Vector3(0, 1, 22);
const sysDesired   = new THREE.Vector3();
const sysCamPos    = new THREE.Vector3();   // smoothed camera position, pre-shake
const sysCapyR     = new THREE.Vector3();   // capybara RENDER position (interpolated)
const sysAxDir     = new THREE.Vector3();   // unit vector: target -> light
const sysAxRight   = new THREE.Vector3();
const sysAxUp      = new THREE.Vector3();
const sysLightOff  = new THREE.Vector3();
const sysWorldUp   = new THREE.Vector3(0, 1, 0);
const sysAimA      = new THREE.Vector3();   // hint arrow: capybara, in NDC
const sysAimB      = new THREE.Vector3();   // hint arrow: target, in NDC

// Mid-afternoon sun, high and from the north-west over the harbour...
const sysSUN_DIR      = new THREE.Vector3(-0.62, 0.66, 0.42).normalize();
// ...drifting to golden hour as the list gets ticked: lower, further west, so every
// shadow in the harbour stretches out east and warms up.
const sysSUN_DIR2     = new THREE.Vector3(-0.88, 0.31, 0.25).normalize();
// Pasto is 1.2 degrees north of the equator at 2 527 m. Sydney's 41-degree
// afternoon sun is simply the wrong star for it: measured live, the 20.7 m church
// tower threw a 23 m hard-edged slab clean across the Plaza de Nariño and read as
// a rendering fault rather than as shade. This sun sits at 61 degrees — near-noon
// equatorial — and its azimuth is swung so what shadow the tower does throw runs
// east along the church's own row instead of into the middle of the square.
// Measured: church shadow 23.5 m -> 11.5 m, and it clears the plaza centre.
const sysPASTO_SUN_DIR = new THREE.Vector3(-0.448, 0.875, 0.182).normalize();
const sysSUN_DIST     = 68;
const sysSHADOW_HALF  = 22;      // ~44 unit box
// Tall casters (17 m Opera House sails) project onto the light-space Y axis, so the
// box needs headroom up-light or their shadows clip as the box follows the capybara.
// The golden-hour sun sits far lower, which throws those shadows much further, so the
// headroom is generous enough to survive the whole day arc.
const sysSHADOW_TOP   = sysSHADOW_HALF + 22;
// 2048, which is what the contract has always said. 1536 was a rounding-down
// from a frame budget the game no longer spends: measured 20 Aug 2026, the
// whole render is 0.7 to 1.5 ms of a 16.6 ms frame, and the difference between
// the two is visible on every palm shadow in Palawan.
const sysSHADOW_RES   = 2048;
const sysTEXEL_X      = (sysSHADOW_HALF * 2) / sysSHADOW_RES;
const sysTEXEL_Y      = (sysSHADOW_TOP + sysSHADOW_HALF) / sysSHADOW_RES;
// ...and the box GROWS with altitude. From the condor's talons at 50 m the player
// sees half the valley, but a 44-unit box centred on the animal lights only the
// paddock directly beneath it — everything else in frame would be flat-lit and the
// volcano would read as cardboard. These four track the live box so the texel snap
// in sunFollow stays honest when the box resizes.
let sysShadowHalf = sysSHADOW_HALF;
let sysShadowTop  = sysSHADOW_TOP;
let sysTexelX     = sysTEXEL_X;
let sysTexelY     = sysTEXEL_Y;
const sysSHADOW_HALF_MAX = 64;
const sysSHADOW_ALT_K    = 0.78;   // metres of box per metre of altitude
const sysSHADOW_HYST     = 1.5;    // only refit past this much drift (projection rebuild)

// Goose-game framing: tight, steep, capybara sitting ~40% up from the bottom of
// the frame with the world it is walking into filling the upper two thirds.
const sysCAM_PITCH = 41 * Math.PI / 180;
// AT 41 DEGREES THE SKY IS NOT IN THE PICTURE, AND THAT IS A PROBLEM EXACTLY
// ONCE. The rig sits ~7.4 m above the animal and looks 41 degrees down; the
// vertical half-FOV is 24; so the top edge of the frame points 17 degrees BELOW
// horizontal and meets flat ground 24 m out. Every biome so far has been fine
// with that, because everything worth seeing in them is ON the ground.
//
// Then chapter 7 put its entire payoff a hundred metres up in the air. The
// first build of the aurora was correct, expensive and completely invisible —
// the instrumented shot of the ignition is a photograph of some grass.
//
// So a biome may now ask the rig to look up, 0..1, by publishing skyward(). It
// is a slow blend (three seconds), it never takes the animal out of frame
// (the look-at rises with it), and only Iceland has ever asked.
const sysSKY_PITCH = 11 * Math.PI / 180;
const sysSKY_DIST  = 13;            // and step back, or the nose fills the frame
const sysSKY_RAISE = 2.4;
const sysSKY_LAMBDA = 0.9;
const sysCAM_MIN   = 7;
const sysCAM_MAX   = 16;
const sysCAM_DEF   = 9.5;
// How far back ALONG THE TORII PATH the eye rides. 5.2 m is three gates: near
// enough to keep the animal large, far enough that the gates read as a tunnel.
const sysTORII_BACK = 5.2;
// THE FLOOR UNDER THE LENS, and it is a biome question now.
//
// 1.7 is right for every chapter whose ground is at zero and wrong for the one
// whose ground is at minus eleven: there it is not a floor under the camera, it
// is a ceiling over it, and it pins the lens in the air above a diving animal.
// A biome may publish camFloor(x, z); everybody else gets the constant.
const sysCAM_FLOOR = 1.7;
// Subtle speed dolly — the camera eases out at a run so running reads as fast.
const sysCAM_DOLLY   = 1.2;
const sysRUN_SPEED   = 7.4;   // capybara top ground speed
const sysLOOK_LEAD   = 0.30;  // seconds of velocity to lead the look target by
const sysLOOK_LEADMAX= 2.5;
// Look target sits above the capybara, which pushes it DOWN the frame. Measured from
// live capture: 1.1 put it only ~33% up with dead grass filling the bottom third.
// 0.6 lands it around 43% up, leaving the world it walks into in the upper two thirds.
const sysLOOK_RAISE  = 0.6;
// --- THE CAMERA STEERS ITSELF ----------------------------------------------
// Orbiting by hand (Q/R or a right-drag) while ALSO driving with WASD is two
// jobs, and it is the thing that makes a third-person game feel like work: walk
// north for ten seconds with the rig still pointing east and every key means
// something different from what it looked like it meant. So the rig drifts in
// behind the direction of travel on its own, slowly, and only when the player
// is not steering it: any orbit input hands control straight back for
// sysCAM_HAND_T seconds, and the drift is gentle enough that it never fights a
// deliberate look-around. Below sysCAM_AUTO_V the heading is noise, so it holds.
const sysCAM_AUTO_L  = 1.5;   // lambda of the tidy-up — about 1.5 s to swing 90 deg
const sysCAM_AUTO_V  = 1.8;   // m/s below which the capybara counts as stopped
const sysCAM_IDLE_T  = 1.1;   // seconds stood still before the rig tidies itself
const sysCAM_HAND_T  = 1.6;   // seconds the player keeps the rig after touching it
const sysCAM_KEY_RATE = 2.4;  // rad/s on Q/R — was 1.9, which read as sticky

// --- FLIGHT CAMERA ----------------------------------------------------------
// Hanging off a condor is a different film to waddling round a plaza: the rig
// pulls back and up, flattens its pitch so the horizon opens, and stops orbiting
// on the player's yaw — it leads the direction of travel instead. The two rigs
// cross-fade in ~0.7 s each way (lambda 6.6 ≈ 99% in 0.7 s), so mounting and
// dropping are one continuous move rather than a cut.
const sysFLY_LAMBDA  = 6.6;
const sysFLY_PITCH   = 22 * Math.PI / 180;
const sysFLY_DIST    = 24;
const sysFLY_YAW_L   = 2.4;    // how hard the rig chases the heading — loose, or it whips
const sysFLY_YAW_MIN = 1.0;    // below this airspeed the heading is noise, so hold the last
const sysFLY_LEAD    = 0.55;   // seconds of velocity the look target runs ahead by
const sysFLY_LEADMAX = 9;
const sysFLY_RAISE   = 2.2;
// Never let the eye end up inside Galeras. Sampled against pasto.terrainHeight.
const sysFLY_CLEAR   = 2;

// --- THE LENS BREATHES ------------------------------------------------------
// `camera.fov` was written once, in main.js, and never again — not in one of
// seventeen chapters, not at a waddle and not at forty metres a second behind a
// stooping condor. Field of view is the cheapest speed cue in the medium and
// the only one that works when the ground is a featureless glacier, an ocean or
// the inside of a cloud, which is four of these chapters.
//
// Three terms, summed onto the base, and all three are RENDER ONLY — nothing
// below reads a physics number or writes one:
//
//   speed   widens with how fast the animal is actually going, normalised
//           against whichever rig is live (7.4 m/s is flat out on the ground
//           and utterly sedate on a condor, so one reference would be wrong
//           in one of the two places).
//   kick    a critically-damped spring, hit by the same impacts that shake the
//           rig. A punch out and back over ~0.4 s. This is the one that makes
//           a bin going over feel like it went over.
//   slow    the lens leans IN during a held beat, because that is what a slow
//           motion is for — you are being shown something.
//
// Bounded hard at both ends: a lens that can reach 70 degrees distorts the
// low-poly silhouettes this whole art direction is built on, and one that can
// go under 40 makes the rig feel like it is standing on the animal.
const sysFOV_BASE    = 48;
const sysFOV_MIN     = 41;
const sysFOV_MAX     = 61;
const sysFOV_SPEED   = 7.0;    // degrees added at the reference speed
const sysFOV_REF     = 7.4;    // m/s — the capybara flat out on the ground
const sysFOV_REF_AIR = 26;     // m/s — ...and roughly a condor on a glide
const sysFOV_LAMBDA  = 2.0;    // how lazily the speed term follows. Slow on purpose.
const sysFOV_KICK_K  = 150;    // punch spring, rad^2/s^2
const sysFOV_KICK_C  = 24.5;   // ...critically damped: c ~= 2*sqrt(k)
// Measured, not chosen: at 5.5 the peak of the spring was 1.25 degrees over
// base on a full-magnitude event, which is under the threshold at which anyone
// notices there was a lens at all. 11 puts the peak at about 2.5 degrees —
// roughly a third of what a flat-out run is worth, which is the ratio that
// reads as punctuation rather than as a second speed cue.
const sysFOV_KICK_D  = 11;     // degrees of punch at a full-strength impact
const sysFOV_SLOW    = 5.0;    // degrees the lens leans in at a full slow-motion
const sysFOV_EPS     = 0.03;   // degrees of change worth rebuilding the projection for

// --- THE PUNCH: WHEN THE WORLD IS ALLOWED TO STOP ---------------------------
// A freeze is the loudest thing in the toolbox and it is the one that gets
// abused. The rule here is that it is RARER THAN A SHAKE: shake() fires on any
// prop impact over 4.5 m/s, which in a busy market is several a second, and a
// stutter several times a second is not comedy, it is a bad frame rate.
// So the freeze needs 55% of the shake scale before it engages at all, and even
// at a full-magnitude event it is 55 ms. Measured against the reference: a bin
// going over at 9 m/s asks for shake(0.09), which is 0.26 of the cap — under
// the floor, so it shakes and punches the lens and does NOT stop the world. A
// chapter's marquee (0.14) and a ceremony (0.18) do.
const sysPUNCH_MIN   = 0.55;   // fraction of the shake cap below which nothing freezes
const sysPUNCH_HOLD  = 0.055;  // s of freeze at a full-magnitude event
const sysPUNCH_SCALE = 0.10;   // how close to stopped
// The marquee beat. Long enough to register as deliberate, short enough that
// nobody has time to try to steer out of it. Only `wow` may ask.
const sysWOW_SLOW    = 0.55;
const sysWOW_SLOW_T  = 0.75;

// --- THE PAD ----------------------------------------------------------------
// This game has had two input devices since it was written — a keyboard and a
// touchscreen — and no third. Which is odd, because of the three it is the one
// a cosy third-person comedy is most often actually played on, and because
// every single thing the scheme needs is already here: ONE VOICE on a button,
// a grab, a hop, a run modifier and a camera that wants an analogue orbit far
// more than it wants Z and X.
//
// It is a POLLED device and that is the whole subtlety, because this file's
// edge flags are set at the event source and cleared at the very end of
// update() — and systems runs LAST. A press latched at the top of update()
// would therefore be cleared at the bottom of the same frame and never be seen
// by anybody. So the poll queues its edges and they are published AFTER the
// clear, which costs one frame (16 ms, well under the threshold at which a
// polled pad feels laggy) and is the only correct place for them.
//
// Standard mapping, and deliberately forgiving: two buttons wheek, two run,
// and the d-pad works as well as the stick, because a player who has just
// picked the pad up should not have to be told which one is which.
const sysPAD_DEAD    = 0.22;   // radial deadzone. Rescaled, so response starts at 0.
const sysPAD_RUN     = 0.86;   // stick deflection that counts as a run on its own
const sysPAD_TRIG    = 0.55;   // analogue trigger travel that counts as pressed
const sysPAD_YAW     = 2.6;    // rad/s at full right-stick deflection
const sysPAD_ZOOM    = 7.0;    // m/s of dolly at full right-stick vertical
const sysPAD_LOOKD   = 0.18;   // the right stick's own deadzone — it is a camera, be gentle
const sysPAD_RUMBLE  = 0.10;   // s of buzz at a full-magnitude event
const sysPAD_RUM_MIN = 0.12;   // ...below this magnitude the pad stays still
// Galeras' summit. Doubles as the altimeter's full-scale and the reference for how
// far the fog is pushed back as you climb.
const sysALT_REF     = 62;
// The altimeter BAR runs past the summit on purpose: agent B's thermals will carry
// the condor well above Galeras and a bar that pegs at 100% for the whole back half
// of a climb has stopped being an instrument. Full scale is 110 m, with the summit
// landing at a readable 56%.
const sysALT_FS      = 110;
// Pasto's base fog already reaches 720 m (see sysBIO_FOG_F), so the climb only has
// to open the last of it. 55/170 puts the ceiling at 110/890, inside the 900 m far
// plane with room for the shadow of a rounding error.
const sysALT_FOG_N   = 55;
const sysALT_FOG_F   = 170;
const sysALT_LAMBDA  = 2.2;

// --- THE WAY HOME -----------------------------------------------------------
// Three whistles, stood in the crater. Backslash stays the debug hard-cut.
const sysHOME_WINDOW = 3.5;    // seconds the count survives between whistles
const sysHOME_R2     = 13 * 13;
const sysHOME_STAND  = 3.5;    // must be on your feet, not passing overhead

// --- PUT ME BACK ------------------------------------------------------------
// THE ONE FAILURE THIS GAME HAD NO ANSWER FOR.
//
// Thirteen worlds of hand-authored geometry, a solver, a step-up assist and a
// climb: sooner or later somebody ends up wedged between a stall leg and a
// wall, on a roof with nothing to hop to, or on the wrong side of a canal at a
// third of a gravity. Props have a fall-rescue and the capybara has a
// fell-out-of-the-world floor, but a capybara that is stuck INSIDE the world is
// simply stuck, and the only exit was reloading the page — which, since the
// save keeps the checklist but not where you were standing, costs the walk back
// as well. A three-hour game cannot have a state whose only answer is F5.
//
// So: hold R. It puts the animal back where it was a few seconds ago, on its
// feet, at the last place it was demonstrably able to move. Nothing is undone —
// no task, no record, no clock — because being stuck is not a mistake anybody
// should be charged for.
const sysBACK_HOLD   = 0.55;   // s of held R. Long enough not to be a typo.
const sysBACK_EVERY  = 1.4;    // s between breadcrumbs
const sysBACK_KEEP   = 3;      // how many we hold — the oldest is ~4 s of walking
const sysBACK_SPEED  = 1.2;    // m/s below which "here" is not evidence of anything

// ---- Opera House camera keep-out -------------------------------------------
// This USED to be one fat AABB (x +/-14.5, z -13.5..5.5, y < 17) covering the
// whole podium footprint from the ground up. Measured: walking north across the
// forecourt, or swimming anywhere off the seaward face, put the camera's boom
// inside that box on every frame, the pull-in loop bottomed out, and the
// last-resort fallback parked the eye at y = 20 and left it there. From twenty
// metres up at a 41 degree pitch the capybara is four pixels of brown — which
// is the reported "the capy drifts off the screen". The box was ~4x the volume
// of the actual building: at z = -8 the shells only occupy x 9..12.4, and the
// old test claimed the entire 29 m width.
//
// The shells are a diagonal fan of vaults, so the honest cheap proxy is one
// leaning ELLIPSE per vault rather than one rectangle for the lot. Five numbers:
//   cx, cz, W (chord width), H (apex height), yaw
// straight off the envAddVault() calls in environment.js. The vault leans -z by
// L = H * envSHELL_LEAN, so the footprint centre sits a little north of cz and
// the tallest tip lands at podium deck + 1.58 * H.
const sysOPERA_DECK = 1.20;      // podium deck: nothing below this is a sail
const sysOPERA_VAULTS = [
  //  cx    cz     W     H
   4.8, -1.4, 10.0, 6.6,
   6.6, -4.0,  8.4, 5.4,
   8.4, -6.2,  6.6, 4.2,
   9.7, -8.0,  5.0, 3.1,
  10.7, -9.4,  3.8, 2.2,
  -6.4, -3.2,  7.8, 4.9,
  -8.1, -5.4,  6.3, 3.9,
  -9.6, -7.2,  4.8, 2.9,
 -10.8, -8.6,  3.6, 2.1,
 -10.7,  1.7,  3.4, 1.9,
  -9.8,  0.5,  2.6, 1.4,
];
const sysOPERA_LEAN = 0.46;      // == envSHELL_LEAN
const sysOPERA_MARG = 0.55;      // metres of don't-clip-the-lens forgiveness
// How far above the anchor the last-resort lift is ever allowed to go. The old
// code jumped to a fixed y = 20 regardless of where the capybara was standing.
const sysOPERA_RISE_MAX = 6.5;

// --- THE AUDIO BUS HAS A SPACE IN IT NOW -------------------------------------
// Every one of the ~290 sfx() calls in this game landed MONO on the master
// gain. A bus door popping ninety metres down Nathan Road was exactly as loud,
// and exactly as central, as one at the animal's shoulder. Thirty-odd call
// sites had noticed and hand-rolled a distance curve — `clamp(0.30 - far *
// 0.0026, 0.04, 0.30)` in Rio, `clamp(0.20 - d * 0.0011, 0.03, 0.20)` on the
// Quay, a bare `if (far < 34)` in another — three different laws, none of them
// panned, and the other two hundred and sixty calls had no distance at all.
//
// So there is one law, and a sound may simply say WHERE IT IS:
//
//     game.sfx('thud', { at: prop.body.position })
//     game.sfx('gull', { x: gx, y: gy, z: gz, near: 12 })
//
// and it is attenuated and panned against the listener. A call with no position
// is untouched — mono, full level, exactly as it behaves today — so all 290 of
// them keep working and a biome adopts this one line at a time.
//
// THE LISTENER IS NOT THE CAMERA. The rig sits 9.5 m behind the animal and up
// at 41 degrees, so listening at the lens puts a sound at the capybara's own
// feet nearly ten metres away and a third of the way down the curve. It is not
// the capybara either — pan has to agree with what is on screen, and the
// capybara has no screen orientation. So: the POSITION is a point three
// quarters of the way from the eye to the animal, and the ORIENTATION is the
// camera's. That is the standard third-person answer and it is the only one
// where a thing on the left of the frame is on the left of the mix.
const sysSFX_EAR    = 0.75;   // how far from the eye toward the animal the ear sits
const sysSFX_NEAR   = 6.0;    // m — inside this a sound is at full level
const sysSFX_ROLL   = 0.35;   // inverse-distance rolloff past NEAR. Lower = gentler.
const sysSFX_FAR    = 140;    // m — hard silence, so the far field actually stops
const sysSFX_FADE   = 45;     // m of taper up to FAR, so it stops without a click
const sysSFX_CULL   = 0.012;  // below this the graph is never built at all
const sysSFX_PAN    = 0.82;   // never hard left/right — that reads as a broken mix
const sysSFX_PAN_K  = 1.35;   // widen the middle: 45 degrees off axis is well panned
// Reused by the core event handlers: they run on every prop impact in the game
// and update() may not allocate. `at` is nulled after every use so a stale
// position can never be inherited by the next caller.
const sysSpatial    = { volume: 1, pitch: 1, at: null };
const sysEar        = new THREE.Vector3();
const sysEarRight   = new THREE.Vector3();
const sysEarTo      = new THREE.Vector3();

// --- CAMERA SHAKE -----------------------------------------------------------
// ONE knob for the whole game. 0 disables shake entirely. Shake must be RARE:
// a punctuation mark on a real collision, never a texture of normal play.
const sysSHAKE_SCALE = 0.6;
const sysSHAKE_MAX   = 0.34;   // hard cap on accumulated magnitude
const sysSHAKE_MIN   = 0.02;   // requests below this are ignored outright
const sysSHAKE_DECAY = 9;      // ~0.3 s to inaudible; it must never linger
const sysSHAKE_AMPXZ = 0.70;   // metres at full magnitude
const sysSHAKE_AMPY  = 0.50;
const sysSHAKE_HIT   = 4.5;    // prop impact speed below which nothing shakes
// The look target is NEVER offset — moving it makes the whole world swim.

// --- TIME OF DAY ------------------------------------------------------------
// Driven by completion fraction, heavily damped, so the light never jumps. It
// only ever gets WARMER, never darker: this is a high-key comedy, not dusk.
const sysDAY_LAMBDA  = 0.34;
const sysDAY_SUN_A   = new THREE.Color(PALETTE.sunLight);
const sysDAY_SUN_B   = new THREE.Color(PALETTE.cloth8);     // warm sandy gold
const sysDAY_SKY_A   = new THREE.Color(PALETTE.skyLight);
const sysDAY_SKY_B   = new THREE.Color(PALETTE.towel);      // blush high sky
const sysDAY_GND_A   = new THREE.Color(PALETTE.groundLight);
const sysDAY_GND_B   = new THREE.Color(PALETTE.cloth8);     // warm bounce = warm shade
const sysDAY_FOG_A   = new THREE.Color(PALETTE.fog);
const sysDAY_FOG_B   = new THREE.Color(PALETTE.towel);
const sysColA        = new THREE.Color();
const sysDAY_SUN_MIX = 0.62;   // how far the sun colour is allowed to travel
const sysDAY_SKY_MIX = 0.30;
const sysDAY_GND_MIX = 0.52;
const sysDAY_FOG_MIX = 0.44;
const sysDAY_SUN_I   = [2.30, 2.14];   // never dims meaningfully
const sysDAY_HEMI_I  = [1.35, 1.26];
const sysDAY_AMB_I   = [0.12, 0.16];   // lifted to pay back what the sun loses
const sysDAY_FOG_N   = [90, 78];
const sysDAY_FOG_F   = [230, 208];

// --- BIOME ATMOSPHERE -------------------------------------------------------
// The whole sky/sun/fog rig is a two-axis blend: the time-of-day axis above, and
// this one. Pasto sits 2600 m up in the Andes — cooler, thinner, further-seeing
// light than the sun-bleached harbour. ~1 s to settle (lambda 4.6 ≈ 99% in 1 s).
const sysBIO_LAMBDA  = 4.6;
// Equatorial highland light is not COLD light, it is HARD light: the sun is nearly
// overhead, unfiltered, and the sky bounce off 2 500 m of thin air is far brighter
// than at sea level. The first pass read grey next to Sydney because the sun was
// dimmer AND the hemisphere light was tinted with andesSkyTop — the saturated blue
// meant for the sky dome, not for a light. Pouring that into every up-facing adobe
// wall is exactly what drained the terracotta. The hemisphere now takes the pale
// andesFog instead, and the sun takes Sydney's warmer sunLight blended with the
// Andean cream, so the two biomes read as one game at two times of day.
const sysBIO_SUN_B   = new THREE.Color(PALETTE.andesSun).lerp(new THREE.Color(PALETTE.sunLight), 0.55);
// The Pasto sky is a flat clear colour, not environment.js's top-to-horizon dome,
// so taking it all the way to andesSkyTop puts the dome's most saturated value over
// the whole hemisphere. Landing it partway to andesFog is what a gradient would
// have averaged to, and keeps the sky inside the flat-pastel law.
const sysBIO_BG_B    = new THREE.Color(PALETTE.andesSkyTop).lerp(new THREE.Color(PALETTE.andesFog), 0.45);
const sysBIO_HEMI_B  = new THREE.Color(PALETTE.andesFog);
const sysBIO_FOG_B   = new THREE.Color(PALETTE.andesFog);
const sysBIO_GND_B   = new THREE.Color(PALETTE.paramoSoil);
// Measured against Sydney's flat-ground exposure (~0.95 x albedo): a 61-degree sun
// puts far more light on the ground for the same intensity, so this lands Pasto at
// ~1.10 — a real step brighter, the way noon on the equator should be, with nothing
// in the palette clipping (verified: 0 blown pixels across a full plaza frame).
const sysBIO_SUN_I   = 2.34;
const sysBIO_HEMI_I  = 1.38;
// Ambient is the floor under the shadows. Sydney's 0.12 is right for a compact
// harbour; a plaza under a near-vertical sun with a whole valley bouncing into it
// has a much brighter open shade, and lifting this is half of why the church's
// shadow now reads as shade rather than as a hole cut in the cobbles.
const sysBIO_AMB_I   = 0.30;
// The valley is 260 m across and Galeras' summit is 120 m from the plaza and 210 m
// from the far ridge. 130/320 clamped everything past ~320 m to flat fog colour,
// which is why the landmark the whole biome is built around washed out to white in
// any wide shot. 55/720 keeps a continuous, gentle aerial gradient instead of a
// cliff: measured, the summit sits at ~10% haze from the plaza, the far peaks at
// ~35-45%, so the peak is still hazier than the foreground but reads in full colour.
const sysBIO_FOG_N   = 55;
const sysBIO_FOG_F   = 720;
// The volcano is 62 m tall, so the shadow frustum needs far more depth than a
// flat harbour ever did. Swapped on biome:enter, never per frame.
const sysBIO_SC_NEAR = [30, 62];   // subtracted from sysSUN_DIST
const sysBIO_SC_FAR  = [34, 74];   // added to sysSUN_DIST
// Per-biome shadow softness. Sydney's razor edge is correct for a 17 m sail on a
// hard afternoon; the Pasto plaza is 48 m of pale cobble and any hard edge on it
// reads as a seam. PCFShadowMap does honour shadow.radius (it scales the PCF tap
// offsets), so this is free. normalBias goes up with it because Galeras' flanks are
// enormous low-poly triangles and a wider kernel finds acne on them.
const sysBIO_SH_RAD  = [1.0, 3.2];
const sysBIO_SH_NB   = [0.02, 0.05];
// Sydney is a 140 m harbour seen from 10 m up and 400 was generous. Pasto is 260 m
// of valley seen from the crater rim, so the far plane has to clear the far ridge
// AND the altitude-opened fog (320 + 300 = 620 at the ceiling) with room to spare.
// Chapter 3 is seven hundred metres of open water with a headland at the far
// end of it. Nothing else in the game needs a far plane like this.
// Iceland is a hundred and thirty metres of glacier seen from the bottom of it,
// and the Erg is three hundred metres of nothing with a dune at the end — the
// two longest sight lines on land in the game.
// The Drift is two hundred and fifty metres of cloud seen from seventy-eight
// metres up, and the whole point of the view is that it keeps going.
// It lives in CHAPTERS now, one number per row, next to everything else about
// the place. It was an array indexed by a hand-written biome->index function,
// which is two things to keep in step for no reason at all.

// ===========================================================================
// THE SKY, EVERYWHERE ELSE.
//
// gorBuildSky's header says that every other chapter is looked at from six
// metres up with the ground filling two thirds of the frame, so one flat
// background colour is enough. That was true of the four chapters that existed
// when it was written and it is not true now. A photograph of the Piazzetta
// from the spawn point is one third flat teal; Kyoto from the Gion lane is one
// third flat brown; the Quay apron is one third flat grey-green. A flat
// background is a WALL, and a wall behind a low-poly world reads as an
// unfinished level rather than as air.
//
// So there is a dome, it is biome-neutral, systems.js owns it, and it is a
// SKYBOX rather than a piece of world: it rides on the camera, it neither reads
// nor writes depth, and it is drawn before everything. That is what makes one
// radius correct for a four-hundred-metre far plane in Sydney and a
// two-thousand-two-hundred-metre one over Goreme.
//
// The HORIZON colour is not in this table. It is whatever `scene.background`
// finished the frame as — which means every event that already moves the
// atmosphere (the aurora, the tide, the storm, the Symphony of Lights, going
// under the water in Palawan) moves the sky with it for free, and the fog and
// the sky can never drift out of step. Only the ZENITH is a per-biome number.
//
// Three chapters are absent on purpose: Sydney and the Drift carry their own
// domes (Sydney's has clouds in it, the Drift's has a moon and stars and rides
// with the animal rather than the lens), and Cappadocia's is the sunrise it is
// a chapter about.
// ===========================================================================
// ...and a fourth, for the opposite reason to the other three: chapter 16 has
// no sky at all. It has a ROOF, two hundred metres up, and cave.js draws it —
// a gradient dome over the top of that would be a hole in the mountain.
const sysSKY_OWN = { sydney: 1, drift: 1, goreme: 1, cave: 1 };
const sysSKY_TOP = {
  pasto:   PALETTE.andesSkyTop,
  quay:    PALETTE.skyTop,        // it IS Sydney, an hour later and a mile out
  kyoto:   PALETTE.kyotoSky,
  cali:    PALETTE.caliSky,
  rio:     PALETTE.rioSky,
  iceland: PALETTE.iceSkyNight,
  // NOT sahSkyDay on its own. A pale blue zenith over a sand-coloured horizon
  // passes through grey-green on the way down, and grey-green is the one thing
  // a Marrakech noon is not. Pulled most of the way to the near-white the
  // palette already carries for this exact sky, which is also what a sky with
  // that much dust in it looks like from underneath.
  sahara:  new THREE.Color(PALETTE.sahSkyDay).lerp(new THREE.Color(PALETTE.sahSkyHot), 0.62),
  venice:  PALETTE.venSkyTop,
  kowloon: PALETTE.hkSkyTop,
  palawan: PALETTE.palSkyTop,
  // Four o'clock on an east-facing beach with a westerly behind it: the zenith
  // is a hard deep blue and the horizon it fades to is already going warm,
  // which is the whole reason that light is worth being out in.
  manly:   PALETTE.manSkyTop,
  pantanal: PALETTE.panSkyTop,
  // Antarctica. A pale, HIGH zenith over an almost white horizon: there is
  // no dust and no water vapour in that air, so the gradient is short and
  // the sky is a colour nobody who has not been there believes.
  antarctic: PALETTE.antSkyTop,
};
// ===========================================================================
// THE AIR, AS A TABLE (v14).
//
// Thirteen chapters of atmosphere are thirteen hand-written blocks in the
// middle of update(), each with its own `xxxT`, its own six constants and its
// own rung in atmosPrime. Every one of them is correct and there is nothing
// wrong with any of them — but the fourteenth, fifteenth and sixteenth would
// have been three more, and this codebase has now been bitten four separate
// times by a per-place if-ladder that shipped missing a rung (the beacon's
// ground height, the departures board's digit keys, the spawn point and the
// far plane). A table cannot be missing a rung.
//
// So the new chapters go in here, one row each, driven by one loop. The old
// blocks are left alone — they do things this cannot (an aurora, a tide, a
// sandstorm, a sun coming over a ridge) and rewriting thirteen working
// atmospheres to prove a point is how you break eleven of them. The rule going
// forward: a chapter whose air is a CONSTANT belongs here; a chapter whose air
// is an EVENT keeps its block, and layers it on top of this.
//
//   fogN/fogF   near and far plane of the haze
//   haze/hazeK  the colour the fog goes to, and how far
//   bg/bgK      ...and the clear colour, which is also the sky dome's horizon
//   sun/sunK    the key light's colour, and a multiplier on its intensity
//   hemi/gnd    the sky and ground halves of the hemisphere
//   hemiK/amb   a multiplier on the hemisphere, and an absolute ambient
// ===========================================================================
const sysAIR = {
  // Four o'clock, an onshore haze full of salt, and a great deal of white
  // being thrown back at you. The far plane is long because North Head is two
  // hundred metres away and is supposed to look it.
  manly: {
    fogN: 110, fogF: 1150,
    haze: PALETTE.manHaze, hazeK: 0.84,
    bg: PALETTE.manSkyLow, bgK: 0.74,
    sun: PALETTE.manSun, sunK: 1.10,
    hemi: PALETTE.manSkyTop, gnd: PALETTE.manSand, hemiK: 1.06, amb: 0.30,
  },
  // The end of the wet, an hour before sundown, and the air over a hundred
  // thousand square kilometres of standing water is not clear air. Short fog,
  // warm, and the ground bounce is GREEN — half the light on anything here has
  // come off grass on its way.
  pantanal: {
    fogN: 60, fogF: 760,
    haze: PALETTE.panHaze, hazeK: 0.88,
    bg: PALETTE.panSkyLow, bgK: 0.80,
    sun: PALETTE.panSun, sunK: 1.04,
    hemi: PALETTE.panSkyTop, gnd: PALETTE.panGrass, hemiK: 1.02, amb: 0.32,
  },
  // AND THIS IS THE ROW THE TABLE WAS WORTH WRITING FOR.
  //
  // There is no sun in here. The directional light is turned down to a tenth
  // and left cold, so it does almost nothing but keep a face from being
  // perfectly flat; the hemisphere is nearly off; and the fog closes to a
  // hundred and fifty metres, which is genuinely how far you can see in a
  // passage that size with nothing lighting it. Everything you actually SEE in
  // chapter 16 arrives from cave.js: an echo, a glow-worm, or a hole.
  // AND THE OPPOSITE ROW TO THE ONE BELOW IT. There is no haze down there:
  // the clearest air on earth, and the reason everybody who goes misjudges
  // every distance they look at. So the fog starts a LONG way out and the
  // far plane is the longest in the game. What little there is is white,
  // because the ground bounce off snow is nearly all of the light on
  // anything here — hence the very high hemisphere and a ground half that
  // is brighter than the sky half, which is true in exactly one biome.
  antarctic: {
    fogN: 320, fogF: 1900,
    haze: PALETTE.antHaze, hazeK: 0.72,
    bg: PALETTE.antSkyLow, bgK: 0.80,
    sun: PALETTE.antSun, sunK: 1.06,
    hemi: PALETTE.antSkyTop, gnd: PALETTE.antIceLt, hemiK: 1.24, amb: 0.36,
  },
  cave: {
    fogN: 10, fogF: 165,
    haze: PALETTE.cavHaze, hazeK: 1.0,
    bg: PALETTE.cavSkyTop, bgK: 1.0,
    sun: PALETTE.cavEchoDim, sunK: 0.10,
    hemi: PALETTE.cavSkyLow, gnd: PALETTE.cavRockDk, hemiK: 0.30, amb: 0.24,
  },
};
const sysAIR_KEYS = Object.keys(sysAIR);
const sysAirT = {};
for (let i = 0; i < sysAIR_KEYS.length; i++) sysAirT[sysAIR_KEYS[i]] = 0;

const sysSKY_R      = 200;    // arbitrary: it rides the lens and ignores depth
const sysSKY_LAMBDA2 = 2.2;   // the zenith cross-fades at the fog's own rate
const sysSkyTopC    = new THREE.Color(PALETTE.skyTop);
const sysSkyTopWant = new THREE.Color(PALETTE.skyTop);
let   sysSkyMesh    = null;
let   sysSkyT       = null;   // per-vertex 0 (horizon) .. 1 (zenith)
let   sysSkyCol     = null;
const sysSkyLastA   = new THREE.Color();
const sysSkyLastB   = new THREE.Color();

// ===========================================================================
// THE GRADE — one row per chapter, and the only place a chapter says how it
// wants to be LOOKED at rather than how it wants to be lit.
//
//   bloom      how much of the blurred bright pass is added back
//   threshold  what counts as bright. THIS IS THE WHOLE TRICK: in a night
//              chapter nothing on the ground clears 0.4, so a low threshold
//              blooms the lights and only the lights; in a noon chapter the
//              sunlit whites sit just over 1.0, so a threshold just under it
//              catches glare and nothing else.
//   radius     blur width in quarter-res texels
//   contrast   0 .. 1, blend toward an S-curve of itself
//   saturation 1 = untouched
//   vignette   how far the corners fall, and vigStart where the fall begins
//   tint       a straight multiply, for chapters with a cast
//
// The numbers are deliberately small. A grade you can point at is a grade that
// has gone too far; this one is meant to be invisible until it is switched off.
// ===========================================================================
function sysGrade(bloom, threshold, radius, contrast, saturation, vignette, vigStart, tr, tg, tb) {
  return { bloom: bloom, threshold: threshold, knee: 0.38, radius: radius,
           contrast: contrast, saturation: saturation,
           vignette: vignette, vigStart: vigStart,
           tintR: tr, tintG: tg, tintB: tb, liftR: 0, liftG: 0, liftB: 0 };
}
const sysGRADES = {
  //                      bloom  thr   rad  cont  sat   vig   vigS  tint
  sydney:  sysGrade(0.20, 1.00, 1.00, 0.10, 1.05, 0.14, 0.66, 1.000, 1.000, 0.995),
  // Thin cold air at 2 527 m: more contrast, more colour, and the corners come
  // down harder because half of what is worth looking at is a volcano dead ahead.
  pasto:   sysGrade(0.22, 1.02, 1.05, 0.16, 1.09, 0.17, 0.62, 0.998, 1.000, 1.004),
  // Seven hundred metres of open water throwing the sun back at you.
  quay:    sysGrade(0.34, 0.96, 1.15, 0.12, 1.04, 0.13, 0.66, 1.000, 1.000, 1.000),
  // Soft, wooded, overcast-ish. The one chapter that wants LESS of everything.
  kyoto:   sysGrade(0.16, 1.02, 1.00, 0.07, 0.99, 0.15, 0.64, 1.000, 1.000, 0.998),
  cali:    sysGrade(0.24, 0.98, 1.05, 0.13, 1.07, 0.16, 0.63, 1.006, 1.000, 0.992),
  // Bright, hard, saturated. Rio is the loudest daylight in the game.
  rio:     sysGrade(0.30, 0.97, 1.10, 0.17, 1.12, 0.15, 0.65, 1.004, 1.000, 0.996),
  // Half past eleven at night. Nothing on the ground is bright, so everything
  // that IS bright is a light, and it is allowed to behave like one.
  iceland: sysGrade(0.62, 0.40, 1.30, 0.18, 1.08, 0.32, 0.48, 0.994, 1.000, 1.010),
  // Noon on a square with no shade in it. Warm cast, glare, open sky.
  sahara:  sysGrade(0.38, 0.99, 1.20, 0.14, 1.06, 0.12, 0.68, 1.010, 1.000, 0.984),
  // A violet night with no floor. The vignette is doing narrative work here.
  drift:   sysGrade(0.58, 0.44, 1.35, 0.15, 1.02, 0.34, 0.46, 1.000, 0.998, 1.008),
  // A wet gold afternoon that ends underwater.
  // A CHAPTER BUILT OUT OF WHITE STONE CANNOT HAVE A LOW THRESHOLD. At 0.94 the
  // Piazzetta itself cleared it and the whole square bloomed into one sheet of
  // paper; the glare here belongs to the WATER, which is brighter still.
  venice:  sysGrade(0.26, 1.06, 1.15, 0.12, 1.05, 0.18, 0.62, 1.012, 1.002, 0.986),
  // THE ONE THIS WHOLE PASS WAS BUILT FOR. A chapter whose entire subject is
  // light gets the lowest threshold, the widest blur and the most of it.
  kowloon: sysGrade(0.88, 0.32, 1.45, 0.20, 1.14, 0.36, 0.44, 1.000, 0.998, 1.006),
  // Bleached. High threshold, because in Palawan everything is nearly white and
  // a lower one would fog the entire beach.
  palawan: sysGrade(0.30, 1.04, 1.15, 0.11, 1.04, 0.13, 0.66, 1.000, 1.000, 1.002),
  // Twenty minutes before sunrise, and then the ridge lets go.
  goreme:  sysGrade(0.55, 0.46, 1.30, 0.16, 1.06, 0.26, 0.52, 1.008, 1.000, 0.994),
  // Manly. THE THRESHOLD IS THE ARGUMENT, exactly as it was in Venice and for
  // the opposite reason: the brightest thing in this chapter is foam, foam is
  // very nearly white, and it is supposed to glare. So the threshold sits just
  // under the sunlit whites (which catches the break and the spray and nothing
  // else on the beach) and the bloom is high — a late westerly through salt
  // haze is the single most blown-out light in this game.
  manly:   sysGrade(0.42, 0.90, 1.20, 0.15, 1.08, 0.14, 0.64, 1.004, 1.000, 0.996),
  // The Pantanal. Green, and there is a great deal of it. The saturation goes
  // UP because the whole chapter is two colours and the interesting things in
  // it are small and saturated; the threshold is high because water this
  // brown never gets near it and nothing here should bloom but the sun.
  pantanal: sysGrade(0.26, 1.02, 1.10, 0.13, 1.12, 0.19, 0.60, 1.006, 1.002, 0.986),
  // Sơn Đoòng. The lowest threshold in the game by a distance — lower than
  // Mong Kok, which held the record — because in here NOTHING is bright except
  // the four things that make their own light, and every one of them should
  // spill. The vignette is doing narrative work: it is the dark, and it is
  // supposed to be closing in.
  // THE BLOOM CANNOT BE THAT HIGH ON POINTS. The bright pass runs at quarter
  // resolution, and a glow-worm is one pixel: at 0.95 with a 1.5 radius every
  // cluster of them grew a visible SQUARE GRID of quarter-res texels across
  // the dark. Two thirds of the bloom and a threshold that only the four light
  // sources clear keeps the spill and loses the lattice.
  cave:    sysGrade(0.62, 0.26, 1.35, 0.22, 1.02, 0.46, 0.34, 0.992, 1.000, 1.010),
  // Antarctica, and it is the Venice problem in its purest form: a chapter
  // built entirely out of white things cannot have a low threshold or the
  // whole world blooms into one sheet of paper. So the threshold is the
  // highest in the game — only the sun off open water clears it — the
  // saturation comes DOWN, because there are three colours here and turning
  // them up makes a postcard of a place that is not one, and the tint goes
  // very slightly blue, which is what snow in shadow actually does.
  antarctic: sysGrade(0.34, 1.10, 1.20, 0.16, 0.94, 0.16, 0.64, 0.994, 1.000, 1.012),
};
const sysGRADE_LAMBDA = 2.2;
const sysGradeCur = sysGrade(0.20, 1.00, 1.00, 0.10, 1.05, 0.20, 0.58, 1, 1, 1);
let   sysGradeWant = sysGRADES.sydney;

// ===========================================================================
// THE FILL — one dim directional light from the anti-sun side.
//
// The hemisphere light fills from ABOVE, which is right for the top of things
// and does almost nothing for a wall: a vertical face gets a 50/50 blend of sky
// and ground and lands in the middle of the palette no matter which way it
// points. That is why a capybara standing on grass in Sydney and a capybara
// standing on sand in Palawan both read as one brown lump — the shaded side of
// the animal is the same value as the ground behind it.
//
// A second directional light, horizontal, opposite the sun, dim enough not to
// be readable as a light, puts a different value on every face that the sun
// cannot reach. It costs one more term in a Lambert loop and it is the cheapest
// silhouette separation available.
//
// It takes its colour and its level FROM THE HEMISPHERE, so every biome, every
// event and every time of day already tuned in atmosApply carries it along
// without a table: it is bounce light, and bounce light is the sky.
// ===========================================================================
const sysFILL_K   = 0.30;                 // of the hemisphere's own level
const sysFillDir  = new THREE.Vector3();
const sysFILL_LIFT = 0.16;                // how far off horizontal the fill sits
// Read once. Everything decorative that loops forever checks this — the minimap
// sweep already did, and now the glitter on eight seas does too.
const sysCalmMotion = !!(typeof window !== 'undefined' && window.matchMedia &&
                         window.matchMedia('(prefers-reduced-motion: reduce)').matches);
// The night sky over the Erg, for the dome. The lighting block already has
// its own colours; this is the one the ZENITH goes to as the dusk runs.
const sysSAH_NIGHT_C = new THREE.Color(PALETTE.sahSkyNight);
const sysPAN_DUSK_C = new THREE.Color(PALETTE.panSkyDusk);
// Iterated instead of for..in: a for..in over an object literal allocates a
// key array every frame, and this runs in update().
const sysGRADE_KEYS = ['bloom', 'threshold', 'knee', 'radius', 'contrast',
                       'saturation', 'vignette', 'vigStart',
                       'tintR', 'tintG', 'tintB', 'liftR', 'liftG', 'liftB'];

function sysCamFarFor(name) {
  const d = chapterDef(chapterOf(name));
  return (d && d.far) || 400;
}
/**
 * The api of whatever biome is actually live, or null.
 *
 * The same rule capybara.js's capyWater() follows, and for the same reason: every
 * biome stays resident when it is detached and will happily keep answering
 * questions about a place the player left ten minutes ago. Anything that asks a
 * biome for an opinion asks through here.
 */
function sysLiveBiomeApi(game) {
  const b = game.biome;
  if (!b) return null;
  const n = b.current;
  return n === 'sydney' ? game.env : game[n] || null;
}

// --- the harbour, under way -------------------------------------------------
// The rig steps back and flattens out: at a walk the camera is 9.5 m behind at
// 41 degrees, which frames a capybara. A twelve-metre boat doing eleven metres a
// second needs to be seen from further off and lower down, or the whole voyage
// happens inside the bottom third of the screen.
const sysSAIL_DIST  = 21;
const sysSAIL_PITCH = 27 * Math.PI / 180;
const sysSAIL_RAISE = 2.6;    // look-at rises above the deck
const sysSAIL_LAMBDA = 1.3;   // the blend in and out — slow, so it reads as a lift
const sysSAIL_YAW_L = 2.2;    // how hard the rig chases the ship's heading
// The harbour opens the fog right out: this is the one place you can see a mile.
const sysSEA_FOG_N  = 240;
const sysSEA_FOG_F  = 1250;
// Kyoto goes the other way. A wooded valley in soft haze wants the fog CLOSE —
// close enough that the far end of the torii tunnel is a suggestion — and the
// light cool and flat, so the two saturated things in the biome (the gates and
// the maples) carry the whole picture on their own.
const sysKYO_FOG_N  = 46;
const sysKYO_FOG_F  = 330;
// Cali is a wide flat valley at 1000 m, three degrees off the equator: you can
// see the Farallones from the middle of town, and the haze that softens them is
// WARM. Every other biome fogs toward a blue-grey; this one fogs toward sand.
const sysCALI_FOG_N = 120;
const sysCALI_FOG_F = 800;
// ---- and Cali after the chiva has been up the hill -------------------------
// The second night in the game, and it is NOT Iceland's. Iceland is clean polar
// air and no lamps: the fog does nothing and the sky is the only source, so the
// ambient goes up to keep the shade from being a hole. Cali is a bowl with two
// and a half million people at the bottom of it, so the night here is the
// opposite — WARM, LOW-CONTRAST AND LIT FROM UNDERNEATH. The city bounces off
// the cloud, the haze is what carries that glow, and the hemisphere's GROUND
// colour (which is normally bounce off soil) is doing the work of a hundred
// thousand sodium lamps.
//
// The fog also pulls IN rather than out, unlike every other night treatment
// here: you cannot see the Farallones at night, and the far city lights have to
// sit under the haze or the horizon becomes a hard grid of white dots.
const sysCALI_N_FOG_N = 46;
const sysCALI_N_FOG_F = 430;
const sysCALI_N_SUN_I = 0.16;   // multiplier: what is left of the sun is a moon
const sysCALI_N_HEMI_I = 0.62;
const sysCALI_N_AMB_I = 0.42;   // absolute, and high — nowhere in this city is dark
const sysCALI_N_SUN_C = new THREE.Color(PALETTE.caliMoonC);
const sysCALI_N_HEMI_C = new THREE.Color(PALETTE.caliNightSky);
const sysCALI_N_GND_C = new THREE.Color(PALETTE.caliNightLow);
const sysCALI_N_BG_C = new THREE.Color(PALETTE.caliNightSky).lerp(new THREE.Color(PALETTE.caliNightLow), 0.34);
const sysCALI_N_HAZE_C = new THREE.Color(PALETTE.caliNightLow);
// Rio is the one place in the game where the haze goes BLUE again, and hard.
// Cali's valley air is warm and sandy; Rio's is sea air over a bay, so the
// granite goes progressively bluer with distance and Corcovado reads as a
// silhouette rather than as a hill you could walk to. Far, but not Kyoto-close
// and not harbour-open: you can see across the bay and no further.
const sysRIO_FOG_N = 150;
const sysRIO_FOG_F = 900;
// Iceland at night. Clean polar air with nothing burning in it for a thousand
// miles, so the fog is thin and reaches a very long way — the whole point of
// standing in the geothermal field is that you can see the glacier from it.
// What makes it read as NIGHT is not the fog, it is the three light multipliers
// below: this is the only biome in the game where the sun is turned down.
// PUSHED A LONG WAY BACK, ON PURPOSE. Polar air has nothing in it, and more
// to the point the glacier is a hundred and thirty metres of the picture: at
// 80/620 the top of the tongue washed to flat fog colour, merged with the sky,
// and the seracs standing on it read as blocks FLOATING IN MIDAIR. The two
// biggest things in this biome are both a long way off and both have to hold
// their colour.
const sysICE_FOG_N = 130;
const sysICE_FOG_F = 940;
// IT IS THE BLUE HOUR, NOT MIDNIGHT, AND THAT IS A GAMEPLAY DECISION AS MUCH
// AS AN AESTHETIC ONE.
//
// The first cut was an honest midnight — sun x0.42, hemisphere x0.46, ambient
// 0.40 — and the instrumented shot of the old harbour is a brown capybara on a
// black rectangle. You could not see the pier you were standing on. A game
// whose whole vocabulary is silhouette-on-flat-colour cannot be played in the
// dark, and dimming everything until it FEELS like night just deletes the world.
//
// September at 64 degrees north also does not do midnight for another month:
// it does two hours of blue twilight where the sun is a few degrees under and
// the whole sky is the light source. That is what this is. The sun is weak and
// very warm (it is coming through a lot of atmosphere), the hemisphere is
// strong and deeply blue and does most of the work, and the ambient floor is
// high because there is snow and water in every direction bouncing it back.
//
// It reads unmistakably as night — nothing else in this game is blue — and you
// can see where you are going.
const sysICE_SUN_I = 0.60;      // multiplier on whatever the day/biome axes said
const sysICE_HEMI_I = 0.88;
const sysICE_AMB_I = 0.56;      // absolute, blended in
const sysICE_SUN_C = new THREE.Color(PALETTE.iceSun);
const sysICE_HEMI_C = new THREE.Color(PALETTE.iceSkyLow);
const sysICE_GND_C = new THREE.Color(PALETTE.iceMoraine);
const sysICE_BG_C = new THREE.Color(PALETTE.iceSkyLow).lerp(new THREE.Color(PALETTE.iceSkyNight), 0.45);
// Marrakech at noon. The hardest light in the game by a distance: the sun is
// nearly overhead, there is no water in the air, and the sky is so bright it is
// almost colourless. The haze is dust rather than moisture, so it is WARM and it
// starts close — you can see the dune from the gate, and not much past it.
// ---- THE DRIFT ------------------------------------------------------------
// The second night in the game and it is lit on completely different principles
// from the first. Iceland is a blue TWILIGHT — a bright sky doing all the work,
// so you can still read a silhouette against the ground. Up here there is no
// ground to read anything against, and the light has to come from four small
// warm things and a moon, so:
//
//  - the ambient floor is the HIGHEST in the game (0.62) and it is violet, not
//    grey. Every other night trick assumes bounce off snow or off a street; a
//    capybara in mid-air over two hundred metres of nothing has nothing under
//    it to bounce anything, so if the ambient does not carry the animal then
//    nothing does, and the whole chapter is a silhouette you cannot aim.
//  - the sun is a MOON: weak, cold, and pointed almost horizontally, so the
//    islands get a rim rather than a top-light and read as slabs with edges.
//  - the fog is thin and it is the same violet as the sky, so distant islands
//    fade out rather than sitting on a wall — depth is the only spatial cue
//    this biome has and the fog is where most of it comes from.
const sysDRI_FOG_N = 44;
const sysDRI_FOG_F = 560;
const sysDRI_SUN_I = 0.46;
const sysDRI_HEMI_I = 1.05;
const sysDRI_AMB_I = 0.62;
const sysDRI_SUN_C = new THREE.Color(PALETTE.driMoon);
const sysDRI_HEMI_C = new THREE.Color(PALETTE.driVoidLow);
const sysDRI_GND_C = new THREE.Color(PALETTE.driCloudDeep);
const sysDRI_BG_C = new THREE.Color(PALETTE.driVoid).lerp(new THREE.Color(PALETTE.driVoidLow), 0.5);
const sysDRI_HAZE_C = new THREE.Color(PALETTE.driHaze);
const sysDRI_WARM_C = new THREE.Color(PALETTE.driLamp);

// ---- VENICE: a wet gold afternoon, and then a mirror -------------------
// The lagoon light is famous for one reason: everything in it is lit TWICE,
// once by the sun and once by the water, and the second one comes from below.
// So the ground bounce is turned right up and given a colour (pale green, off
// the canals) rather than the usual brown, and the sun is dropped and warmed.
// When the square floods that goes further still — the whole city is standing
// on a mirror, so the ambient rises with the tide instead of falling.
const sysVEN_FOG_N = 48;
const sysVEN_FOG_F = 360;
const sysVEN_SUN_I = 0.86;
const sysVEN_HEMI_I = 1.15;
const sysVEN_AMB_I = 0.40;
const sysVEN_SUN_C = new THREE.Color(PALETTE.venSkyLow);
const sysVEN_HEMI_C = new THREE.Color(PALETTE.venSkyTop);
const sysVEN_GND_C = new THREE.Color(PALETTE.venCanalPale);
const sysVEN_BG_C = new THREE.Color(PALETTE.venSkyTop).lerp(new THREE.Color(PALETTE.venSkyLow), 0.45);
const sysVEN_HAZE_C = new THREE.Color(PALETTE.venFog);

// ---- HONG KONG: no daylight at all ------------------------------------
// The second night in the game, and the opposite kind of night from Iceland.
// There the darkness is empty and the ambient has to be raised because there
// are no lamps; here there are four hundred lamps and the darkness is only in
// the gaps between them, so the ambient goes DOWN and the fog goes warm and
// close. The sky is never black over a city — it is orange-brown, because the
// city is shining on the bottom of the clouds, and that is what sysHK_BG_C is.
const sysHK_FOG_N = 34;
const sysHK_FOG_F = 420;
// Higher than Iceland's night, not lower, and that is the point: a street
// under four hundred signs is not dark, it is BOUNCED — every wall in it is
// being lit by the shop opposite. What makes it night is that the SUN is
// almost off and everything saturated is emitting rather than reflecting.
const sysHK_SUN_I = 0.42;
const sysHK_HEMI_I = 0.95;
const sysHK_AMB_I = 0.55;
const sysHK_SUN_C = new THREE.Color(PALETTE.hkNeonGold);
const sysHK_HEMI_C = new THREE.Color(PALETTE.hkSkyLow);
const sysHK_GND_C = new THREE.Color(PALETTE.hkWet);
const sysHK_BG_C = new THREE.Color(PALETTE.hkSkyTop).lerp(new THREE.Color(PALETTE.hkSkyLow), 0.42);
const sysHK_HAZE_C = new THREE.Color(PALETTE.hkFog);
const sysHK_SHOW_C = new THREE.Color(PALETTE.hkNeonCyan);

// ---- PALAWAN: the first chapter with two skies in it ---------------------
// One above the water and one below it, and the second one is the reason this
// block is twice the size of everybody else's. Above: a bleached tropical noon
// with the haze pushed a long way out, because the whole point of standing on
// that beach is being able to see the island. Below: near-total loss of the
// warm end within about eight metres, the fog brought in to twenty, and the
// ambient RAISED — light underwater arrives from every direction at once,
// which is exactly why a reef photographs flat and why raising the ambient is
// the honest thing rather than a cheat.
const sysPAL_FOG_N = 90;
const sysPAL_FOG_F = 700;
const sysPAL_SUN_I = 1.16;
const sysPAL_HEMI_I = 1.10;
const sysPAL_AMB_I = 0.40;
const sysPAL_SUN_C = new THREE.Color(PALETTE.palSkyLow);
const sysPAL_HEMI_C = new THREE.Color(PALETTE.palSkyTop);
const sysPAL_GND_C = new THREE.Color(PALETTE.palShallow);
const sysPAL_BG_C = new THREE.Color(PALETTE.palSkyTop).lerp(new THREE.Color(PALETTE.palSkyLow), 0.40);
const sysPAL_HAZE_C = new THREE.Color(PALETTE.palFog);
// and the second sky
const sysPAL_SUB_FOG_N = 4;
const sysPAL_SUB_FOG_F = 62;
const sysPAL_SUB_C = new THREE.Color(PALETTE.palFogUnder);
const sysPAL_SUB_DEEP = new THREE.Color(PALETTE.palAbyss);
const sysPAL_BLOOM_C = new THREE.Color(PALETTE.palBloom);

// ---- CAPPADOCIA: five in the morning, and then the sun ---------------------
// The only sunRISE in the game — Iceland's night never ends and Marrakech's
// dusk only falls. It is built the opposite way round from every other block
// here: the constants are the DAWN, the cold end, and the sun coming over the
// ridge is applied on top of them by gorSun. Which means the chapter looks
// like this for most of its length and like something else for forty seconds,
// and the forty seconds is the marquee.
const sysGOR_FOG_N = 70;
const sysGOR_FOG_F = 1400;      // you can see a hundred and fifty balloons
const sysGOR_SUN_I = 0.62;      // before the sun, and it goes to 1.30 after
const sysGOR_HEMI_I = 1.05;
const sysGOR_AMB_I = 0.44;
const sysGOR_SUN_C = new THREE.Color(PALETTE.gorSkyLow);
const sysGOR_HEMI_C = new THREE.Color(PALETTE.gorSkyTop);
const sysGOR_GND_C = new THREE.Color(PALETTE.gorTuffShadow);
const sysGOR_BG_C = new THREE.Color(PALETTE.gorSkyTop).lerp(new THREE.Color(PALETTE.gorSkyHigh), 0.45);
const sysGOR_HAZE_C = new THREE.Color(PALETTE.gorShadowFog);
const sysGOR_DAY_C = new THREE.Color(PALETTE.gorSun);
const sysGOR_DAY_BG = new THREE.Color(PALETTE.gorSkyLow);
const sysGOR_DAY_HAZE = new THREE.Color(PALETTE.gorFog);

const sysSAH_FOG_N = 110;
const sysSAH_FOG_F = 860;
const sysSAH_SUN_I = 1.22;
const sysSAH_AMB_I = 0.34;      // sand bounces a colossal amount back up
const sysSAH_SUN_C = new THREE.Color(PALETTE.sahSun);
const sysSAH_HEMI_C = new THREE.Color(PALETTE.sahSkyHot);
const sysSAH_GND_C = new THREE.Color(PALETTE.sahSand);
// and the storm, which is the same landscape airborne
const sysSTORM_FOG_N = 6;
const sysSTORM_FOG_F = 62;
const sysSTORM_C = new THREE.Color(PALETTE.sahStorm);
const sysSTORM_DEEP = new THREE.Color(PALETTE.sahStormDeep);
// the evening it leaves behind
const sysDUSK_SUN_C = new THREE.Color(PALETTE.sahEmber);
const sysDUSK_SKY_C = new THREE.Color(PALETTE.sahSkyNight);
const sysAURORA_C = new THREE.Color(PALETTE.iceAurora2);
const sysColB        = new THREE.Color();

// --- TASK HINTS -------------------------------------------------------------
// A checklist that names a thing but not a place is a scavenger hunt. Every task
// resolves, live, to a point in the world; the top row of the paper then carries
// a bearing arrow and a distance, and a soft beacon stands on the spot itself so
// the last few metres are obvious without reading anything at all.
//
// The resolvers are deliberately DYNAMIC — "the nearest tourist still wearing a
// hat" moves, gets robbed, and stops being an answer — so they are re-run on a
// timer rather than cached. A resolver returning null means "no target": either
// the task is done here (press a key) or the thing has not spawned yet, and the
// arrow simply hides rather than lying.
const sysHINT_TICK  = 0.25;   // s between resolves — nothing here is per-frame
const sysHINT_NEAR  = 4.5;    // m inside which the arrow stops (you are there)
const sysHINT_BEACON_MIN = 6; // m before the world beacon fades up
const sysHINT_RISE  = 6;      // m of height difference before the readout says so
const sysHINT_Y     = 1.5;    // m the beacon stands above its ground point

// --- THE TO-DO LIST ---------------------------------------------------------
// How many OPEN tasks are on the paper at once. Four, plus the one you have just
// ticked while it is being struck through, so the card never exceeds five rows
// and never needs to scroll.
const sysTODO_WINDOW = 4;
const sysTODO_LINGER = 1700;   // ms a ticked row stays before it rolls up
const sysTODO_ROLL   = 520;    // ms of the roll-up itself (matches .capyui-fold)
// Two ticks inside this window read as a combo and the flourish climbs a tone.
const sysTASK_STREAK = 6.0;    // seconds

// ---------------------------------------------------------------------------
// THE JOURNEY — save, records, and the departures board.
//
// Five things were wrong with an eight-chapter game that were not wrong with a
// two-chapter one, and all five of them are about the SHAPE of the whole thing
// rather than about any minute of it:
//
//  1. THE COMMUTE. The way out of every foreign chapter put you back in Sydney,
//     and the only way abroad was: find the ferry, stow away, find the wheel,
//     sail seven hundred metres to Manly, walk up the Corso, three whistles.
//     That is a chapter the first time and a toll booth the sixth, and with
//     eight chapters it was going to be paid SEVEN times. The exit now offers
//     the whole world instead of one fixed destination.
//  2. NOTHING SURVIVED A RELOAD. Seventy-four tasks is well over two hours.
//     A session is twenty minutes. Those two numbers cannot both be true unless
//     the game can be put down, and it could not.
//  3. FINISHING A PLACE FELT LIKE NOTHING. The eighth tick in Kyoto looked
//     exactly like the third, and then the list quietly changed country.
//  4. NOTHING WAS WORTH DOING TWICE. Every task is a switch. The best twenty
//     seconds in the game — a glacier at eighteen metres a second — had no way
//     of being better than the last time you did it.
//  5. YOU COULD NOT SEE THE WHOLE THING. A rolling window of four rows is the
//     right HUD and a terrible map. There was no artefact anywhere that said
//     "this is a journey, here is how far along it you are".
//
// One save file, one records table, one card. See sysJournal below.
// ---------------------------------------------------------------------------
const sysSAVE_KEY = 'capy3.journey.v1';
const sysSAVE_DEBOUNCE = 700;      // ms — a streak of ticks writes once

// --- BIOME TRANSITION -------------------------------------------------------
const sysFADE_OUT   = 820;   // ms of white coming up  (CSS transition is .8s)
const sysFADE_HOLD  = 460;   // ms of held white — the swap happens in here
const sysFADE_CARD  = 3600;  // ms the place card stays up
const sysMINI_SWELL = 0.55;  // how far a `mini` lifts the score. Half, near enough:
                             // the figure is the same and in the same key, so the
                             // only thing separating it from the banner's is size
const sysMOMENT_CARD = 2600; // ms the mini-moment card stays up — longer than a
                             // toast (2200) and shorter than the banner, which is
                             // the whole hierarchy in one number

// --- AMBIENT MUSIC ----------------------------------------------------------
// D lydian / major-pentatonic colour: sunny harbour afternoon, faintly wistful.
// Each chord is a set of MIDI notes; voices pick the nearest tone (voice leading).
const sysMUS_CHORDS = [
  [50, 54, 57, 61, 64],   // Dmaj9
  [47, 50, 54, 57, 64],   // Bm11
  [43, 47, 50, 54, 61],   // Gmaj7#11
  [45, 49, 52, 54, 59],   // A6/9
  [42, 45, 49, 52, 56],   // F#m9 (G# keeps the lydian tint)
];
const sysMUS_ROOTS = [38, 35, 31, 33, 30];
// Weighted-ish wander instead of a fixed loop, so it never cycles audibly.
const sysMUS_NEXT = [[1, 2, 3], [2, 3, 0], [3, 4, 1], [4, 0, 2], [0, 1, 3]];
// Circular Quay — up a fourth into A lydian: brighter, higher, and it
// moves twice as often, because the quay never shuts up. A lydian shares six of its
// seven notes with the chapter-1 D lydian, which is what makes the crossfade legal
// rather than merely quick: the two palettes can overlap for six seconds and only
// one scale degree ever disagrees.
const sysMUS_CHORDS2 = [
  [45, 49, 52, 56, 59],   // Amaj9
  [47, 51, 54, 58, 61],   // Bmaj9  (the lydian D#)
  [49, 52, 56, 59, 63],   // C#m11
  [52, 56, 59, 61, 66],   // E6/9
  [54, 57, 61, 64, 68],   // F#m9
];
const sysMUS_ROOTS2 = [33, 35, 37, 40, 42];
const sysMUS_NEXT2  = [[1, 2, 3], [2, 3, 4], [3, 4, 0], [4, 0, 1], [0, 1, 2]];
// Chapter 2 — Pasto, Nariño. The harbour score is a pad; this one is a BAND.
//
// Pasto sits in the Colombian Andes an hour from the Ecuadorian border, and the
// music of that specific corner is not generic "world ambient" — it is bambuco
// and sanjuanito: 6/8, a charango filling the off-beats, a bombo on the two
// dotted-quarters, and a quena carrying the tune over the top. Three things make
// it read as that rather than as a pastel drone with panpipes bolted on:
//
//   1. A LANDS ON MINOR AND STAYS THERE. Chapter 1 is D lydian — bright, major,
//      no leading tone. This is A natural minor with the flat-VII cadence
//      (i - VII - VI) the whole Andean repertoire runs on. Not the relative
//      minor of anything: it is a different key with a different function.
//   2. THE MELODY IS PENTATONIC. A quena is a notched end-blown flute with six
//      holes, and the tunes written for it live in A-C-D-E-G. The chord voicings
//      below are built so that any tone the melody scheduler picks is in it.
//   3. IT HAS A PULSE. See sysMUS_RHY: the pad drops to a bed and the rhythm
//      section carries the piece, which is the actual difference between "cold
//      mountain" and "a town square at altitude".
const sysMUS_CHORDS3 = [
  [45, 48, 52, 55, 59],   // Am9    — i
  [43, 47, 50, 55, 59],   // G      — VII
  [41, 45, 48, 53, 57],   // F      — VI
  [40, 43, 47, 52, 55],   // Em     — v (minor, never E major: no leading tone)
  [38, 41, 45, 50, 53],   // Dm     — iv
];
const sysMUS_ROOTS3 = [33, 31, 29, 28, 26];
// i - VII - VI is the cadence; everything else is a way back round to it.
const sysMUS_NEXT3  = [[1, 1, 4], [2, 2, 0], [3, 0, 1], [0, 0, 4], [0, 1, 0]];
// --- the rhythm section -----------------------------------------------------
// 6/8 at a dotted-quarter of ~108. `t` is in eighths from the top of the bar.
// The bombo takes the two dotted-quarters (1 and 4); the charango takes the
// off-eighths, which is the lilt — a charango on the beats would be a strummed
// guitar in 3/4 and the whole thing would read as a waltz.
const sysMUS_EIGHTH = 0.185;
const sysMUS_BAR    = 6;
const sysMUS_RHY = [
  { t: 0, k: 1, v: 1.00 },   // bombo, downbeat
  { t: 0, k: 0, v: 0.85 },   // charango, with it
  { t: 2, k: 0, v: 0.50 },
  { t: 3, k: 1, v: 0.52 },   // bombo, the second dotted-quarter — lighter
  { t: 3, k: 0, v: 0.78 },
  { t: 4, k: 0, v: 0.42 },
  { t: 5, k: 0, v: 0.62 },   // the pick-up into the next bar
];
// A charango is a tiny ten-string lute: high, jangly, courses tuned in octaves.
// Below G4 it stops sounding like one, so every strum tone is folded into here.
const sysMUS_CHG_LO = 64, sysMUS_CHG_HI = 79;
// The quena's comfortable register. Its lowest note is around G4; the tunes sit
// an octave above the charango so the two never fight for the same air.
const sysMUS_QNA_LO = 72, sysMUS_QNA_HI = 88;
// Bars are scheduled much closer in than chords are: a chapter change cannot
// cancel an AudioNode that has already been start()ed, so a 2 s rhythm lookahead
// would keep a bombo playing over the harbour for two seconds after the swap.
const sysMUS_RHY_LOOK = 0.7;
const sysMUS_CENTRE = [52, 59, 64, 69];
const sysMUS_LEVEL  = [0.15, 0.115, 0.095, 0.07];
const sysMUS_TYPE   = ['sawtooth', 'sawtooth', 'triangle', 'triangle'];
const sysMUS_SPREAD = [-7, 0, 6];      // cents per oscillator in a bank
const sysMUS_XFADE  = 4.0;             // seconds — long enough to hide the change
const sysMUS_XFADE2 = 6.5;             // chapter change: reads as a drift, not a cut
const sysMUS_LOOK   = 2.0;             // scheduler lookahead, seconds
const sysMUS_TICK   = 240;             // scheduler period, ms
const sysMUS_BUS    = 0.17;            // music sits UNDER the sfx
// Everything that differs between chapters lives here, so the scheduler itself is
// chapter-agnostic and a switch is a pointer swap, never a restart. Indexed by
// chapter - 1, so entry 0 is Sydney (which now includes Circular Quay) and entry
// 1 is Pasto. `lead` names the melody voice; `rhythm` is optional and only Pasto
// has one, so nothing about the harbour's score changed.
// Chapter 3, under way — E LYDIAN, and the only palette in the game written to
// be euphoric rather than merely pleasant. Three things do it, and none of them
// is "louder":
//   1. EVERY CHORD IS MAJOR AND EVERY CHORD HAS A NINTH ON TOP. No minor sixth,
//      no dominant seventh, nothing that wants to resolve downward. The pad has
//      nowhere to fall, which is what open water sounds like.
//   2. THE ROOT WALKS UP. I -> V -> vi -> IV is the oldest lift in pop music;
//      taken slowly, with the bass in the cellar and the pad two octaves clear
//      of it, it reads as horizon rather than as chorus.
//   3. THE FILTER IS OPEN. cut 1150 against the harbour's 620: the same voices,
//      four times the air. This is the one place in the game the score is
//      allowed to be the loudest thing, and even here it only just is.
// It stays an AMBIENCE — no drums, no arrival, nothing that would make a
// seventy-second passage feel like a level.
const sysMUS_CHORDS4 = [
  [40, 44, 47, 54, 59],   // Emaj9      — I
  [42, 46, 49, 56, 61],   // F#(add9)   — II, the lydian brightener
  [47, 51, 54, 61, 66],   // Bmaj9      — V
  [49, 52, 56, 63, 66],   // C#m9       — vi
  [45, 49, 52, 59, 63],   // Amaj7#11   — IV
];
const sysMUS_ROOTS4 = [28, 30, 35, 37, 33];
const sysMUS_NEXT4  = [[2, 2, 4], [0, 2, 0], [3, 3, 4], [4, 4, 0], [0, 0, 2]];
// Chapter 4 — Kyoto & Uji. D hirajoshi: D, E, F, A, B-flat. It is a genuinely
// different KIND of scale from anything else here — two semitone steps inside a
// pentatonic frame — and that pair of half-steps is the whole sound. Rules that
// keep it from becoming a postcard:
//   1. NO THIRD IN THE BASS. Every voicing is stacked in fourths and fifths, so
//      nothing is major or minor; it is simply open, which is how a koto tuned
//      to this scale actually sits under a hand.
//   2. THE HALF-STEPS ARE THE MELODY. E->F and A->B-flat are the only leading
//      motion in the mode, so the pad voice-leads across them and the plucks
//      land on them, and everything else stays put.
//   3. ALMOST NOTHING HAPPENS. Chords are held three times as long as Sydney's.
//      The loudest thing in this biome should be a capybara.
const sysMUS_CHORDS5 = [
  [38, 45, 50, 53, 57],   // D  — D A D F A
  [41, 45, 48, 53, 57],   // F  — F A C F A  (the C is the koto's open string)
  [33, 40, 45, 48, 52],   // A  — A E A C E
  [34, 41, 46, 50, 53],   // Bb — Bb F Bb D F
  [40, 45, 47, 52, 57],   // E  — E A B E A  (sus, never resolved)
];
const sysMUS_ROOTS5 = [26, 29, 21, 22, 28];
// D is home; the half-step pairs (F->E, Bb->A) are the only cadences it has.
const sysMUS_NEXT5  = [[1, 2, 3], [4, 0, 2], [0, 3, 0], [2, 2, 0], [0, 0, 1]];
// ===========================================================================
// Chapter 5 — CALI. This is a BAND, and it is the only music in the game that
// the player is asked to move in time with, so it has to be right rather than
// evocative.
//
// Cali is the salsa capital of the world and salsa caleña is FAST — the local
// footwork runs ahead of Cuban or New York timing. 100 bpm, so a beat is 0.6 s
// and an eighth is 0.3 s.
//
// Four things make this salsa rather than "latin-flavoured":
//
//  1. THE CLAVE IS THE BAR LINE. Son clave 2-3, five strokes across TWO bars:
//     eighths 2 and 4 of the first bar, 8, 11 and 14 of the second. Everything
//     else in the arrangement is placed relative to it, which is what the word
//     "clave" means. Written out as absolute eighths over the two-bar cycle so
//     there is no chance of the two halves being swapped, which is the one
//     mistake that makes a salsa arrangement sound wrong to everybody in Cali
//     and to nobody else.
//  2. THE BASS DOES NOT PLAY ON ONE. The tumbao plays the bombo — the "and" of
//     two — and beat four, and the four ANTICIPATES the next chord. A bass note
//     on the downbeat is the single clearest tell of a fake salsa bassline.
//  3. THE PIANO PLAYS A GUAJEO, NOT CHORDS. A montuno is an ostinato of
//     syncopated octaves that outlines the harmony; the accents fall on the
//     off-eighths, so the piano and the bass interlock instead of doubling.
//  4. THE HARMONY IS A VAMP. i - iv - V7 - i in A minor, two bars a chord,
//     round and round. Salsa is not a chord progression you follow, it is a
//     groove you stand inside, which is exactly what a game biome wants.
const sysMUS_CHORDS6 = [
  [45, 48, 52, 55, 60],   // Am7  — i      A C E G
  [50, 53, 57, 60, 65],   // Dm7  — iv     D F A C
  [52, 56, 59, 62, 68],   // E7   — V7     E G# B D   (the G# is the only accidental)
  [45, 48, 52, 55, 60],   // Am7  — i
];
const sysMUS_ROOTS6 = [33, 38, 40, 33];
const sysMUS_NEXT6  = [[1], [2], [3], [0]];        // a vamp, not a wander
const sysMUS_SALSA_EIGHTH = 0.30;                  // 100 bpm
const sysMUS_SALSA_BAR = 8;                        // eighths in a 4/4 bar
// son clave 2-3, in eighths across the two-bar cycle
const sysMUS_CLAVE = [2, 4, 8, 11, 14];
// tumbao bass, per bar: the bombo (and of 2) and beat 4. `a` marks the note
// that anticipates the NEXT chord.
const sysMUS_TUMBAO = [{ t: 3, v: 0.95, a: false }, { t: 6, v: 1.0, a: true }];
// the guajeo. `d` indexes the chord tone; the accents are all off-eighths.
const sysMUS_MONTUNO = [
  { t: 1, d: 2, v: 0.85 }, { t: 3, d: 0, v: 1.0 }, { t: 4, d: 1, v: 0.7 },
  { t: 6, d: 2, v: 0.95 }, { t: 7, d: 1, v: 0.6 },
];
// congas: 0 = heel (quiet, low), 1 = slap (bright), 2 = open tone
const sysMUS_CONGA = [
  { t: 0, k: 0, v: 0.45 }, { t: 2, k: 0, v: 0.40 }, { t: 4, k: 1, v: 0.85 },
  { t: 6, k: 2, v: 1.0 }, { t: 7, k: 2, v: 0.8 },
];
// ===========================================================================
// Chapter 6 — RIO. The second band in the game, and the second score a player
// is asked to move in time with, so like Cali's it has to be right rather than
// evocative. It is also the reason chapter 6 is not chapter 5 in a hat.
//
// Salsa is in 4/4 and its skeleton is the clave, a two-bar figure. Samba is in
// 2/4 and its skeleton is ONE STROKE: the surdo de marcacao on the second beat.
// Everything a bateria does hangs off that stroke. Get it wrong and no amount
// of correct tamborim will save the arrangement.
//
// Four things make this samba rather than "carnival-flavoured":
//
//  1. THE SURDO IS ON THE TWO, and it is the loudest thing in the mix by a
//     distance. The first beat gets a muffled stroke (the hand stays on the
//     head); the second gets an open one that rings. That alternation IS samba
//     — it is why a bateria sounds like it is walking.
//  2. 2/4, NOT 4/4. A bar is eight sixteenths and lasts under a second at 132.
//     Writing samba in 4/4 halves the rate the surdo comes round at and the
//     groove immediately reads as a march.
//  3. THE CAIXA NEVER STOPS. Continuous sixteenths with accents — it is the
//     hiss underneath everything, and silence in the caixa is what a break is.
//  4. THE TAMBORIM IS SYNCOPATED ACROSS THE BAR LINE. The teleco-teco is a
//     two-bar figure that deliberately does not line up with the surdo, which
//     is where the lift comes from.
//
// Harmony is a choro/samba turnaround — Am7 D7 Gmaj7 E7, round and round. Like
// Cali's vamp it is somewhere to stand rather than something to follow.
const sysMUS_CHORDS7 = [
  [45, 48, 52, 55, 59],   // Am7    A C E G (B)
  [50, 54, 57, 60, 64],   // D7     D F# A C (E)
  [43, 47, 50, 54, 57],   // Gmaj7  G B D F# (A)
  [44, 47, 50, 52, 56],   // E7     G# B D E G#
];
const sysMUS_ROOTS7 = [33, 38, 43, 40];            // A D G E
const sysMUS_NEXT7  = [[1], [2], [3], [0]];        // a turnaround, not a wander
const sysMUS_SAMBA_16 = 0.11364;                   // 132 bpm: a sixteenth
const sysMUS_SAMBA_BAR = 8;                        // sixteenths in a 2/4 bar
// THE SURDO. k: 0 = muffled (hand stays on the head), 1 = open (it rings).
// Sixteenth 0 is beat one, sixteenth 4 is beat two. This one table is the
// chapter: rio.js scores the player against exactly this stroke.
const sysMUS_SURDO = [{ t: 0, k: 0, v: 0.62 }, { t: 4, k: 1, v: 1.0 }];
// the caixa, every sixteenth, accented
const sysMUS_CAIXA = [0.88, 0.34, 0.52, 0.40, 0.78, 0.34, 0.58, 0.46];
// teleco-teco: a two-bar tamborim figure, deliberately across the surdo
const sysMUS_TAMB = [[0, 3, 4, 6], [1, 3, 4, 7]];
// agogo, the two-bell pattern. h: 0 = low bell, 1 = high.
const sysMUS_AGOGO = [
  { t: 0, h: 0, v: 0.80 }, { t: 2, h: 1, v: 0.60 }, { t: 3, h: 1, v: 0.50 },
  { t: 4, h: 0, v: 0.80 }, { t: 6, h: 1, v: 0.62 }, { t: 7, h: 1, v: 0.48 },
];
// the bass walks with the surdo, not against it: its loud note is the two.
// `a` marks the note that anticipates the next chord.
const sysMUS_SAMBA_BASS = [
  { t: 0, v: 0.62, a: false }, { t: 4, v: 1.0, a: false }, { t: 7, v: 0.55, a: true },
];
// cavaquinho: the little four-string that plays the chordal rhythm, all of it
// on the off-sixteenths so it interlocks with the surdo instead of doubling it
const sysMUS_CAVACO = [{ t: 1, v: 0.70 }, { t: 3, v: 0.92 }, { t: 5, v: 0.58 }, { t: 6, v: 0.85 }];
// ===========================================================================
// Chapter 7 — ICELAND. D DORIAN, and the mode is the whole point.
//
// Seven palettes in, this game had two lydians, two natural minors, a hirajoshi
// and two Latin vamps, and none of them could do the thing Iceland needs, which
// is to be COLD WITHOUT BEING SAD. That is a specific and slightly unusual
// colour and there is exactly one mode that has it: dorian, a minor scale with
// a MAJOR sixth. The sixth is the whole trick — B natural over a D minor triad
// is bright and open and refuses to resolve downward, so the harmony sits in a
// minor key and never once feels sorry for itself.
//
// Three rules keep it from becoming ambient wallpaper:
//
//  1. THE MAJOR IV IS THE CADENCE. In D dorian the fourth is G MAJOR, and
//     i - IV - i is the only progression in here that does any work. Every
//     other chord is a way back round to it. (In natural minor that chord is
//     G minor and the entire character disappears; if the pad ever sounds like
//     Pasto, the B has gone flat.)
//  2. THE CHORDS ARE HELD FOR A QUARTER OF A MINUTE. Only Kyoto is slower, and
//     Kyoto is a garden. This is a hundred and thirty metres of ice at night.
//  3. THE LEAD IS BOWED, NOT PLUCKED. Everything else in this game is struck
//     or plucked and therefore decays; a bowed string is the only voice here
//     that can start after it has already begun, which is what a landscape
//     with no edges sounds like.
//
// And then the CHOIR, which is the chapter. It is a real set of pad voices —
// so it voice-leads with everything else — routed through two formant filters
// instead of the main low-pass, and its gain is driven by exactly one number:
// game.iceland.aurora(). Sit in the hot spring for seven seconds and the sky
// lights and the score grows a choir, over nine seconds, and nothing "starts".
const sysMUS_CHORDS8 = [
  [38, 41, 45, 48, 52],   // Dm9    — i      D F A C E
  [43, 47, 50, 55, 57],   // G      — IV     G B D G A   (the dorian sixth)
  [48, 52, 55, 59, 62],   // Cmaj9  — bVII   C E G B D
  [45, 48, 52, 55, 59],   // Am7    — v      A C E G B
  [41, 45, 48, 52, 55],   // Fmaj7  — bIII   F A C E G
];
const sysMUS_ROOTS8 = [26, 31, 36, 33, 29];
// i - IV - i, and everything else is a way back to it.
const sysMUS_NEXT8  = [[1, 1, 4], [0, 0, 2], [3, 0, 4], [0, 1, 0], [0, 0, 1]];
const sysMUS_CHOIR_C = [52, 59, 64, 71];       // the four parts
const sysMUS_CHOIR_L = [0.055, 0.048, 0.044, 0.030];
// "ah": the two formants that make a bank of sawtooths read as a human throat
// rather than as a synth pad. Move F1 up and F2 down and it becomes "oh".
const sysMUS_FORMANT = [730, 1090, 2440];

// ===========================================================================
// Chapter 8 — MARRAKECH. GNAWA, and it is the third band in the game and the
// least like a band.
//
// Salsa is a clave and a montuno; samba is a surdo and a caixa; both are large
// ensembles playing an arrangement. Gnawa is three things — a guembri, a pile
// of iron qraqeb, and a drum — playing the SAME twelve-pulse cell for as long
// as it takes, which in a real lila is most of a night. It is trance music with
// a job of work to do, and it is arranged that way here:
//
//  1. TWELVE PULSES, NOT EIGHT. The cell is 12/8: four dotted beats of three,
//     and the guembri crosses them three-against-two, which is where the whole
//     rolling motion comes from. Written in 4/4 it would be a shuffle and the
//     cross-rhythm would vanish.
//  2. THERE IS NO CHORD PROGRESSION. There is a tonic, and once in a while it
//     goes to the fourth and comes straight back. The interest lives entirely
//     in a bass ostinato, which is why the guembri is mixed loudest.
//  3. THE QRAQEB NEVER STOP. Iron castanets, on every pulse, and they are the
//     bed the other two stand on. Silence in the qraqeb means something has
//     gone wrong — which is exactly what the sandstorm does to this
//     arrangement, and why the storm sounds the way it does.
//
// Two live inputs, both from sahara.js: musGnawaStrip (the storm takes
// everything but the iron) and musGnawaBuild (the fire circle doubles it and
// brings hands in). Neither is a stinger; both are targets that glide.
const sysMUS_CHORDS9 = [
  [40, 47, 52, 55, 59],   // E    the drone: E B E G B
  [45, 52, 57, 60, 64],   // A    the one place it ever goes
];
const sysMUS_ROOTS9 = [28, 33];
const sysMUS_NEXT9  = [[0, 0, 0, 0, 1], [0]];
// ===========================================================================
// Chapter 9 — THE DRIFT. STACKED FOURTHS, and that is the whole idea.
//
// Every other palette in this game is built on thirds, which is what gives a
// chord a major or a minor quality and therefore a WEIGHT — a place it wants to
// go. A quartal voicing has no third in it at all. It is neither, it does not
// lean, and it does not resolve, and after eight chapters of harmony with its
// feet on the floor that is exactly what a chapter with no floor should sound
// like. Nothing here is a cadence; the four voicings simply wander between one
// another and the next-table has no home row.
//
// Three consequences, all deliberate:
//  1. THE CHORDS ARE HELD LONGER THAN ANYWHERE ELSE — fifteen to twenty-six
//     seconds, past even Kyoto's garden. There is no event in this biome that
//     needs punctuating and the wind's own breath is thirty-eight seconds, so
//     the score should be slower than the weather, not faster.
//  2. THE FILTER IS WIDE OPEN (1250, against Iceland's 470 and Kyoto's 520).
//     This is the brightest palette in the game and it should be: the other
//     night in this game is a dark landscape, and this one is a black sky full
//     of small bright things.
//  3. THE LEAD IS RUBBED, NOT STRUCK. See musGlass.
const sysMUS_CHORDS10 = [
  [57, 62, 64, 69, 71],   // A  D  E  A  B     — fourths on A
  [59, 64, 66, 71, 73],   // B  E  F# B  C#
  [64, 69, 71, 76, 78],   // E  A  B  E  F#
  [54, 59, 61, 66, 68],   // F# B  C# F# G#
];
const sysMUS_ROOTS10 = [33, 35, 28, 30];
// No home row: every voicing leads to two others and none of them is 'back'.
const sysMUS_NEXT10  = [[1, 2, 2], [2, 3, 0], [3, 0, 1], [0, 2, 1]];

// ===========================================================================
// Chapter 10 — VENICE. The only score in this game with FUNCTIONAL HARMONY in
// it, and that is deliberately the whole idea.
//
// Ten palettes: a modal pad, an Andean band, a lydian ambience, a hirajoshi
// koto, a salsa vamp, a samba vamp, a bowed drone, a gnawa drone and a set of
// quartal voicings that resolve to nothing at all. Not one of them CADENCES.
// They are all grooves or weather — you stand inside them and they do not go
// anywhere, which is exactly right for a place you are wandering around in.
//
// Venice is the one place in this game whose own art form is the opposite of
// that. Baroque music is a machine for going somewhere: a chord is a chord
// because of the chord before it, the bass walks, the sequence falls by fifths,
// and it ARRIVES. So:
//
//  1. THE ROOT FALLS BY A FIFTH, EVERY BAR. i – iv – VII – III – VI – ii – V – i
//     is the descending-fifths sequence, which is roughly forty percent of
//     everything Vivaldi ever wrote, and taken at one chord to the bar it is
//     the most forward-leaning thing that has ever been in this soundtrack.
//  2. THERE IS A REAL DOMINANT. The A7 and the D7 are the only chords in the
//     whole game with a leading note in them, and the D7 -> Gm at the end of
//     the cycle is the only V–i in it. After ten chapters of harmony that
//     refuses to resolve, one that does is genuinely startling.
//  3. IT IS PLAYED BY A CONTINUO, NOT BY A PAD. A cello walking in quavers and
//     a harpsichord filling the off-beats: the bass line is the melody's equal
//     partner rather than a cushion under it, which is what "basso continuo"
//     means and what makes this sound like a room in 1730 rather than like a
//     synthesiser playing minor chords.
//
// One live input, `musVenTide`, from venice.js: as the water comes up the
// harpsichord thins out and an organ pedal comes in underneath. It is not a
// stinger — it is a target that glides — and it means the player can HEAR the
// tide from inside a lane where they cannot see the square.
const sysMUS_CHORDS11 = [
  [55, 58, 62, 67, 70],   // Gm   — i
  [48, 51, 55, 60, 63],   // Cm   — iv
  [53, 57, 60, 65, 69],   // F    — VII
  [46, 50, 53, 58, 62],   // Bb   — III
  [51, 55, 58, 63, 67],   // Eb   — VI
  [45, 49, 52, 55, 61],   // A7   — V/v, and the first leading note in the game
  [50, 54, 57, 60, 62],   // D7   — V
];
const sysMUS_ROOTS11 = [31, 36, 29, 34, 27, 33, 26];
// The circle, with one place it may go round again rather than resolve — a
// sequence that ALWAYS cadences on schedule stops being a sequence and starts
// being a hymn.
const sysMUS_NEXT11 = [[1], [2], [3], [4], [5, 5, 0], [6], [0, 0, 1]];
const sysMUS_BAR_Q  = 0.3125;          // a quaver at 96 bpm
const sysMUS_BAR_QN = 8;               // quavers in a 4/4 bar — one chord a bar
// the cello. Crotchets, walking through the chord: root, fifth, third, fifth.
// `d` indexes the chord tone, and it is the LINE that matters, not the notes.
const sysMUS_CONTINUO = [
  { t: 0, d: 0, v: 1.00 }, { t: 2, d: 2, v: 0.78 },
  { t: 4, d: 1, v: 0.88 }, { t: 6, d: 2, v: 0.72 },
];
// the harpsichord. On the beat where the cello is, and in the gaps where it is
// not — that interlock IS a continuo.
const sysMUS_CEMBALO = [
  { t: 0, v: 0.90 }, { t: 3, v: 0.55 }, { t: 4, v: 0.78 },
  { t: 6, v: 0.50 }, { t: 7, v: 0.42 },
];
// ===========================================================================
// Chapter 11 — HONG KONG. The only ELECTRONIC score in the game.
//
// Every other palette here is an acoustic ensemble simulated out of oscillators.
// This one is a drum machine and three synthesisers, and it should be, because
// the place it is about is the one place in this game whose light is not
// daylight: after dark Mong Kok is lit entirely by things somebody plugged in.
//
// Three rules keep it from being generic synthwave:
//
//  1. THE MODE IS YU, NOT MINOR. A C D E G — the five-note mode most Cantonese
//     melody sits in — so the arpeggio has no second and no sixth in it and
//     therefore none of the wistfulness a natural minor arpeggio has. It is a
//     brighter, harder, more ANGULAR sound and it is not an accident.
//  2. THE VAMP IS i – VI – III – VII, which is the turnaround under about half
//     of what came out of Hong Kong between 1984 and 1996. It is a loop and it
//     is meant to be: you are not going anywhere, you are going up.
//  3. THERE IS ONE ACOUSTIC THING IN IT. A guzheng figure, with the left-hand
//     bend on it, every fourth bar. Without it this is a synth preset; with it
//     it is a synth preset in a specific city.
//
// The bar is sixteen sixteenths at 112 bpm and `musBeatLen` is set to a CROTCHET,
// so `game.music.beats()` counts one two three four — which is what kowloon.js
// lights the far shore on, one tower per beat. That is the only marquee moment
// in this game that is scored, and it is scored off the audio clock itself, so
// it cannot drift from what the player is hearing.
const sysMUS_CHORDS12 = [
  [57, 60, 64, 67, 69],   // Am  — i
  [53, 57, 60, 65, 69],   // F   — VI
  [55, 60, 64, 67, 72],   // C   — III
  [55, 59, 62, 67, 71],   // G   — VII
];
const sysMUS_ROOTS12 = [33, 29, 36, 31];
const sysMUS_NEXT12  = [[1], [2], [3], [0]];        // a vamp, not a wander
const sysMUS_HK_16  = 0.13393;                      // a sixteenth at 112 bpm
const sysMUS_HK_BAR = 16;

// 12 — PALAWAN. Lydian, and the brightest harmony in the game: a raised fourth
// is the one interval that sounds like light on water, and it is the reason
// every film about the sea has been written in this mode since 1975. Slow, wide
// voicings, and the plucks well spread — the chapter is mostly silence and
// something moving in it.
const sysMUS_CHORDS13 = [
  [60, 64, 67, 71, 74],   // Cmaj9
  [65, 69, 72, 76, 79],   // Fmaj9   (the lydian pivot)
  [57, 60, 64, 67, 71],   // Am9
  [55, 59, 62, 67, 69],   // G6/9
];
const sysMUS_ROOTS13 = [36, 41, 33, 31];
const sysMUS_NEXT13  = [[1, 2], [2, 3], [3, 0], [0, 1]];

// 13 — CAPPADOCIA. Hijaz on D: the flat second and the augmented second above
// it, which is the interval every ney player in Anatolia opens with. Long
// dwells because there is nothing hurrying at five in the morning, and the
// filter well down because a ney has almost no upper partials at all.
const sysMUS_CHORDS14 = [
  [62, 66, 69, 74, 77],   // D  F# A  D  F
  [63, 67, 70, 75, 79],   // Eb G  Bb Eb G
  [67, 70, 74, 79, 82],   // G  Bb D  G  Bb
  [62, 65, 69, 74, 78],   // Dm, and it goes round again
];
const sysMUS_ROOTS14 = [38, 39, 43, 38];
const sysMUS_NEXT14  = [[1], [2], [3], [0]];
// the machine. Kick on the one and the "and" of two — the pattern that made
// eighties Cantopop swing rather than march.
const sysMUS_HK_KICK  = [{ t: 0, v: 1.0 }, { t: 6, v: 0.72 }, { t: 8, v: 0.88 }, { t: 14, v: 0.6 }];
const sysMUS_HK_SNARE = [{ t: 4, v: 1.0 }, { t: 12, v: 1.0 }];
// closed hats on every eighth, accented on the beat, with two sixteenths of
// fill at the end of the bar
const sysMUS_HK_HAT   = [1.0, 0, 0.45, 0, 0.7, 0, 0.45, 0, 1.0, 0, 0.45, 0, 0.7, 0, 0.5, 0.5];
// the bass: octaves, which is the one thing a synth bass in this idiom does
const sysMUS_HK_BASS  = [{ t: 0, o: 0, v: 1.0 }, { t: 3, o: 12, v: 0.6 },
                         { t: 6, o: 0, v: 0.9 }, { t: 8, o: 0, v: 0.85 },
                         { t: 11, o: 12, v: 0.55 }, { t: 14, o: 0, v: 0.8 }];
// A C D E G, relative to the root. The arp runs up and down this and nothing
// else, which is what makes it sound like this city and not like Miami.
const sysMUS_HK_YU = [0, 3, 5, 7, 10];
const sysMUS_HK_ARP = [0, 1, 2, 3, 4, 3, 2, 1, 0, 2, 4, 2, 0, 1, 3, 4];

const sysMUS_GNAWA_PULSE = 0.1417;               // 12 of these is 1.70 s
const sysMUS_GNAWA_CELL  = 12;
// the guembri ostinato. `d` indexes the pentatonic below; the accent is on the
// pulses that are NOT dotted-beats, which is the cross-rhythm.
const sysMUS_GUEMBRI = [
  { t: 0, d: 0, v: 1.00 }, { t: 3, d: 2, v: 0.72 }, { t: 5, d: 1, v: 0.88 },
  { t: 6, d: 0, v: 0.80 }, { t: 8, d: 3, v: 0.66 }, { t: 9, d: 2, v: 0.92 },
  { t: 11, d: 1, v: 0.60 },
];
// E minor pentatonic, an octave and a bit below middle C. A guembri is a BASS.
const sysMUS_GUEMBRI_P = [0, 3, 5, 7, 10];
// the qraqeb, every pulse, accented on the four dotted beats
const sysMUS_QRAQEB = [1.0, 0.42, 0.55, 0.92, 0.40, 0.58, 1.0, 0.42, 0.55, 0.88, 0.44, 0.62];
// the tbel: the two halves of the cell, and a pick-up into the next one
const sysMUS_TBEL = [{ t: 0, v: 1.0 }, { t: 6, v: 0.72 }, { t: 10, v: 0.5 }];
// hands, which only come in when something is happening
const sysMUS_GNAWA_CLAP = [0, 3, 6, 9];

// 14 — MANLY. D mixolydian, which is the flat seventh every Australian record
// made outdoors has in it. The same felt mallets as the gardens and the quay,
// because this is the same city and the score should say so — but it moves
// more often than either, because the thing the chapter is about arrives every
// eight and a half seconds whether anybody is ready or not.
const sysMUS_CHORDS15 = [
  [62, 66, 69, 71, 76],   // D6/9
  [60, 64, 67, 72, 74],   // C
  [55, 59, 62, 67, 71],   // G
  [57, 60, 64, 69, 71],   // Am7
];
const sysMUS_ROOTS15 = [38, 36, 43, 45];
const sysMUS_NEXT15  = [[1, 2], [2], [3, 0], [0]];

// 15 — THE PANTANAL. Major sevenths and a bowed pad, which is the one palette
// in this game that is allowed to be simply WARM. No samba: Rio owns 2/4 and
// this place has never been in a hurry in its life. The viola caipira is a
// ten-string guitar and 'violin' is as near as the synth gets to it; what
// matters is that it is the only sustained bowed voice here, and it should
// sound like the end of an afternoon.
const sysMUS_CHORDS16 = [
  [57, 61, 64, 68, 71],   // Amaj7
  [62, 66, 69, 73, 76],   // Dmaj7
  [59, 62, 66, 69, 73],   // Bm7
  [64, 68, 71, 75, 78],   // Emaj7
];
const sysMUS_ROOTS16 = [33, 38, 35, 40];
const sysMUS_NEXT16  = [[1], [2], [3], [0]];

// 16 — SƠN ĐOÒNG. Quartal stacks with no third in them at all, so nothing is
// major or minor and nothing resolves — which is the only honest harmony for a
// place with no light in it. Two octaves below everything else, the filter
// nearly shut, and the most reverb any chapter gets by a distance, because the
// passage is two hundred metres high and the game should sound like it.
const sysMUS_CHORDS17 = [
  [50, 55, 60, 65, 67],   // D G C F G
  [48, 53, 58, 63, 67],   // C F Bb Eb G
  [52, 57, 62, 67, 69],   // E A D G A
  [50, 55, 60, 62, 67],   // D G C D G
];
const sysMUS_ROOTS17 = [26, 24, 28, 26];
const sysMUS_NEXT17  = [[1], [2], [3], [0]];
// 17 - Antarctica. Open fifths and no thirds at all, which is the only
// harmony that sounds like a place with nothing in it: a third tells you
// whether to be happy or sad about somewhere, and this chapter should not
// tell you. Two of the four chords are the same two notes an octave apart.
const sysMUS_CHORDS18 = [
  [43, 50, 55, 62, 69],   // G D G D A
  [45, 52, 57, 64, 71],   // A E A E B
  [41, 48, 53, 60, 67],   // F C F C G
  [43, 50, 57, 62, 64],   // G D A D E
];
const sysMUS_ROOTS18 = [19, 21, 17, 19];
const sysMUS_NEXT18  = [[1, 2], [3], [0], [0, 1]];

const sysMUS_PAL = [
  // 0 — Sydney. Felt mallets over a wide, slow pad: a hot afternoon in a public
  // garden where nothing is in a hurry.
  { chords: sysMUS_CHORDS, roots: sysMUS_ROOTS, next: sysMUS_NEXT,
    dwellA: 9, dwellB: 15, pluckA: 1.2, pluckB: 3.8, cut: 620, bus: sysMUS_BUS, bass: 0.26,
    lead: 'mallet', xfade: sysMUS_XFADE, rhythm: null,
    // Taking the stage. The plain ascent, on the mallets — this is the first
    // marquee most players ever hear and it is the one the other twelve are
    // heard AGAINST, so it is deliberately the unadorned version of the gesture.
    lift: { shape: 'up', n: 9, gap: 0.115, oct: 0, vel: 1.00 } },
  { chords: sysMUS_CHORDS3, roots: sysMUS_ROOTS3, next: sysMUS_NEXT3,
    // Four bars a chord, and a short crossfade to match: the 4 s voice-lead that
    // hides a change under a 15 s harbour pad would still be moving when the next
    // chord arrived here, and the pad would sit in a permanent smear.
    dwellA: 4.4, dwellB: 6.7, pluckA: 2.2, pluckB: 5.2, cut: 700, bus: 0.085, bass: 0.30,
    lead: 'quena', xfade: 1.3, rhythm: sysMUS_RHY,
    // Hanging off a condor over Galeras. 'soar' is the whole point: the gaps
    // LENGTHEN as the figure climbs, which is what a bird that has stopped
    // flapping and found the thermal actually does. Seven notes on the quena,
    // and a long bloom, because the ride is thirty seconds and not a beat.
    lift: { inst: 'quena', shape: 'soar', n: 7, gap: 0.20, oct: 0, vel: 0.95,
            up: 2.0, dn: 10.5 } },
  // 2 — Circular Quay, alongside. Up a fourth from the gardens into A lydian:
  // brighter, higher, and it moves twice as often, because the quay never shuts
  // up. Six of its seven notes are chapter 1's, so the crossfade is legal.
  { chords: sysMUS_CHORDS2, roots: sysMUS_ROOTS2, next: sysMUS_NEXT2,
    dwellA: 6, dwellB: 10, pluckA: 1.0, pluckB: 3.0, cut: 780, bus: 0.16, bass: 0.26,
    lead: 'mallet', xfade: 3.2, rhythm: null, buoy: true,
    // No marquee is scored on this palette — chapter 3's lands under way — but a
    // wow can be earnt alongside (the ferry, the busker) and it should still
    // sound like the quay: the gardens' figure, brighter and a tone up.
    lift: { shape: 'up', n: 9, gap: 0.100, oct: 2, vel: 1.00 } },
  // 3 — under way to Manly.
  { chords: sysMUS_CHORDS4, roots: sysMUS_ROOTS4, next: sysMUS_NEXT4,
    dwellA: 6.5, dwellB: 9.5, pluckA: 0.9, pluckB: 2.4, cut: 1150, bus: 0.205, bass: 0.23,
    lead: 'pluck', xfade: 3.0, rhythm: null,
    // Seven hundred metres of open water, and then the wharf. 'fan' opens
    // outward from the middle in both directions at once, hard-panned — the
    // only figure here that arrives from both sides, which is what coming
    // alongside looks like over the bow.
    lift: { shape: 'fan', n: 10, gap: 0.105, oct: 0, vel: 1.05, pan: 0.62 } },
  // 4 — Kyoto & Uji. The sparsest score in the game by a distance: chords held
  // for a quarter of a minute, plucks four seconds apart, filter almost shut.
  { chords: sysMUS_CHORDS5, roots: sysMUS_ROOTS5, next: sysMUS_NEXT5,
    dwellA: 13, dwellB: 21, pluckA: 2.6, pluckB: 6.0, cut: 520, bus: 0.145, bass: 0.22,
    lead: 'koto', xfade: 5.0, rhythm: null, shaku: true,
    // The river down to the mill. The ONE figure in the game that mostly
    // descends: a koto run pouring downstream and a single note left ringing
    // above where it started. Every other place celebrates by going up; the
    // Uji celebrates by going with it. Slow gaps, because this is the quietest
    // palette in the game and a fast run would be a different chapter.
    lift: { inst: 'koto', shape: 'cascade', n: 8, gap: 0.165, oct: 0, vel: 1.00,
            up: 1.8, dn: 11.0 } },
  // 5 — Cali. The pad drops to almost nothing (bus 0.055) because in salsa the
  // sustained harmony is the piano's job, not a synth's; the plucks are off
  // entirely; and everything you hear is the band. Two bars a chord, which at
  // 100 bpm is 4.8 s and exactly one full clave cycle.
  { chords: sysMUS_CHORDS6, roots: sysMUS_ROOTS6, next: sysMUS_NEXT6,
    dwellA: 4.8, dwellB: 4.8, pluckA: 99, pluckB: 99, cut: 950, bus: 0.055, bass: 0.10,
    lead: 'none', xfade: 0.9, rhythm: null, band: 'salsa',
    eighth: sysMUS_SALSA_EIGHTH, barEighths: sysMUS_SALSA_BAR,
    // The chiva grinding up to the mirador with you on the roof. The palette's
    // lead is 'none' because the band IS the lead, so the lift names its own
    // voice: a marimba de chonta is the instrument of this coast and the mallet
    // is the nearest thing here to one. Gaps of 72 ms put it at roughly the
    // eighth-note grid the montuno is already on, so the flourish lands INSIDE
    // the band instead of over the top of it.
    lift: { inst: 'mallet', shape: 'up', n: 12, gap: 0.072, oct: 0, vel: 1.05,
            up: 1.1, dn: 8.0 } },
  // 6 — Rio. Same reasoning as Cali: in a bateria the sustained harmony is the
  // cavaquinho's job, so the pad is almost off and the plucks are gone. Two
  // bars a chord, which at 132 in 2/4 is 1.8 s — samba turns its harmony over
  // about twice as fast as salsa, and slowing it down to match would drag.
  { chords: sysMUS_CHORDS7, roots: sysMUS_ROOTS7, next: sysMUS_NEXT7,
    dwellA: 1.818, dwellB: 1.818, pluckA: 99, pluckB: 99, cut: 1050, bus: 0.05, bass: 0.10,
    lead: 'none', xfade: 0.7, rhythm: null, band: 'samba',
    sixteenth: sysMUS_SAMBA_16, barSixteenths: sysMUS_SAMBA_BAR,
    // Sambaing down the avenue on the two. The fastest lift in the game and the
    // only one that ACCELERATES — 'swell' shortens the gap as it climbs, which
    // is what a bateria does into a break. Fourteen notes at a sixteenth-ish
    // spacing, so it reads as a fill rather than as an arpeggio, and the
    // shortest bloom here, because in this chapter nothing waits for you.
    lift: { inst: 'pluck', shape: 'swell', n: 14, gap: 0.062, oct: 2, vel: 1.10,
            up: 0.8, dn: 7.0 } },
  // 7 — Iceland. The second-sparsest score in the game and the darkest filter
  // in it: 470 against Kyoto's 520 and the harbour's 620. The pad is allowed a
  // little more bus than Kyoto's because there is nothing else out there — no
  // rhythm section, one bowed note every four or five seconds, and a choir that
  // is silent until the sky is not.
  { chords: sysMUS_CHORDS8, roots: sysMUS_ROOTS8, next: sysMUS_NEXT8,
    dwellA: 11, dwellB: 18, pluckA: 3.0, pluckB: 7.0, cut: 470, bus: 0.155, bass: 0.245,
    lead: 'bow', xfade: 5.5, rhythm: null, choir: true,
    // Bringing the sky down. Five bowed notes over three seconds — by a distance
    // the SLOWEST lift here, and it has to be: iceland.js holds
    // game.music.swell() for the twelve seconds the aurora is climbing, so this
    // figure is not a punctuation mark at the end of a moment, it is the
    // moment's own melody, and an arpeggio at 115 ms underneath a twelve-second
    // hold sounds like an alarm going off during a sunset.
    lift: { inst: 'bow', shape: 'arch', n: 5, gap: 0.62, oct: 0, vel: 1.15,
            up: 2.6, dn: 12.0 } },
  // 8 — Marrakech. Same reasoning as the other two bands: in gnawa the
  // sustained harmony is the guembri's own drone, so the pad is nearly off and
  // the plucks are gone. One "chord" for four cells, which is 6.8 s, and most
  // of the time it is the same one again.
  { chords: sysMUS_CHORDS9, roots: sysMUS_ROOTS9, next: sysMUS_NEXT9,
    dwellA: 6.8, dwellB: 6.8, pluckA: 99, pluckB: 99, cut: 900, bus: 0.05, bass: 0.09,
    lead: 'none', xfade: 0.8, rhythm: null, band: 'gnawa',
    pulse: sysMUS_GNAWA_PULSE, cellPulses: sysMUS_GNAWA_CELL,
    // Coming down the great dune. The second descending figure in the game and
    // the only other one that earns it: this set piece is a HUNDRED METRES OF
    // FALLING and a rising arpeggio was arguing with the picture. It lands on
    // the gnawa pulse grid (141.7 ms) so the flourish is inside the cell rather
    // than across it, and the last note comes back up, because you get to the
    // bottom of the dune and you are still standing.
    lift: { inst: 'mallet', shape: 'cascade', n: 10, gap: sysMUS_GNAWA_PULSE, oct: 0,
            vel: 1.05, up: 1.2, dn: 8.5 } },
  // 9 — the Drift. The slowest and the brightest at once, which no other
  // palette here manages: the pad barely moves and everything on top of it is
  // above middle C. The crossfade is the longest in the game (7 s) because at
  // this dwell there is nothing for it to collide with.
  { chords: sysMUS_CHORDS10, roots: sysMUS_ROOTS10, next: sysMUS_NEXT10,
    dwellA: 15, dwellB: 26, pluckA: 3.4, pluckB: 8.5, cut: 1250, bus: 0.15, bass: 0.20,
    lead: 'glass', xfade: 7.0, rhythm: null,
    // Lighting the lantern at the top of the world. Six glass notes, each of
    // which rings for ten seconds, so by the fourth one they are a chord and by
    // the sixth they are a room. The longest bloom and the longest decay in the
    // game — this is the last thing that happens in the chapter with nobody in
    // it, and it should still be going when the banner has gone.
    lift: { inst: 'glass', shape: 'up', n: 6, gap: 0.44, oct: 0, vel: 1.10,
            up: 2.4, dn: 13.0 } },
  // 10 — Venice. One chord a bar, a real cadence at the end of every cycle,
  // and the pad well back because the harmony is the continuo's job here, not
  // a synthesiser's. The filter is midway: a harpsichord is a bright
  // instrument and shutting it down to Kyoto's 520 would leave it as a thud.
  { chords: sysMUS_CHORDS11, roots: sysMUS_ROOTS11, next: sysMUS_NEXT11,
    dwellA: 2.5, dwellB: 2.5, pluckA: 1.6, pluckB: 3.4, cut: 860, bus: 0.062, bass: 0.10,
    lead: 'violin', xfade: 0.9, rhythm: null, band: 'baroque',
    quaver: sysMUS_BAR_Q, barQuavers: sysMUS_BAR_QN,
    // San Marco going under. 'arch' because this is the one palette in the game
    // with real cadences in it, and a figure that climbs and does not come back
    // is, in this idiom, an unfinished sentence. Eight notes on the quaver grid
    // the continuo is already keeping, so it is a violin phrase and not a
    // synthesiser's idea of one.
    lift: { inst: 'violin', shape: 'arch', n: 8, gap: sysMUS_BAR_Q, oct: 0, vel: 1.05,
            up: 1.5, dn: 9.5 } },
  // 11 — Hong Kong. The loudest, brightest and busiest palette in the game by
  // a distance, and the only synthetic one. The pad is nearly off because the
  // arpeggio IS the sustained harmony, and the filter is wide open because
  // nothing about this place is soft.
  { chords: sysMUS_CHORDS12, roots: sysMUS_ROOTS12, next: sysMUS_NEXT12,
    dwellA: 2.143, dwellB: 2.143, pluckA: 99, pluckB: 99, cut: 1320, bus: 0.045, bass: 0.09,
    lead: 'none', xfade: 0.6, rhythm: null, band: 'hk',
    sixteenth: sysMUS_HK_16, barSixteenths: sysMUS_HK_BAR,
    // Being on the roof when the lights come on. The towers come up one per
    // beat and they come up on BOTH SIDES of the harbour, so the figure opens
    // outward from the middle — hard-panned, sixteen notes, the widest fan
    // here. It is the same shape as coming alongside at Manly and it is doing
    // the same job for the opposite reason: there, two shores closing; here,
    // two shores lighting.
    lift: { inst: 'pluck', shape: 'fan', n: 16, gap: 0.067, oct: 4, vel: 1.10,
            pan: 0.78, up: 0.9, dn: 8.0 } },
  // 12 — Palawan. The widest crossfade in the game after the Drift's, and the
  // most open filter: everything about this place is bright, and the one thing
  // it must not sound like is a jingle over a postcard.
  { chords: sysMUS_CHORDS13, roots: sysMUS_ROOTS13, next: sysMUS_NEXT13,
    dwellA: 7.5, dwellB: 13.0, pluckA: 2.6, pluckB: 6.2, cut: 1180, bus: 0.135, bass: 0.195,
    lead: 'mallet', xfade: 4.6, rhythm: null,
    // Being under when the water lights up. Glass rather than the palette's own
    // mallet, and quiet: bioluminescence does not announce itself, it is ALREADY
    // THERE when you notice it. Eighteen notes is the densest figure in the game
    // and the softest — it should read as a texture arriving rather than as a
    // phrase being played, which is the difference between plankton and a
    // fanfare.
    lift: { inst: 'glass', shape: 'up', n: 18, gap: 0.088, oct: 5, vel: 0.72,
            up: 2.2, dn: 11.5 } },
  // 13 — Cappadocia. The quietest palette here by a distance and the only one
  // with a flute over it. It is a chapter about waiting for something.
  { chords: sysMUS_CHORDS14, roots: sysMUS_ROOTS14, next: sysMUS_NEXT14,
    dwellA: 10.0, dwellB: 17.0, pluckA: 3.6, pluckB: 8.0, cut: 720, bus: 0.115, bass: 0.185,
    lead: 'quena', xfade: 5.2, rhythm: null,
    // The sun clearing the rim. Six flute notes, opening out — the same 'soar'
    // as the condor, two hundred degrees of longitude and eleven chapters away,
    // and deliberately so: those are the only two moments in this game that are
    // a slow rise in silence with no ground under them. goreme.js holds the
    // swell across the whole climb, so like Iceland's this is a melody, not a
    // punctuation mark.
    lift: { inst: 'quena', shape: 'soar', n: 6, gap: 0.34, oct: 0, vel: 1.05,
            up: 2.8, dn: 12.0 } },
  // 14 — Manly. Sydney's mallets, a tone down and moving twice as often. The
  // buoy bell from the quay palette comes back, because it is the same water
  // and it is the one sound both chapters can hear.
  { chords: sysMUS_CHORDS15, roots: sysMUS_ROOTS15, next: sysMUS_NEXT15,
    dwellA: 5.2, dwellB: 8.4, pluckA: 1.1, pluckB: 3.2, cut: 900, bus: 0.14, bass: 0.26,
    lead: 'mallet', xfade: 2.6, rhythm: null, buoy: true,
    // Taking the wave of the set the whole way in. Ten mallet notes CLOSING UP
    // — 'swell', not 'soar' — because a ride is the one moment in this game
    // that gets faster as it goes: the wave stands you up out the back and
    // then hands you fifty metres of white water that is still accelerating
    // when it puts you on the sand.
    lift: { shape: 'swell', n: 10, gap: 0.105, oct: 0, vel: 1.02,
            up: 1.1, dn: 7.5 } },
  // 15 — The Pantanal. The warmest thing here, and the only bowed one.
  { chords: sysMUS_CHORDS16, roots: sysMUS_ROOTS16, next: sysMUS_NEXT16,
    dwellA: 9.5, dwellB: 15.5, pluckA: 2.8, pluckB: 6.8, cut: 820, bus: 0.155, bass: 0.30,
    lead: 'violin', xfade: 5.0, rhythm: null,
    // The whole herd going over at sundown. Seven notes opening out on the
    // bowed voice — the 'soar' shape again, and deliberately: this and the
    // condor are the two moments in the game where the animal is not doing
    // anything clever, it is just being carried along by something bigger.
    lift: { inst: 'violin', shape: 'soar', n: 7, gap: 0.30, oct: 0, vel: 0.98,
            up: 3.0, dn: 13.0 } },
  // 16 — Sơn Đoòng. The lowest, slowest, wettest palette in the game.
  { chords: sysMUS_CHORDS17, roots: sysMUS_ROOTS17, next: sysMUS_NEXT17,
    dwellA: 14.0, dwellB: 22.0, pluckA: 5.0, pluckB: 11.0, cut: 560, bus: 0.30, bass: 0.34,
    lead: 'glass', xfade: 7.0, rhythm: null,
    // Standing in the shaft. Eight glass notes, wide apart, two octaves up —
    // the only bright thing in the chapter, arriving in the only bright place
    // in it. cave.js holds the swell for the whole walk into the light, so
    // like Iceland's and Cappadocia's this is a melody rather than a chime.
    lift: { inst: 'glass', shape: 'soar', n: 8, gap: 0.30, oct: 12, vel: 0.9,
            up: 3.4, dn: 15.0 } },
  // 17 - Antarctica. The widest, slowest, emptiest pad here, and the only
  // one with no thirds in it. It moves about once every fifteen seconds,
  // which is roughly how often anything happens down there.
  { chords: sysMUS_CHORDS18, roots: sysMUS_ROOTS18, next: sysMUS_NEXT18,
    dwellA: 12.0, dwellB: 19.0, pluckA: 4.5, pluckB: 10.0, cut: 900, bus: 0.26, bass: 0.28,
    lead: 'glass', xfade: 6.0, rhythm: null,
    // Six orcas on the quarters at twelve metres a second. 'soar' again, and
    // for the third time in this table it is the shape used for the same
    // idea: the animal is not doing anything clever, it is being carried
    // along by something enormously bigger than it. Nine notes, opening out.
    lift: { inst: 'glass', shape: 'soar', n: 9, gap: 0.22, oct: 0, vel: 1.00,
            up: 2.6, dn: 12.0 } },
];
// The Circular Quay palette (A lydian) got the PLACE trigger it wanted: biome
// entry selects it, and stepping off the wheel returns to it from the passage
// palette. It is the same mallets as the gardens up a fourth, plus a buoy bell
// out on the water — the quay is Sydney, brighter and wetter, not a new country.
// The thickening layer: a high pad voice that fades up with the tally, so the score
// gets denser as the mischief mounts without anything ever "starting".
// ---------------------------------------------------------------------------
// THE TITLE CARD'S KEYS, PAST THE END OF THE DIGITS.
//
// Ten digits, thirteen chapters. The eleventh was bound to the minus key with a
// hand-written `if`, which is fine for exactly as long as there are eleven —
// the twelfth and thirteenth both drew the same '–' badge as the eleventh and
// neither could be started from the keyboard at all. A table cannot be missing
// a rung, and this one runs out at the seventeenth.
// ---------------------------------------------------------------------------
const sysPICK_EXTRA = [
  { code: 'Minus', alt: 'NumpadSubtract', label: '–' },
  { code: 'Equal', alt: 'NumpadAdd', label: '=' },
  { code: 'BracketLeft', alt: '', label: '[' },
  { code: 'BracketRight', alt: '', label: ']' },
  { code: 'Semicolon', alt: '', label: ';' },
  { code: 'Quote', alt: '', label: "'" },
  // The sixteenth chapter used the last rung of this table, which is exactly
  // the moment to lengthen it rather than the moment after. Everything past
  // here is a key that exists on every keyboard layout this game will ever
  // meet; the picker prints the badge, so none of it has to be guessed, and a
  // row past the end of the table simply gets no badge and stays clickable.
  { code: 'Comma', alt: '', label: ',' },
  { code: 'Period', alt: '', label: '.' },
  { code: 'Slash', alt: 'NumpadDivide', label: '/' },
  // ...and NOT Backquote, which is already the stats key. Twenty rungs.
  { code: 'Backslash', alt: '', label: '\\' },
];
/** The badge on chapter i's row (0-based), and the key that starts it. */
function sysPickLabel(i) {
  if (i < 9) return String(i + 1);
  if (i === 9) return '0';
  const e = sysPICK_EXTRA[i - 10];
  return e ? e.label : '';
}
/**
 * HOW MANY COLUMNS THE SHELF SHOULD HAVE FOR `n` TILES.
 *
 * A grid with a lonely orphan on the last row reads as a mistake, and a grid
 * with a FIXED column count gets one the moment somebody adds a chapter. This
 * is the whole of the layout's cleverness and it is nine lines: try four, five
 * and six columns, and take the one whose last row is fullest — a remainder of
 * zero wins outright, otherwise the fullest partial row does.
 *
 *   15 -> 5 (three full rows)       17 -> 6 (five of six on the last)
 *   18 -> 6 (three full rows)       19 -> 5 (four of five)
 *
 * At fifteen it happens to give the same answer a hand-typed 5 would. At
 * sixteen, or twenty-two, or forty, it still gives an answer, which is the
 * point.
 */
function sysPickCols(n) {
  let best = 5, bestScore = -1;
  for (let c = 4; c <= 6; c++) {
    const r = n % c;
    const score = r === 0 ? 10 : r / c;
    if (score > bestScore || (score === bestScore && c > best)) { bestScore = score; best = c; }
  }
  return best;
}

/** Which chapter (1-based) a non-digit key starts, or 0. */
function sysPickFromCode(code) {
  for (let i = 0; i < sysPICK_EXTRA.length; i++) {
    const e = sysPICK_EXTRA[i];
    if (code === e.code || (e.alt && code === e.alt)) return 11 + i;
  }
  return 0;
}
// ---------------------------------------------------------------------------
// THE CONTROLS, IN ONE TABLE, BECAUSE THEY ARE NEEDED IN TWO PLACES.
//
// This list used to be a literal inside the title card's builder, and the title
// card is REMOVED FROM THE DOM 900 ms after the game starts. So the only
// statement of the control scheme this game has ever made was visible for the
// length of one fade, and a player who forgot which key turns the camera — or
// who came back to a saved journey a week later, which the save file explicitly
// invites — had no way to find out short of reloading the page and reading the
// front of the game again. Three hours of play behind a legend you can see for
// nine tenths of a second is not a control scheme, it is a memory test.
//
// One table, built into the title card AND into the journal (which is already
// the modal that Tab opens, already pauses the game, and already says "close"
// on the front of the game). Nothing new to find and nothing new to close.
// ---------------------------------------------------------------------------
// THIRTEEN ROWS IS NOT A CONTROL SCHEME, IT IS A MANUAL.
//
// Every one of the old thirteen was real and every one of them still works.
// The problem was that they were presented as ONE LIST OF EQUALS, so the front
// of the game answered "how do I play this" with thirteen keys — and a player
// reading thirteen keys concludes, correctly, that there are thirteen things
// to remember before they can start. There are six. The other seven are
// FURNITURE: they move the camera, they open a card, they turn the music down.
// None of them is a verb the capybara has, and none of them is needed to play.
//
// So the table is two tables. The front of the game shows the six verbs and
// nothing else; the extras are one fold away, on the title card and in the
// journal both. Nothing was unbound — a key a player has already learned must
// never stop working — it simply stopped being ADVERTISED as a thing you have
// to know first.
const sysLEGEND = [
  ['WASD / arrows', 'waddle about'],
  ['Shift', 'run'],
  ['Space', 'hop'],
  ['E / left click', 'grab, dig, hold on'],
  ['Q', 'WHEEK'],
  ['drag  ·  wheel', 'look around  ·  zoom'],
];
const sysLEGEND_MORE = [
  ['Z  /  X  ·  C', 'turn the camera  ·  recentre it'],
  ['F  ·  Shift+F', 'aim at another task'],
  ['R (held)', 'put me back'],
  ['Tab  ·  Esc', 'the journal  ·  close'],
  ['P', 'hide the paper'],
  ['M  ·  N  ·  [  ]', 'mute  ·  music  ·  volume'],
  // The pad belongs in the fold and not on the front of the game, by the same
  // argument as everything else down here: it is not a thing you have to know
  // first, it is a thing you go and look up once. Two rows, because that is
  // the whole scheme — a stick, three face buttons and a shoulder.
  ['pad  ·  sticks', 'move  ·  look, and click to recentre'],
  ['pad  ·  A  X  B', 'hop  ·  grab  ·  WHEEK   (RT runs)'],
];
/**
 * Fill `el` with a control legend. `which` picks the table: undefined or
 * 'core' for the six verbs, 'more' for the furniture, 'all' for both with a
 * rule between them (the journal, which has room and is read deliberately).
 */
function sysFillLegend(el, which) {
  const tables = which === 'more' ? [sysLEGEND_MORE]
               : which === 'all' ? [sysLEGEND, sysLEGEND_MORE]
               : [sysLEGEND];
  for (let t = 0; t < tables.length; t++) {
    if (t > 0) {
      // A spanning divider inside a two-column grid, so the second table reads
      // as a second table rather than as six more of the first.
      el.appendChild(sysEl('span', 'capyui-legsplit', 'and the furniture'));
    }
    const rows = tables[t];
    for (let i = 0; i < rows.length; i++) {
      el.appendChild(sysEl('kbd', null, rows[i][0]));
      el.appendChild(sysEl('span', null, rows[i][1]));
    }
  }
  return el;
}

/**
 * WHICH CHAPTER A KEY PICKS — digits, numpad and the overflow row, in one
 * place. The title card's picker and the departures board both need exactly
 * this mapping and both used to roll their own: the card's was complete, and
 * the board's stopped at Digit9, which quietly made the last four chapters
 * unreachable from the keyboard. Returns 0 for a key that picks nothing.
 */
function sysPickFromKey(code) {
  const digit = (code.indexOf('Digit') === 0 || code.indexOf('Numpad') === 0)
                ? code.charCodeAt(code.length - 1) - 48 : -1;
  const n = (digit >= 1 && digit <= 9) ? digit
          : digit === 0 ? 10
          : sysPickFromCode(code);
  return (n > 0 && n <= CHAPTERS.length) ? n : 0;
}

const sysMUS_SHIM   = 76;
const sysMUS_SHIM_L = 0.052;

// ---------------------------------------------------------------------------
// THE LIFT — what a marquee moment sounds like.
//
// Every one of the eleven set pieces used to be paid for with the same tick
// chime as 'knock over a bin'. The score is generative and never stops, so a
// stinger over the top of it is the one thing that cannot be done: it would be
// in a different key half the time and it would sound like a notification.
//
// So the celebration is made of the score itself. Three voices an octave and a
// twelfth ABOVE the pad, voice-led into the same chord as everything else (they
// are pushed into musVoices, so they cannot be out of key by construction),
// silent at a gain of 0.0001 for the entire game except for the ten seconds
// after a wow. On top of that a rising arpeggio of the chord that is ACTUALLY
// SOUNDING, so the flourish resolves into the harmony rather than across it.
//
// It is per-place for free: the chord it lifts on is Kyoto's D minor pentatonic
// in Kyoto and Hong Kong's A minor vamp in Mong Kok, because it is reading the
// live palette. One layer, eleven characters, and no new score to maintain.
const sysMUS_LIFT   = [79, 84, 88];      // G5, C6, E6 — above everything else
const sysMUS_LIFT_L = [0.050, 0.040, 0.028];
const sysMUS_LIFT_UP  = 1.4;             // s to bloom      (default; see `lift`)
const sysMUS_LIFT_DN  = 9.0;             // s to be gone again
const sysMUS_LIFT_ARP = 9;               // notes in the rising figure
const sysMUS_LIFT_GAP = 0.115;           // s between them
// The register the flourish is allowed to live in — C4 to C7, which brackets
// the three sustained lift voices (79/84/88) it is announcing. See the fold in
// musSwell: this is a CEILING IN PITCH rather than a cap on octave count,
// because the fourteen palettes' chord tables span four octaves between them
// and the same number of stacked octaves means a different note in each.
const sysMUS_LIFT_LO  = 60;
const sysMUS_LIFT_HI  = 96;

// ---------------------------------------------------------------------------
// AND WHAT IT SOUNDS LIKE *HERE*.
//
// The three sustained voices above are the BED, and they are deliberately the
// same in all thirteen places: that layer is "the room got bigger", and the room
// getting bigger is the one thing every marquee moment has in common. What was
// wrong was that the FLOURISH was the same too — nine triangle-wave plucks
// climbing at 115 ms, whether the moment was a volcano opening under a condor or
// two centimetres of Adriatic arriving in San Marco. Thirteen set pieces, one
// gesture, and by the fourth one the player has learnt it and stopped hearing it.
//
// So every palette now carries its own `lift`, and it is a FIGURE, not a fixed
// phrase: it is still built out of `musCurChord` — the chord actually sounding —
// so it still cannot be in the wrong key, and it is still played on the place's
// own instrument rather than on a generic pluck. Kyoto's marquee runs down a
// KOTO. Iceland's is five bowed notes over six seconds. Hong Kong's is on the
// sixteenth grid the rest of that palette is on.
//
//   inst   which voice plays it. Defaults to the palette's own `lead`, which is
//          right everywhere except the five band palettes, whose lead is 'none'
//          because the band IS the lead — those name one explicitly.
//   shape  where the figure goes. See sysMusLiftDeg().
//   n      notes in it
//   gap    seconds between them (the FIRST gap: 'soar' lengthens as it goes)
//   oct    semitones added to the whole figure, on top of the +12 every lift has
//   vel    scale on the velocity ramp
//   up/dn  override the bloom / decay of the sustained bed, in seconds
//
// The shapes, and why a place gets one:
//   up       a straight climb. The archetype, and Sydney keeps it.
//   soar     a climb whose gaps LENGTHEN — something finding lift and settling.
//   arch     up and back down through the same tones: a phrase that closes.
//   cascade  down from the top, then one note back above the start. Gravity,
//            and then the thing that survives it.
//   fan      alternating below and above the middle, opening outward — two
//            sides of something lighting up at once.
//   swell    a climb whose gaps SHORTEN and whose notes get louder: the one
//            shape here that accelerates, for the only moment that does.
const sysMUS_LIFT_SHAPES = { up: 1, soar: 1, arch: 1, cascade: 1, fan: 1, swell: 1 };

/**
 * Scale degree `i` of a lift figure of `n` notes, as an offset in CHORD TONES
 * from the bottom of the figure. The chord is then indexed with it and octaved,
 * so every note is a tone of the live harmony however the shape wanders.
 */
function sysMusLiftDeg(shape, i, n) {
  const last = n > 1 ? n - 1 : 1;
  switch (shape) {
    case 'arch': {
      // Up to the apex, then back down the same steps. The apex is included
      // once, and the descent MUST NOT go below the note it started on: the
      // first cut used ceil(n/2) and 2*top - 2 - i, which for the eight-note
      // violin figure returned -1 on the last note — a phrase that ends a step
      // under its own first note, which in the one palette here with real
      // cadences in it is the wrong sentence entirely.
      const top = Math.floor(n / 2);
      return i <= top ? i : (2 * top - i);
    }
    case 'cascade': {
      // down from the top for all but the last note, which lands ABOVE the start
      if (i === last) return n;
      return (n - 2) - i;
    }
    case 'fan': {
      // 0, +1, -1, +2, -2 … about the middle, then re-based so it never goes under
      const mid = Math.floor(n / 2);
      const k = Math.ceil(i / 2);
      return mid + (i % 2 ? k : -k);
    }
    default:
      return i;                                   // up, soar, swell all climb
  }
}

/** Gap before note `i`, in seconds — the shapes that breathe do it here. */
function sysMusLiftGap(shape, base, i, n) {
  const t = n > 1 ? i / (n - 1) : 0;
  if (shape === 'soar')  return base * (0.62 + t * 1.25);   // opens out
  if (shape === 'swell') return base * (1.34 - t * 0.72);    // closes up
  return base;
}

function sysMidiHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
// Nearest chord tone to where the voice already is, gently pulled to its register.
function sysMusPick(chord, cur, centre, used) {
  let best = centre, bestScore = 1e9;
  for (let i = 0; i < chord.length; i++) {
    let n = chord[i];
    while (n < centre - 6) n += 12;
    while (n > centre + 6) n -= 12;
    let sc = Math.abs(n - cur) + Math.abs(n - centre) * 0.4;
    for (let k = 0; k < used.length; k++) if (used[k] === n) sc += 9;
    if (sc < bestScore) { bestScore = sc; best = n; }
  }
  return best;
}

function sysHex(c) { return '#' + ('000000' + (c >>> 0).toString(16)).slice(-6); }
// Channel triple, for the minimap bake — it interpolates colours per pixel and
// cannot afford to parse a hex string sixteen thousand times.
function sysHexRGB(c) { return [(c >> 16) & 255, (c >> 8) & 255, c & 255]; }
function sysRgba(c, a) {
  return 'rgba(' + ((c >> 16) & 255) + ',' + ((c >> 8) & 255) + ',' + (c & 255) + ',' + a + ')';
}
/**
 * THE PLACE MARKS.
 *
 * Thirteen chapters used to be thirteen identical beige rectangles with words
 * in them, which told a returning player nothing about anywhere. Each row now
 * carries a small flat-shaded scene of its own place, drawn out of THAT
 * BIOME'S OWN PALETTE, so the picker reads as a shelf of travel postcards
 * rather than as a list.
 *
 * Hand-authored geometry rather than art assets, because the contract forbids
 * external files of any kind, and because it is exactly what the game itself
 * is: a handful of flat polygons in the same colours at the same low-poly
 * grain. Every mark is under a dozen shapes.
 *
 * The format is deliberately dumb data, back to front, in a 64 x 40 viewBox:
 *   ['r', x, y, w, h, key]   rectangle
 *   ['p', 'points', key]     polygon
 *   ['c', cx, cy, r, key]    circle
 * `tint` is the wash laid behind the whole tile.
 */
const sysMARK_VB = '0 0 64 40';
const sysMARKS = {
  /* the shells LEAN, and they step down in size. Three symmetrical triangles
     read as mountains; this reads as the only building it can be. */
  sydney: { tint: 'water', s: [
    ['r', 0, 24, 64, 16, 'water'], ['r', 0, 18, 64, 6, 'grass'],
    ['p', '8,28 56,28 52,24 12,24', 'sandstone'],
    ['p', '12,24 13,16 19,8 24,24', 'sail'],
    ['p', '21,24 22,12 30,3 36,24', 'sail'],
    ['p', '32,24 33,14 40,6 46,24', 'sailShade'],
    ['p', '43,24 44,18 48,13 52,24', 'sail'] ] },
  pasto: { tint: 'grassDark', s: [
    ['r', 0, 26, 64, 14, 'grassDark'],
    ['p', '2,36 26,7 50,36', 'stoneDark'], ['p', '19,17 26,7 33,17', 'sail'],
    ['c', 26, 5, 4, 'foam'], ['c', 32, 3, 3, 'foam'], ['c', 20, 3, 2.5, 'foam'],
    ['p', '44,15 50,11 56,15 50,13.5', 'soil'] ] },
  /* the arch has to have DAYLIGHT under it or it is a hat, not a bridge */
  quay: { tint: 'water', s: [
    ['r', 0, 23, 64, 17, 'water'],
    ['p', '8,23 8,14 20,8 44,8 56,14 56,23 52,23 52,16 42,11 22,11 12,16 12,23', 'bridge'],
    ['r', 6, 12, 52, 2.6, 'bridge'],
    ['r', 9, 12, 3.5, 11, 'bridge'], ['r', 51.5, 12, 3.5, 11, 'bridge'],
    ['p', '18,30 48,30 45,36 21,36', 'wood'],
    ['r', 27, 24, 12, 6, 'sail'], ['r', 31, 20, 4, 4, 'petalRed'] ] },
  kyoto: { tint: 'matchaField', s: [
    ['r', 0, 26, 64, 14, 'matchaField'],
    ['r', 24, 16, 3, 14, 'toriiDark'], ['r', 38, 16, 3, 14, 'toriiDark'],
    ['r', 16, 12, 4, 18, 'torii'], ['r', 44, 12, 4, 18, 'torii'],
    ['r', 11, 10, 42, 3.5, 'torii'], ['p', '8,5 56,5 53,10 11,10', 'toriiDark'] ] },
  /* the painted street of San Antonio, and the river under it */
  cali: { tint: 'caliRiver', s: [
    ['r', 0, 28, 64, 12, 'caliRiver'], ['r', 0, 24, 64, 4, 'caliGrass'],
    ['r', 3, 13, 11, 11, 'caliWall1'], ['p', '2,13 15,13 13.5,10 3.5,10', 'caliRoof'],
    ['r', 15, 9, 11, 15, 'caliWall3'], ['p', '14,9 27,9 25.5,6 15.5,6', 'caliRoof'],
    ['r', 27, 15, 10, 9, 'caliWall5'], ['p', '26,15 38,15 36.5,12 27.5,12', 'caliRoof'],
    ['r', 49, 12, 2, 12, 'trunk'], ['p', '42,13 50,6 58,13 50,11', 'caliPalm'] ] },
  rio: { tint: 'rioSea', s: [
    ['r', 0, 28, 64, 12, 'rioSea'], ['r', 0, 25, 64, 3, 'rioSand'],
    ['p', '22,28 31,15 40,28', 'rioGraniteDk'], ['p', '34,28 46,6 58,28', 'rioGranite'],
    ['p', '0,28 10,13 20,28', 'rioForest'],
    ['r', 9.2, 7, 1.6, 7, 'rioCristo'], ['r', 6.5, 8.5, 7, 1.4, 'rioCristo'] ] },
  iceland: { tint: 'iceSkyNight', s: [
    ['r', 0, 0, 64, 40, 'iceSkyNight'],
    ['p', '1,11 20,4 41,10 63,3 63,9 41,16 20,10 1,17', 'iceAuroraMag'],
    ['r', 0, 29, 64, 11, 'iceBasalt'], ['r', 0, 28, 64, 2.5, 'iceSnow'],
    ['p', '28,30 32,9 36,30', 'iceGeoBlue'], ['c', 32, 7, 3.4, 'iceSteam'] ] },
  sahara: { tint: 'sahSand', s: [
    ['r', 0, 0, 64, 40, 'sahSkyHot'], ['c', 48, 11, 7, 'sahSun'],
    ['p', '0,40 0,29 17,21 35,28 50,19 64,25 64,40', 'sahSand'],
    ['p', '0,40 0,34 20,28 40,33 64,29 64,40', 'sahSandDeep'],
    ['r', 12, 17, 2, 13, 'sahPalmTrunk'], ['p', '5,18 13,11 21,18 13,16', 'sahPalm'] ] },
  /* the VOID is the chapter. Without it these are two boats on a lake. */
  drift: { tint: 'driVoidLow', s: [
    ['r', 0, 0, 64, 40, 'driVoidLow'], ['r', 0, 32, 64, 8, 'driCloud'],
    ['p', '4,25 24,25 18,32 10,32', 'driRockDark'], ['r', 4, 22, 20, 3, 'driGrass'],
    ['p', '35,16 56,16 50,24 41,24', 'driRockDark'], ['r', 35, 13, 21, 3, 'driGrass'],
    ['p', '42,2 50,2 52,12 40,12', 'driLamp'],
    ['c', 29, 20, 1.6, 'driSeed'], ['c', 15, 10, 1.2, 'driSeed'] ] },
  venice: { tint: 'venCanal', s: [
    ['r', 0, 27, 64, 13, 'venCanal'], ['r', 0, 24, 64, 3, 'venStone'],
    ['c', 34, 20, 5, 'venStone'], ['c', 44, 21, 4, 'venStone'],
    ['r', 11, 5, 7, 19, 'venBrick'], ['p', '10,5 19,5 14.5,0', 'venGold'],
    ['p', '6,31 32,31 29,36 9,36', 'venGondola'] ] },
  kowloon: { tint: 'hkSkyTop', s: [
    ['r', 0, 0, 64, 40, 'hkSkyTop'],
    ['r', 3, 11, 11, 29, 'hkTowerA'], ['r', 17, 4, 12, 36, 'hkTowerB'],
    ['r', 33, 13, 10, 27, 'hkTowerA'], ['r', 47, 7, 13, 33, 'hkTowerB'],
    ['r', 5, 17, 7, 3, 'hkNeonPink'], ['r', 19, 12, 8, 3, 'hkNeonCyan'],
    ['r', 35, 21, 6, 3, 'hkNeonGold'], ['r', 49, 15, 9, 3, 'hkNeonGreen'] ] },
  palawan: { tint: 'palShallow', s: [
    ['r', 0, 21, 64, 19, 'palShallow'], ['r', 0, 29, 64, 11, 'palDeep'],
    ['p', '6,21 17,3 28,21', 'palKarst'], ['p', '31,21 43,9 55,21', 'palKarstDk'],
    ['r', 0, 36, 64, 4, 'palSand'],
    ['c', 12, 32, 3, 'palCoralPink'], ['c', 50, 33, 2.6, 'palCoralFan'] ] },
  goreme: { tint: 'gorSkyLow', s: [
    ['r', 0, 0, 64, 40, 'gorSkyLow'], ['r', 0, 29, 64, 11, 'gorTuff'],
    ['p', '8,30 12,13 16,30', 'gorTuffPale'], ['p', '6,14 18,14 12,9', 'gorTuffDk'],
    ['p', '20,30 23,18 26,30', 'gorTuffRose'],
    ['c', 45, 10, 6.5, 'gorEnvA'], ['r', 44, 17, 2, 2.2, 'gorBasket'],
    ['c', 56, 19, 4, 'gorEnvC'], ['c', 34, 6, 3, 'gorEnvB'] ] },
  /* the WAVE has to be the mark, not the beach: this is the one place in the
     picker whose subject is the water rather than what is standing next to it.
     Three bands — deep, the face, and the white — and one pine for scale. */
  manly: { tint: 'manSea', s: [
    ['r', 0, 0, 64, 40, 'manSkyLow'], ['r', 0, 9, 64, 31, 'manSea'],
    ['p', '0,15 18,13 36,16 52,13 64,15 64,18 0,18', 'manSeaMid'],
    ['p', '0,24 12,19 26,17 38,21 52,18 64,20 64,29 0,29', 'manFace'],
    ['p', '12,19 26,17 38,21 34,24 24,21 15,23', 'manFoam'],
    ['p', '52,18 64,20 64,24 55,23', 'manFoam'],
    ['r', 0, 27, 64, 6, 'manFoamDim'],
    ['r', 0, 32, 64, 8, 'manSand'],
    ['r', 7.2, 14, 1.6, 18, 'manTrunk'],
    ['p', '2,22 8,10 14,22', 'manPine'], ['p', '3,29 8,18 13,29', 'manPine'] ] },
  /* green, brown water, and three saturated things on top of it, which is
     exactly what the place looks like from a metre off the ground */
  pantanal: { tint: 'panWater', s: [
    ['r', 0, 0, 64, 40, 'panSkyDusk'], ['r', 0, 14, 64, 26, 'panWater'],
    ['r', 0, 11, 64, 4, 'panForest'],
    ['p', '0,24 64,24 64,28 0,28', 'panGrass'],
    ['r', 6, 28, 9, 4, 'panLily'], ['r', 30, 30, 11, 4, 'panLily'],
    ['c', 46, 21, 2.6, 'panJabiru'], ['r', 45.4, 17, 1.2, 4, 'panJabiru'],
    ['c', 45.6, 16.5, 1.2, 'panJabiruHd'],
    ['c', 20, 22, 3, 'panCapy'], ['c', 27, 23, 2.4, 'panCapy'],
    ['c', 13, 23, 2.2, 'panCapyPup'] ] },
  /* THE ONLY DARK TILE ON THE SHELF, and it should be: it is the only chapter
     with no daylight in it. One shaft, one green thing under the shaft. */
  cave: { tint: 'cavRockDk', s: [
    ['r', 0, 0, 64, 40, 'cavRockDk'],
    ['p', '0,0 64,0 64,10 44,13 30,8 16,13 0,9', 'cavRock'],
    ['p', '26,0 40,0 46,40 22,40', 'cavShaft'],
    ['p', '28,2 38,2 42,34 25,34', 'cavShaftLo'],
    ['p', '24,40 30,26 36,40', 'cavJungle'], ['p', '34,40 39,30 44,40', 'cavJungleLt'],
    ['p', '4,40 9,24 14,40', 'cavCalcite'], ['p', '52,40 57,28 62,40', 'cavRockLt'],
    ['c', 17, 20, 1.1, 'cavGlow'], ['c', 50, 17, 0.9, 'cavGlow'],
    ['c', 10, 14, 0.8, 'cavGlow'] ] },
  /* THE ONLY TILE ON THE SHELF WHOSE SUBJECT IS A DORSAL FIN, and it has to
     be: every other way of drawing Antarctica at 64 x 40 is a white
     rectangle. So: a pale sky, a white shelf across the top, cold water,
     and one black triangle coming out of it. */
  antarctic: { tint: 'antSea', s: [
    ['r', 0, 0, 64, 40, 'antSkyLow'],
    ['p', '0,15 12,9 26,13 40,7 52,12 64,9 64,20 0,20', 'antBergLt'],
    ['p', '0,17 12,12 26,15 40,11 52,14 64,12 64,20 0,20', 'antIceSh'],
    ['r', 0, 19, 64, 21, 'antSea'],
    ['r', 0, 26, 64, 14, 'antSeaDeep'],
    ['p', '2,24 9,20 16,24', 'antBergLt'], ['p', '50,23 57,19 64,23', 'antBergLt'],
    ['p', '26,34 30,17 34,34', 'antOrca'],
    ['r', 22, 33, 18, 3, 'antOrca'],
    ['r', 24, 34.6, 9, 1.2, 'antOrcaSaddle'],
    ['p', '44,38 52,34 60,38 52,36', 'antHull'] ] },
};
const sysMARK_NS = 'http://www.w3.org/2000/svg';

/** The wash behind a tile, or a neutral for a chapter with no scene. */
function sysMarkTint(biome, alpha) {
  const def = sysMARKS[biome];
  const key = def && def.tint;
  const c = (key !== undefined && PALETTE[key] !== undefined) ? PALETTE[key] : PALETTE.stone;
  return sysRgba(c, alpha);
}

/** One place mark as an <svg>, or null for a biome with no scene authored. */
function sysBuildMark(biome) {
  const def = sysMARKS[biome];
  if (!def) return null;
  const svg = document.createElementNS(sysMARK_NS, 'svg');
  svg.setAttribute('viewBox', sysMARK_VB);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  for (let i = 0; i < def.s.length; i++) {
    const sh = def.s[i];
    // A missing palette key must not punch a black hole in the picker: every
    // colour is looked up and falls back to the paper stone.
    const raw = PALETTE[sh[sh.length - 1]];
    const col = sysHex(raw !== undefined ? raw : PALETTE.stone);
    let n;
    if (sh[0] === 'r') {
      n = document.createElementNS(sysMARK_NS, 'rect');
      n.setAttribute('x', sh[1]); n.setAttribute('y', sh[2]);
      n.setAttribute('width', sh[3]); n.setAttribute('height', sh[4]);
    } else if (sh[0] === 'c') {
      n = document.createElementNS(sysMARK_NS, 'circle');
      n.setAttribute('cx', sh[1]); n.setAttribute('cy', sh[2]); n.setAttribute('r', sh[3]);
    } else {
      n = document.createElementNS(sysMARK_NS, 'polygon');
      n.setAttribute('points', sh[1]);
    }
    n.setAttribute('fill', col);
    svg.appendChild(n);
  }
  return svg;
}

function sysEl(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function sysEnableShadows(o3d) {
  o3d.traverse(function (n) {
    if (n.isMesh) n.castShadow = true;
  });
}
function sysFmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ':' + (r < 10 ? '0' : '') + r;
}
function sysMaxDPR() {
  const px = window.innerWidth * window.innerHeight *
    Math.pow(Math.min(window.devicePixelRatio || 1, 2), 2);
  if (px > 2200000) return 1.15;
  if (px > 1300000) return 1.4;
  return 1.75;
}
function sysWrapPi(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
/** damp() on the shortest arc — a heading may never take the long way round. */
function sysDampAngle(cur, tgt, lambda, dt) {
  return cur + sysWrapPi(tgt - cur) * (1 - Math.exp(-lambda * dt));
}
/**
 * True when (x, y, z) is inside a SAIL — not merely inside the podium's bounding
 * box. Returns the height the eye would have to clear to get over the vault it
 * is stuck in, or 0 when the point is in clear air. Zero allocation.
 */
function sysOperaClear(x, y, z) {
  if (y < sysOPERA_DECK) return 0;              // under the deck: not a sail
  let top = 0;
  for (let i = 0; i < sysOPERA_VAULTS.length; i += 4) {
    const cx = sysOPERA_VAULTS[i], cz = sysOPERA_VAULTS[i + 1];
    const W = sysOPERA_VAULTS[i + 2], H = sysOPERA_VAULTS[i + 3];
    const peak = sysOPERA_DECK + H * 1.58;
    if (y > peak) continue;
    const L = H * sysOPERA_LEAN;
    // semi-axes: half the chord across, the lean plus a third of the rise along
    const a = W * 0.55 + sysOPERA_MARG;
    const b = L + H * 0.30 + sysOPERA_MARG;
    const dx = x - cx, dz = z - (cz - L * 0.40);
    const u = dx / a, w = dz / b;
    if (u * u + w * w >= 1) continue;
    if (peak > top) top = peak;
  }
  return top;
}
function sysInOpera(x, y, z) { return sysOperaClear(x, y, z) > 0; }

// =========================================================================
// THE MINIMAP
// =========================================================================
// A chart, not a radar. North is up and it never rotates, because the whole
// point is to give the player a fixed mental picture of a place they are
// walking around in — a map that spins with the camera teaches nothing.
//
// The base layer (water, land, relief) is BAKED ONCE per biome by sampling the
// live biome's own terrainHeight/isOverWater, so it can never disagree with the
// world; per-frame work is a blit and a dozen dots. Landmarks are read live from
// each biome's published API rather than copied here, so they cannot drift out
// of date when a world moves something.
const sysMAP_PX = 104;              // baked resolution — deliberately soft
const sysMAP_HZ = 12;               // redraws a second
const sysMAP_TRAIL = 64;            // breadcrumbs kept
const sysMAP_TRAIL_D = 3.0;         // metres between them — distance, not time
const sysMAP_TRAIL_BANDS = 3;       // age bands the track fades through
const sysMAP_ROSE = 4;              // ticks on the compass rose (N E S W)

const sysMAP_WORLDS = {
  // Sydney publishes zones rather than landmarks, so these come from the world
  // layout table in the contract.
  sydney: { x0: -80, x1: 80, z0: -44, z1: 76, pad: 4, marks: [
    { x: 0, z: -4, k: 'star', t: 'Opera House' },
    { x: 38, z: 30, k: 'leaf', t: 'gardens' },
    { x: 30, z: 26, k: 'dot', t: 'picnic' },
    { x: -38, z: 10, k: 'dot', t: 'promenade' },
    { x: -34, z: -62, k: 'faint', t: 'the Bridge' },
  ] },
  quay: { x0: -150, x1: 290, z0: -600, z1: 70, pad: 10, marks: [
    { get: 'SPAWN', k: 'dot', t: 'Circular Quay' },
    { x: 0, z: -58, k: 'faint', t: 'the Bridge' },
    // Bennelong Point. It is the biggest thing on the chart after the Bridge and
    // the only landmark in the chapter you can climb out onto, and the map had
    // never heard of it because until now it was not drawn.
    { x: 78, z: 6, k: 'star', t: 'the Opera House' },
    { get: 'MANLY', k: 'star', t: 'Manly' },
    { get: 'boat', k: 'boat', t: 'the ferry' },
    { get: 'freshwater', k: 'boat', t: 'the big ferry' },
    { x: 118, z: -586, k: 'dot', t: 'the Corso' },
  ] },
  pasto: { x0: -115, x1: 115, z0: -115, z1: 115, pad: 6, marks: [
    { get: 'craterCentre', k: 'star', t: 'Galeras' },
    { get: 'bell', k: 'dot', t: 'the church' },
    { get: 'coffeePatio', k: 'leaf', t: 'the coffee farm' },
    { get: 'carroza', k: 'boat', t: 'the carroza' },
    { x: 0, z: 26, k: 'dot', t: 'the plaza' },
    { x: 0, z: -66, k: 'faint', t: 'the road up' },
  ] },
  kyoto: { x0: -100, x1: 60, z0: -70, z1: 215, pad: 8, marks: [
    { get: 'toriiStart', k: 'star', t: 'the gates' },
    { get: 'pond', k: 'water', t: 'the golden pond' },
    { get: 'zen', k: 'dot', t: 'the rock garden' },
    { get: 'bamboo', k: 'leaf', t: 'the grove' },
    { get: 'uji', k: 'dot', t: 'Uji' },
    { get: 'mill', k: 'dot', t: 'the mill' },
    { get: 'bowl', k: 'star', t: 'the great bowl' },
  ] },
  cali: { x0: -135, x1: 130, z0: -110, z1: 70, pad: 8, marks: [
    { get: 'gato', k: 'dot', t: 'the cat' },
    { get: 'ermita', k: 'star', t: 'La Ermita' },
    { get: 'chiva', k: 'dot', t: 'the chiva stop' },
    { get: 'mirador', k: 'star', t: 'the mirador' },
    { get: 'floor', k: 'star', t: 'the dance floor' },
    { get: 'cristo', k: 'peak', t: 'Cristo Rey' },
    { get: 'cane', k: 'leaf', t: 'the cane' },
  ] },
  iceland: { x0: -120, x1: 130, z0: -210, z1: 150, pad: 8, marks: [
    { get: 'pylsa', k: 'dot', t: 'the hot dog stand' },
    { get: 'church', k: 'star', t: 'Hallgrimskirkja' },
    { get: 'strokkur', k: 'dot', t: 'Strokkur' },
    { get: 'spring', k: 'water', t: 'the hot spring' },
    { get: 'glacierTop', k: 'peak', t: 'the top of the ice' },
    { get: 'cliff', k: 'dot', t: 'the puffins' },
    { get: 'pier', k: 'boat', t: 'the old harbour' },
  ] },
  sahara: { x0: -90, x1: 350, z0: -110, z1: 100, pad: 8, marks: [
    { get: 'cart', k: 'dot', t: 'the orange cart' },
    { get: 'koutoubia', k: 'star', t: 'the Koutoubia' },
    { get: 'souk', k: 'dot', t: 'the souk' },
    { get: 'gate', k: 'faint', t: 'Bab Agnaou' },
    { get: 'camp', k: 'star', t: 'the camp' },
    { get: 'duneTop', k: 'peak', t: 'the great dune' },
  ] },
  // The only map in the game where most of the rectangle is nothing at all,
  // which is honest: it IS mostly nothing.
  drift: { x0: -110, x1: 110, z0: -180, z1: 60, pad: 8, marks: [
    { get: 'lamp', k: 'dot', t: 'the lamp' },
    { get: 'jetty', k: 'boat', t: 'the end of the jetty' },
    { get: 'column', k: 'peak', t: 'the first column' },
    { get: 'orchard', k: 'leaf', t: 'the orchard' },
    { get: 'arch', k: 'faint', t: 'the Long Gap' },
    { get: 'column2', k: 'peak', t: 'the second column' },
    { get: 'crown', k: 'star', t: 'the lantern' },
  ] },
  // Venice. The one map in the game where the WATER is the thing that moves,
  // and the bake is redone as the tide changes — see sysMapBake's tide watch.
  venice: { x0: -160, x1: 60, z0: -80, z1: 60, pad: 8, marks: [
    { get: 'campanile', k: 'peak', t: 'the campanile' },
    { get: 'basilica', k: 'star', t: 'San Marco' },
    { get: 'cafe', k: 'dot', t: 'the caffe' },
    { get: 'molo', k: 'boat', t: 'the two columns' },
    { get: 'rialto', k: 'star', t: 'the Rialto' },
    { get: 'campo', k: 'dot', t: 'the campo' },
    { get: 'gondola', k: 'boat', t: 'the gondola' },
  ] },
  kowloon: { x0: -60, x1: 60, z0: -170, z1: 70, pad: 8, marks: [
    { get: 'bakery', k: 'dot', t: 'the bakery' },
    { get: 'scaffold', k: 'peak', t: 'the bamboo' },
    { get: 'poles', k: 'faint', t: 'the poles' },
    { get: 'market', k: 'dot', t: 'the wet market' },
    { get: 'sign', k: 'star', t: 'the big sign' },
    { get: 'roof', k: 'star', t: 'the roof' },
    { get: 'pier', k: 'boat', t: 'the Star Ferry' },
    { get: 'ferry', k: 'boat', t: 'the ferry' },
  ] },
  // Palawan. The one map in the game where the interesting half of the world
  // is UNDER the blue — so the water shading, which everywhere else is a nicety,
  // is here the actual terrain read-out.
  palawan: { x0: -80, x1: 80, z0: -145, z1: 70, pad: 8, marks: [
    { get: 'jetty', k: 'boat', t: 'the jetty' },
    { get: 'reef', k: 'leaf', t: 'the coral' },
    { get: 'wreck', k: 'faint', t: 'the wreck' },
    { get: 'clam', k: 'dot', t: 'the clam' },
    { get: 'foot', k: 'dot', t: 'the landing' },
    { get: 'crack', k: 'faint', t: 'the crack' },
    { get: 'lagoon', k: 'star', t: 'the lagoon' },
    { get: 'cathedral', k: 'star', t: 'the cathedral' },
  ] },
  // Cappadocia. Almost nothing on it, which is right — the chapter's geography
  // is vertical and a plan view is the one projection that cannot show that.
  // What it IS good for is the only thing it is asked to do: where is the
  // truck, and where am I relative to it.
  goreme: { x0: -90, x1: 110, z0: -120, z1: 70, pad: 8, marks: [
    { get: 'town', k: 'dot', t: 'Göreme' },
    { get: 'field', k: 'star', t: 'the launch field' },
    { get: 'tether', k: 'faint', t: 'the tethered one' },
    { get: 'chimney', k: 'peak', t: 'the tall chimney' },
    { get: 'cliff', k: 'dot', t: 'the dovecote' },
    { get: 'landing', k: 'star', t: 'the landing plain' },
  ] },
  rio: { x0: -110, x1: 120, z0: -70, z1: 100, pad: 8, marks: [
    { get: 'volei', k: 'dot', t: 'the net' },
    { get: 'arpoadorRock', k: 'star', t: 'Arpoador' },
    { get: 'sugarloaf', k: 'peak', t: 'Sugarloaf' },
    { get: 'station', k: 'dot', t: 'the cable car' },
    { get: 'selaron', k: 'star', t: 'the steps' },
    { get: 'corcovado', k: 'peak', t: 'Corcovado' },
  ] },
  // Manly. The one map in the game whose most useful mark is a piece of open
  // water: the gutter through the bank is invisible from the beach and it is
  // the fastest thing in the chapter.
  manly: { x0: -110, x1: 120, z0: -90, z1: 90, pad: 8, marks: [
    { get: 'flags', k: 'star', t: 'the flags' },
    { get: 'club', k: 'dot', t: 'the surf club' },
    { get: 'rip', k: 'water', t: 'the rip' },
    { get: 'bommie', k: 'peak', t: 'the bommie' },
    { get: 'pool', k: 'water', t: 'the ocean pool' },
    { get: 'shelly', k: 'dot', t: 'Shelly' },
    { get: 'boat', k: 'boat', t: 'the surfboat' },
  ] },
  pantanal: { x0: -130, x1: 130, z0: -130, z1: 110, pad: 8, marks: [
    { get: 'fazenda', k: 'dot', t: 'the fazenda' },
    { get: 'baia', k: 'water', t: 'the bay' },
    { get: 'nest', k: 'star', t: 'the jabiru tree' },
    { get: 'bridge', k: 'dot', t: 'the bad bridge' },
    { get: 'bank', k: 'star', t: 'the crossing' },
    { get: 'herd', k: 'leaf', t: 'the others' },
  ] },
  // Sơn Đoòng. Almost nothing on it, which is right — a plan view of a cave is
  // a corridor, and the whole point of the place is that it is vertical.
  cave: { x0: -80, x1: 80, z0: -200, z1: 80, pad: 8,
    pal: { lo: PALETTE.cavMud, mid: PALETTE.cavRock, hi: PALETTE.cavCalcite,
           wat: PALETTE.cavWaterLt, dp: PALETTE.cavWater }, marks: [
    { get: 'mouth', k: 'star', t: 'the entrance' },
    { get: 'river', k: 'water', t: 'the river' },
    { get: 'hand', k: 'peak', t: 'the big one' },
    { get: 'doline', k: 'star', t: 'the hole in the roof' },
    { get: 'wall', k: 'peak', t: 'the Great Wall' },
    { get: 'exit', k: 'dot', t: 'daylight' },
  ] },
  // Antarctica. The biggest rectangle in the game by a distance, and it has
  // to be: the chapter is eleven hundred metres long. Its own palette,
  // because the default green-and-sand read makes a snowfield look like a
  // paddock — and the WATER colours are the ones doing the work here, since
  // nine tenths of this map is sea.
  antarctic: { x0: -212, x1: 212, z0: -500, z1: 122, pad: 10,
    pal: { lo: PALETTE.antScree, mid: PALETTE.antIceSh, hi: PALETTE.antIceLt,
           wat: PALETTE.antSeaLt, dp: PALETTE.antSeaDeep }, marks: [
    { get: 'jetty', k: 'boat', t: 'the jetty' },
    { get: 'huts', k: 'dot', t: 'the station' },
    { get: 'colony', k: 'dot', t: 'the colony' },
    { get: 'whalers', k: 'faint', t: 'the whalers' },
    { get: 'glacierToe', k: 'peak', t: 'the glacier' },
    { get: 'gate', k: 'faint', t: 'the gate' },
    { get: 'berg', k: 'peak', t: 'the big berg' },
    { get: 'boat', k: 'boat', t: 'the tender' },
    { get: 'pod', k: 'star', t: 'the pod' },
  ] },
};

function sysBuildCSS() {
  const paper   = sysHex(PALETTE.sail);
  const paper2  = sysHex(PALETTE.sailShade);
  const ink     = sysHex(PALETTE.ibisHead);
  const inkSoft = sysRgba(PALETTE.ibisHead, 0.62);
  const inkFaint= sysRgba(PALETTE.ibisHead, 0.28);
  const accent  = sysHex(PALETTE.cloth1);
  const tick    = sysHex(PALETTE.leafC);
  const rule    = sysRgba(PALETTE.stoneDark, 0.55);
  const shadow  = sysRgba(PALETTE.screenShadow, 0.16);
  const shadow2 = sysRgba(PALETTE.screenShadow, 0.28);
  const veil    = sysRgba(PALETTE.fog, 0.78);
  const veil2   = sysRgba(PALETTE.skyBottom, 0.92);
  const water   = sysHex(PALETTE.water);
  const sand    = sysHex(PALETTE.sand);

  return [
'.capyui *{box-sizing:border-box;}',
'.capyui-font{font-family:"Trebuchet MS","Segoe UI",system-ui,sans-serif;}',
/* ---------- prefers-reduced-motion ----------
   Everything in this HUD that moves is a transition or a keyframe on opacity
   and transform, and all of it is decoration: the paper stamping itself, the
   place card sliding in, the journal fading up. A player who has asked their
   system for less motion gets the same information with none of it. The GAME
   is not covered by this and must not be — it is a physics sandbox, and the
   capybara moving is the content, not the presentation. */
'@media (prefers-reduced-motion: reduce){',
  '.capyui *{animation-duration:.01ms !important;animation-iteration-count:1 !important;',
    'transition-duration:.01ms !important;scroll-behavior:auto !important;}',
'}',

/* ---------- the journal ---------- */
'.capyui-jr{position:absolute;inset:0;z-index:62;display:flex;align-items:center;',
  'justify-content:center;pointer-events:none;opacity:0;background:' + veil + ';',
  'backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);',
  'transition:opacity .28s ease;padding:14px;}',
'.capyui-jr.show{opacity:1;pointer-events:auto;}',
'.capyui-jrcard{background:' + paper + ';border:1px solid ' + paper2 + ';border-radius:5px;',
  'box-shadow:0 18px 40px ' + shadow2 + ';padding:clamp(16px,3vw,28px) clamp(18px,3.4vw,36px);',
  'transform:rotate(-.5deg);max-width:660px;width:100%;max-height:92vh;overflow:auto;',
  'overscroll-behavior:contain;}',
'.capyui-jrcard h2{font-size:clamp(15px,3vw,21px);color:' + ink + ';font-weight:700;letter-spacing:-.01em;}',
'.capyui-jrsub{font-size:clamp(9px,2vw,11px);letter-spacing:.3em;text-transform:uppercase;',
  'color:' + accent + ';font-weight:700;margin-top:3px;}',
// A real <button>, so it is reset back to looking like a row of a list.
'.capyui-jrrow{display:grid;grid-template-columns:46px 1fr auto;gap:3px 10px;align-items:center;',
  'padding:7px 8px;border-radius:4px;margin-top:2px;border:1px solid transparent;',
  'width:100%;text-align:left;background:none;font:inherit;color:inherit;',
  'touch-action:manipulation;}',
'.capyui-jrrow.go{cursor:pointer;}',
'.capyui-jrrow.go:hover{background:' + veil2 + ';border-color:' + rule + ';}',
// :focus-visible, not :focus — a mouse click on a row should not leave a ring
// behind it, and the ring is a real outline rather than a border swap so it
// survives whatever the row's own border-color is doing.
'.capyui-jrrow:focus{outline:none;}',
'.capyui-jrrow:focus-visible{outline:2px solid ' + accent + ';outline-offset:2px;}',
'.capyui-jrrow.here{border-color:' + accent + ';}',
'.capyui-jrrow.locked{opacity:.36;}',
'.capyui-jrn{position:relative;display:block;width:44px;height:26px;}',
'.capyui-jrmark{position:absolute;inset:0;display:block;overflow:hidden;border-radius:3px;',
  'border:1px solid ' + rule + ';}',
'.capyui-jrmark svg{display:block;width:100%;height:100%;}',
'.capyui-jrkey{position:absolute;left:1px;top:1px;z-index:1;',
  'min-width:12px;height:12px;padding:0 2px;border-radius:2px;',
  'display:flex;align-items:center;justify-content:center;',
  'background:' + sysRgba(PALETTE.stoneDark, 0.84) + ';color:' + paper + ';',
  'font-size:9px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;}',
'.capyui-jrname{font-size:clamp(12px,2.5vw,15px);color:' + ink + ';font-weight:700;}',
'.capyui-jrtally{font-size:clamp(10px,2.1vw,12px);color:' + inkSoft + ';font-weight:700;white-space:nowrap;',
  'font-variant-numeric:tabular-nums;}',
'.capyui-jrsub{font-variant-numeric:tabular-nums;}',
'.capyui-jrtally.full{color:' + tick + ';}',
'.capyui-jrrec{grid-column:2 / 4;font-size:clamp(9px,1.9vw,11px);color:' + inkSoft + ';',
  'font-style:italic;margin-top:1px;}',
'.capyui-jrbar{grid-column:1 / 4;height:3px;border-radius:2px;background:' + inkFaint + ';margin-top:5px;}',
'.capyui-jrbar i{display:block;height:100%;border-radius:2px;background:' + tick + ';}',
'.capyui-jrfoot{margin-top:12px;font-size:clamp(9px,1.9vw,11px);color:' + inkSoft + ';',
  'font-weight:700;letter-spacing:.12em;text-transform:uppercase;text-align:center;}',
/* the controls, folded away under the board. A <details>, so the fold, the
   keyboard, the focus ring and the aria wiring all come for free. */
'.capyui-jrkeys{margin-top:12px;border-top:1px solid ' + inkFaint + ';padding-top:9px;}',
'.capyui-jrkeys summary{cursor:pointer;list-style:none;text-align:center;',
  'font-size:clamp(9px,1.9vw,11px);color:' + inkSoft + ';font-weight:700;',
  'letter-spacing:.12em;text-transform:uppercase;border-radius:3px;padding:2px 0;',
  'touch-action:manipulation;}',
/* The default disclosure triangle is hidden because it does not belong in this
   typography — so one has to be drawn back, or the row reads as a caption and
   nobody presses it. It rotates on open, on transform alone. */
'.capyui-jrkeys summary::-webkit-details-marker{display:none;}',
'.capyui-jrkeys summary::marker{content:"";}',
'.capyui-jrkeys summary:before{content:"\\25B8";display:inline-block;margin-right:7px;',
  'transition:transform .18s ease;transform-origin:50% 50%;}',
'.capyui-jrkeys[open] summary:before{transform:rotate(90deg);}',
'.capyui-jrkeys summary:hover{color:' + accent + ';}',
/* a ring, not a colour: a colour change alone is not a focus state */
'.capyui-jrkeys summary:focus-visible{color:' + accent + ';outline:2px solid ' + accent + ';',
  'outline-offset:2px;}',
'.capyui-jrkeys[open] summary{margin-bottom:9px;}',
'.capyui-jrkeys .capyui-legend{max-width:none;}',

/* ---------- title card ---------- */
/* align-items:flex-start, not center: a centred flex child that is TALLER than
   the flex line has both of its ends cut off and cannot be scrolled to, which
   is exactly what happened when the ninth chapter added a row to the picker —
   measured at 1280x720 the card ran from -146 to 866 and the last chapter was
   below the fold and unclickable. Start-aligned, the card's own scroller can
   reach all of it. */
'.capyui-title{position:absolute;inset:0;z-index:60;display:flex;align-items:flex-start;',
  'justify-content:center;pointer-events:auto;cursor:pointer;background:' + veil + ';',
  'overflow-y:auto;overscroll-behavior:contain;',
  'backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);',
  'transition:opacity .75s ease,transform .75s ease;padding:18px;}',
'.capyui-title.gone{opacity:0;transform:scale(1.06);pointer-events:none;}',
'.capyui-card{background:' + paper + ';border:1px solid ' + paper2 + ';border-radius:5px;',
  'box-shadow:0 18px 40px ' + shadow2 + ';padding:clamp(20px,4vw,40px) clamp(22px,5vw,54px);',
  'transform:rotate(-1deg);max-width:880px;width:100%;text-align:center;',
  /* centred when it fits, scrolled from the top when it does not */
  'margin:auto;}',
'.capyui-card h1{font-size:clamp(24px,6.2vw,46px);line-height:1.05;color:' + ink + ';',
  'text-wrap:balance;',
  'font-weight:700;letter-spacing:-.01em;}',
'.capyui-sub{margin-top:6px;font-size:clamp(11px,2.4vw,14px);letter-spacing:.42em;',
  'text-transform:uppercase;color:' + accent + ';font-weight:700;}',
'.capyui-rule{height:2px;background:' + rule + ';border-radius:2px;margin:clamp(14px,3vw,22px) auto;',
  'width:64%;transform:rotate(.4deg);}',
'.capyui-legend{display:grid;grid-template-columns:auto 1fr;gap:5px 12px;text-align:left;',
  'align-items:start;',
  'font-size:clamp(10px,2.3vw,13px);color:' + inkSoft + ';margin:0 auto;max-width:360px;}',
'@media (min-width:640px){.capyui-legend{grid-template-columns:auto 1fr auto 1fr;',
  'max-width:520px;gap:4px 14px;}}',
/* and on a short screen — a 720p laptop is the commonest window this game will
   ever open in — the chrome comes down so the tickets stay above the fold */
/* A 720p laptop is the commonest window this game will ever open in, and the
   picker is now thirteen pictures rather than thirteen lines of text — so the
   short-screen budget starts higher up and takes the scenes down with it. */
'@media (max-height:900px){.capyui-card{padding-top:clamp(10px,2vw,18px);',
  'padding-bottom:clamp(10px,2vw,18px);}',
  '.capyui-card h1{font-size:clamp(20px,4.4vw,32px);}',
  '.capyui-rule{margin:clamp(7px,1.4vw,11px) auto;}',
  '.capyui-sub{letter-spacing:.3em;}',
  '.capyui-legend{gap:2px 12px;font-size:clamp(9px,2vw,11px);}}',
'.capyui-legend kbd{color:' + ink + ';font-weight:700;white-space:nowrap;',
'font-family:inherit;font-size:inherit;background:none;border:0;padding:0;}',
'.capyui-begin{margin-top:clamp(12px,2.6vw,18px);font-size:clamp(10px,2.2vw,12px);',
  'color:' + inkSoft + ';font-weight:700;letter-spacing:.16em;text-transform:uppercase;',
  'animation:capyui-blink 1.7s ease-in-out infinite;}',
'@keyframes capyui-blink{0%,100%{opacity:.35}50%{opacity:1}}',
/* ---------- the two pages ---------- */
/* [hidden] is only display:none by a UA rule that ANY later display
   declaration outranks, and .capyui-page carries one - so the flag has to be
   restated here or both pages are in the flow at once and the card is twice as
   long as it was before the split. */
'.capyui-page{display:flex;flex-direction:column;}',
'.capyui-page[hidden]{display:none;}',
/* Page one is a column of five things and it should breathe: it is the only
   screen in this game with nothing on it that has to be scanned. Page two is a
   picker and wants every pixel it can get, so the card widens for it. */
'.capyui-p1{gap:0;}',
'.capyui-card{max-width:640px;}',
'.capyui-card.two{max-width:880px;}',
/* the page-two heading, which is an h1 doing an h2's job so the card still has
   exactly one top-level heading on whichever page is showing */
'.capyui-h2{font-size:clamp(16px,3.4vw,26px)!important;text-align:center;}',
/* ---------- page one: the six verbs ---------- */
/* THE LEGEND IS THE CONTENT OF THIS PAGE, not its footnote. On the old card it
   was 10-13px under a rule at the very bottom; here it is the thing the player
   came to read, so it is bigger, the keys are boxed like keys, and there are
   six of them. */
'.capyui-legbig{max-width:none!important;grid-template-columns:auto 1fr!important;',
  'gap:7px 14px;font-size:clamp(11px,2.4vw,14px);margin-top:clamp(6px,1.4vw,10px);}',
'@media (min-width:560px){.capyui-legbig{grid-template-columns:auto 1fr auto 1fr!important;',
  'gap:7px 16px;}}',
'.capyui-legbig kbd{display:inline-block;padding:2px 7px;border-radius:4px;',
  'background:' + paper2 + ';border:1px solid ' + rule + ';',
  'box-shadow:0 1px 0 ' + rule + ';font-size:.92em;}',
'.capyui-legsplit{grid-column:1 / -1;margin-top:7px;padding-top:6px;',
  'border-top:1px solid ' + inkFaint + ';font-size:.88em;font-weight:700;',
  'letter-spacing:.14em;text-transform:uppercase;color:' + inkSoft + ';}',
/* the extras, folded. Same disclosure furniture as the journal's own fold. */
'.capyui-more{margin-top:clamp(7px,1.5vw,11px);text-align:center;}',
'.capyui-more summary{cursor:pointer;list-style:none;display:inline-block;',
  'font-size:clamp(9px,1.9vw,11px);color:' + inkSoft + ';font-weight:700;',
  'letter-spacing:.12em;text-transform:uppercase;padding:3px 8px;border-radius:4px;',
  'touch-action:manipulation;}',
'.capyui-more summary::-webkit-details-marker{display:none;}',
'.capyui-more summary::marker{content:"";}',
'.capyui-more summary:before{content:"\\25B8";display:inline-block;margin-right:7px;',
  'transition:transform .18s ease;}',
'.capyui-more[open] summary:before{transform:rotate(90deg);}',
'.capyui-more summary:hover{color:' + accent + ';}',
'.capyui-more summary:focus-visible{color:' + accent + ';outline:2px solid ' + accent + ';',
  'outline-offset:2px;}',
'.capyui-more .capyui-legend{margin-top:9px;}',
/* ---------- page one: the one door ---------- */
/* The only accented, full-width, unmistakable thing on the page. A player who
   reads nothing else on this card can still not fail to find this. */
'.capyui-go{display:flex;flex-direction:column;align-items:center;gap:2px;',
  'width:100%;margin-top:clamp(12px,2.4vw,18px);padding:clamp(9px,1.8vw,13px) 18px;',
  'border-radius:6px;border:1px solid ' + accent + ';background:' + accent + ';',
  'color:' + paper + ';font:inherit;cursor:pointer;pointer-events:auto;',
  'touch-action:manipulation;box-shadow:0 4px 14px ' + shadow2 + ';',
  'transition:transform .16s ease,box-shadow .16s ease,filter .16s ease;}',
'.capyui-go b{font-size:clamp(13px,2.7vw,17px);font-weight:700;letter-spacing:.01em;}',
'.capyui-go i{font-style:normal;font-size:clamp(9px,1.9vw,11px);opacity:.82;',
  'letter-spacing:.08em;text-transform:uppercase;font-weight:700;}',
'.capyui-go:hover{transform:translateY(-2px);filter:brightness(1.06);',
  'box-shadow:0 7px 18px ' + shadow2 + ';}',
'.capyui-go:active{transform:translateY(0);}',
'.capyui-go:focus-visible{outline:2px solid ' + ink + ';outline-offset:3px;}',
'.capyui-go.alt{background:none;color:' + accent + ';box-shadow:none;',
  'border-color:' + rule + ';}',
'.capyui-go.alt:hover{border-color:' + accent + ';background:' + veil2 + ';filter:none;}',
'.capyui-go.alt i{opacity:.7;color:' + inkSoft + ';}',
/* ---------- page two: the way back ---------- */
'.capyui-back{align-self:flex-start;margin-bottom:clamp(4px,1vw,8px);',
  'padding:4px 12px 4px 8px;border-radius:999px;font:inherit;cursor:pointer;',
  'pointer-events:auto;touch-action:manipulation;',
  'background:none;border:1px solid ' + rule + ';color:' + inkSoft + ';',
  'font-size:clamp(9px,1.9vw,11px);font-weight:700;letter-spacing:.12em;',
  'text-transform:uppercase;transition:color .16s ease,border-color .16s ease;}',
'.capyui-back:before{content:"\\2190";margin-right:7px;}',
'.capyui-back:hover{color:' + accent + ';border-color:' + accent + ';}',
'.capyui-back:focus-visible{outline:2px solid ' + accent + ';outline-offset:2px;}',
/* On a short screen page two gets the shelf back that the old single card had
   to fight the legend for - there is nothing under it any more but one line. */
'@media (max-height:900px){.capyui-picks{max-height:clamp(150px,50vh,560px);}}',
/* ---------- the chapter picker (title card) ---------- */
/* A GRID, NOT A WRAP. Eleven torn tickets flex-wrapped into four ragged rows of
   different widths and pushed the last chapter below the fold on a 720p laptop.
   Fixed columns give every place the same shape, put the key badges in a
   straight line the eye can run down, and — the part that actually matters —
   make the card's height a function of ceil(n / columns) rather than of how the
   words happened to wrap. */
/* A BENTO WITH AN EXACT CELL COUNT. Thirteen tiles do not divide by three or
   four, and a grid that ends in a lonely orphan reads as a mistake. Chapter one
   spans 2x2 in a four-column grid, so the picker is 4 + 12 = sixteen cells and
   the last row is full. Two columns below 900px (chapter one spans the row),
   one column on a phone. */
'.capyui-picks{display:grid;grid-template-columns:1fr;gap:clamp(5px,1vw,8px);',
  'margin-top:clamp(6px,1.2vw,9px);text-align:left;',
  /* THE SHELF SCROLLS, THE CARD DOES NOT GROW. --cols is written per build by
     sysPickCols(); below 900px the column count is a function of the WIDTH
     rather than of the chapter count, because at 320px nothing else matters. */
  'max-height:clamp(150px,42vh,520px);overflow-y:auto;overscroll-behavior:contain;',
  'padding:2px;margin-left:-2px;margin-right:-2px;',
  'scrollbar-width:thin;scrollbar-color:' + rule + ' transparent;}',
'.capyui-picks::-webkit-scrollbar{width:7px;}',
'.capyui-picks::-webkit-scrollbar-thumb{background:' + rule + ';border-radius:4px;}',
'.capyui-picks::-webkit-scrollbar-track{background:transparent;}',
'@media (min-width:430px){.capyui-picks{grid-template-columns:repeat(2,1fr);}}',
'@media (min-width:640px){.capyui-picks{grid-template-columns:repeat(3,1fr);}}',
'@media (min-width:900px){.capyui-picks{grid-template-columns:repeat(var(--cols,5),1fr);}}',
/* ---- the hero: chapter one, out of the grid and across the card ---- */
'.capyui-pick.hero{flex-direction:row;align-items:stretch;margin-top:clamp(7px,1.4vw,11px);',
  /* a LETTERBOX, not a portrait: without a height the panel took whatever the
     body needed and the picture stretched to fill a box twice as tall as the
     shape it was drawn in */
  /* HEIGHT, not min-height, and it is measured rather than chosen: at 720p the
     body's own content came to 190 px and the whole card ran to 803 in a 720
     window, which put the control legend below the fold on the commonest
     screen this game will ever open in. Fixed, the card is 706. */
  'height:clamp(84px,13.5vh,124px);overflow:hidden;',
  'border-color:' + accent + ';box-shadow:0 3px 14px ' + shadow2 + ';}',
'.capyui-pick.hero .capyui-pickart{width:38%;flex:0 0 38%;aspect-ratio:auto;',
  'border-bottom:0;border-right:1px solid ' + rule + ';}',
'.capyui-pick.hero .capyui-pickbody{display:flex;flex-direction:column;justify-content:center;',
  'padding:clamp(8px,1.6vw,14px) clamp(10px,2vw,16px);min-height:0;}',
/* ...AND IT LOSES ITS FIXED HEIGHT WITH IT. The hero is 84-124 px tall with
   overflow:hidden, which is right when the picture is beside the words and
   clips the words off entirely once it is above them: measured at 390 px the
   hero tile showed the Opera House and no longer said 'Sydney'. */
'@media (max-width:520px){.capyui-pick.hero{flex-direction:column;height:auto;}',
  '.capyui-pick.hero .capyui-pickart{width:100%;flex:none;aspect-ratio:64/22;',
  'border-right:0;border-bottom:1px solid ' + rule + ';}}',
'.capyui-pick{display:flex;flex-direction:column;height:100%;position:relative;',
  'cursor:pointer;pointer-events:auto;width:100%;text-align:left;overflow:hidden;',
  'font:inherit;color:inherit;touch-action:manipulation;',
  'background:' + paper2 + ';border:1px solid ' + rule + ';border-radius:6px;',
  'padding:0;',
  'transition:border-color .16s ease,transform .16s ease,box-shadow .16s ease;}',
'.capyui-pick:hover,.capyui-pick:focus-visible{border-color:' + accent + ';',
  'transform:translateY(-2px);box-shadow:0 6px 16px ' + shadow2 + ';}',
'.capyui-pick:active{transform:translateY(0);}',
'.capyui-pick:focus-visible{outline:2px solid ' + accent + ';outline-offset:2px;}',
/* the place itself: a flat-shaded scene in the chapter's own palette */
'.capyui-pickart{display:block;position:relative;width:100%;aspect-ratio:64 / 26;',
  'overflow:hidden;border-bottom:1px solid ' + rule + ';}',
'.capyui-pick.hero .capyui-pickart{aspect-ratio:auto;}',
'.capyui-pickart svg{display:block;width:100%;height:100%;',
  'transition:transform .35s cubic-bezier(.16,1,.3,1);}',
'.capyui-pick:hover .capyui-pickart svg,.capyui-pick:focus-visible .capyui-pickart svg{',
  'transform:scale(1.045);}',
/* the key badge sits ON the scene, so the eye can still run straight down it */
'.capyui-pickkey{position:absolute;top:5px;left:5px;',
  'display:flex;align-items:center;justify-content:center;',
  'min-width:clamp(16px,3.2vw,19px);height:clamp(16px,3.2vw,19px);padding:0 3px;',
  'border-radius:3px;background:' + sysRgba(PALETTE.stoneDark, 0.82) + ';',
  'color:' + paper + ';font-weight:700;',
  'font-size:clamp(9px,1.9vw,11px);font-variant-numeric:tabular-nums;}',
'.capyui-pick:hover .capyui-pickkey,.capyui-pick:focus-visible .capyui-pickkey{',
  'background:' + accent + ';}',
'.capyui-pickbody{min-width:0;flex:1 1 auto;',
  'padding:clamp(5px,1.1vw,7px) clamp(7px,1.4vw,9px) clamp(6px,1.2vw,8px);}',
'.capyui-pick b{display:block;font-size:clamp(11.5px,2.2vw,13.5px);font-weight:700;',
  /* a place name is authored text and is never longer than this, but a tile is
     150 px wide at five columns and a container that cannot break a word is a
     container that will one day be overflowed by one */
  'overflow-wrap:anywhere;',
  'color:' + ink + ';line-height:1.15;}',
'.capyui-pick.hero b{font-size:clamp(15px,3vw,21px);}',
/* TWO LINES, ALWAYS. The subtitles run from three words to nine, and left to
   themselves they made every tile a different height — so the shelf was a
   ragged wall of boxes and the eye had nothing straight to run down. Clamped,
   with a floor under the body, every tile in the grid is the same object. */
'.capyui-pick i{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;',
  'overflow:hidden;margin-top:2px;font-style:normal;line-height:1.25;',
  'font-size:clamp(8.5px,1.7vw,10.5px);color:' + sysRgba(PALETTE.ibisHead, 0.82) + ';}',
'.capyui-picks .capyui-pickbody{min-height:clamp(40px,7vw,48px);}',
'.capyui-pick.hero i{-webkit-line-clamp:3;}',
'.capyui-pick.hero i{font-size:clamp(10px,2vw,12.5px);margin-top:3px;}',
'.capyui-pickrec{display:block;margin-top:3px;font-style:normal;font-weight:700;',
  'font-size:clamp(8.5px,1.7vw,10.5px);color:' + accent + ';',
  'font-variant-numeric:tabular-nums;}',
'.capyui-pickfirst{display:block;margin-top:6px;font-style:normal;font-weight:700;',
  'font-size:clamp(9px,1.8vw,11px);letter-spacing:.1em;text-transform:uppercase;',
  'color:' + accent + ';}',
/* the tally rides the bottom-right corner of the scene, clear of the words */
'.capyui-picktally{position:absolute;top:5px;right:5px;',
  'font-size:clamp(8.5px,1.7vw,10px);color:' + paper + ';',
  'background:' + sysRgba(PALETTE.stoneDark, 0.72) + ';border-radius:3px;padding:1px 4px;',
  'font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap;}',
'.capyui-picktally.full{background:' + tick + ';}',
/* The short-screen budget for the scenes, and it MUST live after the rules it
   overrides: same specificity, so source order is the whole argument. Written
   up in the title-card block first, where it was outranked by the picker's own
   aspect-ratio further down the sheet and did nothing at all. */
'@media (max-height:900px){.capyui-pickart{aspect-ratio:64 / 19;}',
  '.capyui-pick.hero .capyui-pickart{aspect-ratio:auto;}}',
'@media (max-height:770px){.capyui-pickart{aspect-ratio:64 / 15;}',
  '.capyui-pick.hero .capyui-pickart{aspect-ratio:auto;}',
  '.capyui-pickbody{padding:4px 7px 5px;}}',
/* The places arrive one after another, which is the only motion on the card and
   is doing one job: it walks the eye across the shelf so the player sees that
   there are THIRTEEN of them rather than reading the first one and clicking it.
   --i is set per tile in the picker loop. Wrapped in no-preference, and the
   whole thing is a plain end-state under reduced motion. */
'@media (prefers-reduced-motion: no-preference){',
  '.capyui-pick{opacity:0;animation:capyui-deal .42s cubic-bezier(.16,1,.3,1) forwards;',
  'animation-delay:calc(var(--i,0) * 34ms + 120ms);}}',
'@keyframes capyui-deal{from{opacity:0;transform:translateY(9px) scale(.985);}',
  'to{opacity:1;transform:none;}}',
/* ---- carry on: the one accented control on the card ---- */
'.capyui-carry{display:flex;align-items:center;justify-content:space-between;gap:12px;',
  'width:100%;margin-top:clamp(10px,2vw,15px);cursor:pointer;pointer-events:auto;',
  'font:inherit;text-align:left;touch-action:manipulation;',
  'background:' + accent + ';border:1px solid ' + accent + ';border-radius:4px;',
  'padding:clamp(7px,1.5vw,11px) clamp(10px,2vw,15px);',
  'transition:transform .12s ease,filter .12s ease;}',
'.capyui-carry:hover,.capyui-carry:focus-visible{transform:translateY(-1px);',
  'filter:brightness(1.08);}',
'.capyui-carry:focus-visible{outline:2px solid ' + ink + ';outline-offset:2px;}',
'.capyui-carryl{min-width:0;}',
'.capyui-carryl b{display:block;font-size:clamp(13px,2.6vw,17px);font-weight:700;',
  'color:' + paper + ';line-height:1.15;}',
'.capyui-carryl i{display:block;margin-top:1px;font-style:normal;',
  'font-size:clamp(9px,1.8vw,11px);color:' + paper + ';opacity:.82;}',
'.capyui-carryn{font-size:clamp(12px,2.3vw,15px);font-weight:700;color:' + paper + ';',
  'font-variant-numeric:tabular-nums;white-space:nowrap;}',
'.capyui-label{margin-top:clamp(9px,1.8vw,14px);font-size:clamp(8.5px,1.7vw,10.5px);',
  'letter-spacing:.2em;text-transform:uppercase;color:' + accent + ';font-weight:700;',
  'text-align:left;}',
/* ---------- P: the furniture off the window ----------
   Named element by element rather than as "everything under #hud", because the
   things that must SURVIVE it are the point: a place card, a moment card, a
   toast and the white of a crossing are the game talking to you, and a game
   that could swallow its own marquee moment would be a trap rather than a
   feature. Opacity and a transition, so it is a fade rather than a flicker. */
'#hud.bare .capyui-todo,#hud.bare .capyui-map,#hud.bare .capyui-stam,',
'#hud.bare .capyui-fly,#hud.bare .capyui-perf,#hud.bare .capyui-home{',
  'opacity:0 !important;pointer-events:none !important;}',
/* the on-screen stick is display-driven and its children opt back into the
   pointer themselves, so it goes out of the layout rather than to zero alpha */
'#hud.bare .capyui-touch{display:none !important;}',

/* ---------- to-do list ---------- */
'.capyui-todo{position:absolute;left:14px;top:12px;width:clamp(172px,32vw,278px);',
  'background:' + paper + ';border-radius:3px;padding:10px 12px 12px;transform:rotate(-1.7deg);',
  'box-shadow:0 8px 18px ' + shadow + ';border:1px solid ' + paper2 + ';',
  'transition:opacity .5s ease;opacity:0;}',
'.capyui-todo.show{opacity:1;}',
'.capyui-todo:before{content:"";position:absolute;left:14%;right:14%;top:-7px;height:14px;',
  'background:' + sand + ';opacity:.85;transform:rotate(-1.2deg);border-radius:2px;',
  'box-shadow:0 2px 4px ' + shadow + ';}',
'.capyui-todo.grow{animation:capyui-grow .7s cubic-bezier(.2,1.5,.35,1);}',
'@keyframes capyui-grow{0%{transform:rotate(-1.7deg) scale(1)}',
  '35%{transform:rotate(-1.1deg) scale(1.045)}100%{transform:rotate(-1.7deg) scale(1)}}',
/* the card takes the hit when a task lands — a stamp, not a wobble */
'.capyui-todo.stamp{animation:capyui-stamp .44s cubic-bezier(.2,1.8,.35,1);}',
'@keyframes capyui-stamp{0%{transform:rotate(-1.7deg) scale(1)}',
  '18%{transform:rotate(-.4deg) scale(1.075)}',
  '46%{transform:rotate(-2.3deg) scale(.986)}100%{transform:rotate(-1.7deg) scale(1)}}',
'.capyui-todo h2{font-size:clamp(10px,1.7vw,12px);letter-spacing:.3em;text-transform:uppercase;',
  'color:' + accent + ';font-weight:700;margin:4px 0 7px;}',
/* Five rows at the very most (see sysTODO_WINDOW), so the card is small enough
   to never need a scrollbar and never reach the touch stick. No max-height, no
   overflow, no scroll position to keep honest. */
'.capyui-todo ul{list-style:none;display:flex;flex-direction:column;gap:3px;}',
/* max-height is stated even at rest so the roll-up has something to animate FROM
   — a transition out of `none` is a snap. 4.2em clears a two-line row comfortably. */
'.capyui-task{display:flex;align-items:flex-start;gap:7px;font-size:clamp(9.5px,1.55vw,13px);',
  'line-height:1.28;color:' + ink + ';padding:1px 0;max-height:4.2em;}',
/* A row is the one thing on the paper you can touch: tapping it moves the arrow
   to that task (the pointer version of F). #hud is pointer-events:none, so this
   opts exactly four small rows in and nothing else — the canvas behind them
   keeps every drag, every grab and every right-click it had. */
'.capyui-task{pointer-events:auto;cursor:pointer;touch-action:manipulation;',
  '-webkit-tap-highlight-color:transparent;}',
'.capyui-task.done{cursor:default;}',
'@media (hover:hover){.capyui-task:hover .capyui-txt{color:' + accent + ';}}',
/* Out of the window is out of the FLOW: a zero-height row still collects the ul
   flex gap, and twenty-three of them would be 69 px of blank paper. */
'.capyui-hidden{display:none !important;}',
/* the roll-up a ticked row does on its way off the paper. The negative margin
   cancels the flex gap the collapsing row is still holding open. */
'.capyui-task.capyui-fold{max-height:0 !important;opacity:0;padding-top:0;padding-bottom:0;',
  'overflow:hidden;pointer-events:none;margin-top:-3px;',
  'transition:max-height .5s cubic-bezier(.4,0,.3,1),opacity .3s ease;}',
'.capyui-box{flex:0 0 auto;width:1.05em;height:1.05em;margin-top:.06em;border:1.6px solid ' + inkFaint + ';',
  'border-radius:3px;position:relative;transform:rotate(-2deg);}',
'.capyui-box:after{content:"\\2713";position:absolute;left:50%;top:48%;',
  'transform:translate(-50%,-50%) scale(0) rotate(-8deg);color:' + tick + ';',
  'font-size:1.35em;font-weight:700;line-height:1;}',
'.capyui-txt{position:relative;display:inline-block;}',
'.capyui-txt:after{content:"";position:absolute;left:-2px;right:-3px;top:52%;height:2px;',
  'background:' + ink + ';border-radius:2px;transform:scaleX(0) rotate(-1.1deg);',
  'transform-origin:left center;opacity:.75;}',
'.capyui-task.done{color:' + inkSoft + ';}',
'.capyui-task.done .capyui-box{border-color:' + tick + ';}',
'.capyui-task.done .capyui-box:after{animation:capyui-tick .42s cubic-bezier(.2,1.7,.4,1) forwards;}',
'.capyui-task.done .capyui-txt:after{animation:capyui-strike .34s ease-out .07s forwards;}',
'@keyframes capyui-tick{0%{transform:translate(-50%,-50%) scale(0) rotate(-24deg)}',
  '100%{transform:translate(-50%,-50%) scale(1) rotate(-8deg)}}',
'@keyframes capyui-strike{0%{transform:scaleX(0) rotate(-1.1deg)}',
  '100%{transform:scaleX(1) rotate(-1.1deg)}}',
'.capyui-count{margin-top:8px;font-size:clamp(9px,1.4vw,11px);letter-spacing:.16em;',
  'color:' + inkSoft + ';text-transform:uppercase;}',
/* ---------- the hint on the top row ---------- */
/* A bearing and a distance for whatever is next, plus one line naming the verb.
   Only ever on the first open row, so the card stays a to-do list and not a HUD. */
'.capyui-aim{flex:0 0 auto;margin-left:auto;display:flex;align-items:center;gap:4px;',
  'align-self:center;color:' + accent + ';font-weight:700;white-space:nowrap;',
  'font-size:clamp(8.5px,1.35vw,11px);font-variant-numeric:tabular-nums;opacity:0;',
  'transition:opacity .3s ease;}',
'.capyui-aim.on{opacity:1;}',
/* a paper chevron, drawn rather than typed so no font can fail to have it */
'.capyui-arrow{width:0;height:0;border-left:.34em solid transparent;',
  'border-right:.34em solid transparent;border-bottom:.56em solid ' + accent + ';',
  'transform-origin:50% 62%;transition:transform .12s linear;}',
'.capyui-clue{font-size:clamp(8.5px,1.4vw,11px);line-height:1.25;color:' + inkSoft + ';',
  'font-style:italic;padding:1px 0 2px 1.75em;max-height:3.2em;overflow:hidden;',
  'transition:max-height .3s ease,opacity .3s ease;}',
'.capyui-clue.off{max-height:0;opacity:0;padding:0;}',
/* the record board a finished chapter turns into: one number per line, and the
   numbers line up under each other because they are what is being compared */
'.capyui-clue.recs{white-space:pre-line;font-style:normal;font-weight:700;',
  'color:' + accent + ';font-variant-numeric:tabular-nums;line-height:1.45;}',

/* ---------- toast ---------- */
'.capyui-toasts{position:absolute;left:50%;bottom:clamp(74px,15vh,128px);transform:translateX(-50%);',
  'display:flex;flex-direction:column;align-items:center;gap:6px;width:min(88vw,460px);}',
'.capyui-toast{background:' + paper + ';color:' + ink + ';border:1px solid ' + paper2 + ';',
  'border-radius:999px;padding:7px 18px;font-size:clamp(11px,2.4vw,15px);font-weight:700;',
  'box-shadow:0 8px 18px ' + shadow + ';opacity:0;transform:translateY(16px) rotate(-.6deg);',
  'transition:opacity .3s ease,transform .3s cubic-bezier(.2,1.5,.4,1);text-align:center;}',
'.capyui-toast.in{opacity:1;transform:translateY(0) rotate(-.6deg);}',
'.capyui-toast.out{opacity:0;transform:translateY(-10px) rotate(-.6deg);}',

/* ---------- the moment card (a `mini` task) ---------- */
/* THE MIDDLE RUNG. A toast is a rounded pill at the bottom of the screen and a
   place card is full-bleed type across the middle of it, and for a hundred and
   sixteen tasks there was nothing between them — so a thing that took the
   player twenty-five seconds and a bit of nerve was paid out exactly like
   picking a sandwich up off a rug.
   It is deliberately the SAME PAPER as the toast rather than the place card's
   bare type: a mini moment is still a tick on the list, it is just a good one.
   Wider, held longer, and with the caption ABOVE the line instead of below it,
   so the composition reads as a smaller sibling of the banner and never as a
   bigger toast. */
'.capyui-moment{position:absolute;left:50%;top:36%;transform:translate(-50%,10px) rotate(-.7deg);',
  'z-index:57;pointer-events:none;text-align:center;background:' + paper + ';color:' + ink + ';',
  'border:1px solid ' + paper2 + ';border-radius:14px;padding:11px 26px 13px;',
  'width:max-content;max-width:min(86vw,520px);box-shadow:0 14px 30px ' + shadow + ';',
  'opacity:0;transition:opacity .45s ease,transform .45s cubic-bezier(.2,1.3,.4,1);}',
'.capyui-moment.show{opacity:1;transform:translate(-50%,0) rotate(-.7deg);}',
'.capyui-momentkick{font-size:clamp(9px,2vw,12px);letter-spacing:.3em;font-weight:700;',
  'text-transform:uppercase;color:' + accent + ';}',
'.capyui-momentrule{height:2px;width:min(22vw,110px);border-radius:2px;background:' + rule + ';',
  'margin:5px auto 6px;transform:rotate(.6deg);}',
'.capyui-momenttext{font-size:clamp(14px,3.6vw,25px);font-weight:700;line-height:1.12;',
  'letter-spacing:.02em;}',

/* ---------- perf ---------- */
'.capyui-perf{position:absolute;right:10px;top:10px;background:' + sysRgba(PALETTE.ibisHead, 0.72) + ';',
  'color:' + sysHex(PALETTE.sail) + ';font:11px/1.5 ui-monospace,Consolas,monospace;padding:6px 9px;',
  'border-radius:5px;display:none;white-space:pre;letter-spacing:.02em;}',
'.capyui-perf.show{display:block;}',

/* ---------- end flourish ---------- */
'.capyui-end{position:absolute;inset:0;z-index:55;display:flex;flex-direction:column;',
  'align-items:center;justify-content:center;gap:10px;background:' + veil2 + ';',
  'opacity:0;pointer-events:none;transition:opacity 1.1s ease;padding:20px;text-align:center;}',
'.capyui-end.show{opacity:1;}',
'.capyui-end h2{font-size:clamp(26px,8vw,68px);color:' + ink + ';letter-spacing:.06em;',
  'font-weight:700;transform:rotate(-1.4deg);}',
'.capyui-end .capyui-time{font-size:clamp(13px,3vw,20px);color:' + accent + ';font-weight:700;',
  'letter-spacing:.2em;text-transform:uppercase;}',
'.capyui-end .capyui-hint{margin-top:10px;font-size:clamp(11px,2.4vw,14px);color:' + inkSoft + ';',
  'animation:capyui-blink 2s ease-in-out infinite;}',

/* ---------- biome transition ---------- */
/* One full-screen chalk-white div. 0.8 s out, a held beat while the world is
   swapped underneath it, 0.8 s back in. Nothing else moves during the hold. */
'.capyui-fade{position:absolute;inset:0;z-index:70;background:' + sysHex(PALETTE.sail) + ';',
  'opacity:0;pointer-events:none;transition:opacity .8s ease;}',
'.capyui-fade.on{opacity:1;}',
'.capyui-place{position:absolute;left:0;right:0;top:31%;z-index:58;display:flex;',
  'flex-direction:column;align-items:center;gap:7px;pointer-events:none;text-align:center;',
  'padding:0 18px;opacity:0;transform:translateY(12px);',
  'transition:opacity .9s ease,transform .9s cubic-bezier(.2,1,.4,1);}',
'.capyui-place.show{opacity:1;transform:translateY(0);}',
'.capyui-place h2{font-size:clamp(24px,7.4vw,60px);color:' + ink + ';font-weight:700;',
  'letter-spacing:.09em;line-height:1.02;transform:rotate(-1.2deg);}',
'.capyui-placesub{font-size:clamp(10px,2.4vw,14px);letter-spacing:.34em;font-weight:700;',
  'text-transform:uppercase;color:' + accent + ';}',
'.capyui-placerule{height:2px;width:min(38vw,190px);border-radius:2px;background:' + rule + ';',
  'transform:rotate(.5deg);margin:2px 0;}',

/* ---------- flight readout ---------- */
/* Same paper-and-ink idiom as the to-do list, no new fonts, no gradients. Lives on
   the right edge at mid-height: clear of the perf block (top), the toasts (bottom
   centre / top right on a phone) and the whole touch fan (bottom right). */
'.capyui-fly{position:absolute;right:12px;top:50%;transform:translateY(-50%) rotate(1.1deg);',
  'width:clamp(94px,17vw,126px);background:' + paper + ';border:1px solid ' + paper2 + ';',
  'border-radius:3px;padding:8px 10px 9px;box-shadow:0 8px 18px ' + shadow + ';',
  'opacity:0;pointer-events:none;transition:opacity .45s ease;}',
'.capyui-fly.show{opacity:1;}',
'.capyui-flyk{font-size:clamp(7.5px,1.15vw,9px);letter-spacing:.24em;text-transform:uppercase;',
  'color:' + accent + ';font-weight:700;}',
'.capyui-flyv{font-size:clamp(14px,2.6vw,19px);font-weight:700;color:' + ink + ';line-height:1.15;',
  'font-variant-numeric:tabular-nums;}',
'.capyui-flyv small{font-size:.5em;letter-spacing:.1em;color:' + inkSoft + ';margin-left:3px;',
  'font-weight:700;}',
'.capyui-flybar{height:5px;border-radius:3px;background:' + inkFaint + ';margin:5px 0 8px;',
  'overflow:hidden;}',
'.capyui-flybar i{display:block;height:100%;width:0%;background:' + tick + ';border-radius:3px;',
  'transition:width .16s linear;}',
/* the thermal tell: a breathing arrow, never a klaxon */
'.capyui-therm{margin-top:8px;font-size:clamp(7.5px,1.15vw,9.5px);letter-spacing:.18em;',
  'text-transform:uppercase;font-weight:700;color:' + tick + ';opacity:0;transition:opacity .25s ease;}',
'.capyui-therm.on{opacity:1;animation:capyui-lift 1.15s ease-in-out infinite;}',
'@keyframes capyui-lift{0%,100%{opacity:.42;transform:translateY(1.5px)}',
  '50%{opacity:1;transform:translateY(-1.5px)}}',

/* ---------- minimap ----------
   Bottom right on a mouse, top right under a thumb, because on a touchscreen the
   bottom right corner is where the buttons live. */
/* WIDER. It was 94-132 px, which is a hundred metres of Venice or seven
   hundred of the harbour drawn across the width of a postage stamp, and every
   complaint about this chart reduces to not being able to see it. At 118-164
   it is still furniture rather than a screen, and every mark on it is half
   again as legible. */
'.capyui-map{position:absolute;right:16px;bottom:16px;width:clamp(118px,18vw,164px);',
  'aspect-ratio:1/1;border-radius:9px;overflow:hidden;background:' + paper + ';',
  'border:1px solid ' + paper2 + ';box-shadow:0 6px 16px ' + shadow + ';',
  'opacity:0;transition:opacity .5s ease;pointer-events:none;transform:rotate(.4deg);}',
'.capyui-map.show{opacity:.95;}',
'.capyui-map canvas{display:block;width:100%;height:100%;}',
/* The paper edge. A chart printed on the same stock as the to-do card and the
   place cards should look like it has been FOLDED INTO a corner of the screen,
   not composited over it — so the ink darkens toward the rim and there is a
   hairline of the card's own colour just inside the border. One element and two
   inset shadows: it has to be its own layer rather than a shadow on .capyui-map,
   because the canvas is a child and would paint straight over an inset shadow
   set on its parent. */
'.capyui-mapv{position:absolute;inset:0;pointer-events:none;border-radius:9px;',
  'box-shadow:inset 0 0 10px ' + sysRgba(PALETTE.screenShadow, 0.30) + ',',
  'inset 0 0 0 1px ' + sysRgba(PALETTE.sail, 0.55) + ';}',
'.capyui-mapn{position:absolute;left:50%;top:1px;transform:translateX(-50%);',
  'font-size:8px;font-weight:700;letter-spacing:.12em;color:' + inkSoft + ';',
  'text-shadow:0 1px 0 ' + sysRgba(PALETTE.sail, 0.8) + ';}',
/* On a phone the chart moves to the TOP right — which is exactly where a notch
   or a dynamic island is, so the offsets have to clear the inset rather than
   assume a rectangle. env() falls back to 0 on every browser that does not know
   it, so this is the same twelve pixels everywhere else. */
'@media (hover:none) and (pointer:coarse){.capyui-map{bottom:auto;',
  'top:calc(12px + env(safe-area-inset-top,0px));',
  'right:calc(12px + env(safe-area-inset-right,0px));',
  'width:clamp(92px,24vw,124px);}}',
/* ---------- how far, and to what ----------
   The card in the top left has carried the metres since the day it was built,
   and the chart in the bottom right has carried the direction - so answering
   'how much further' meant reading two opposite corners of the screen and
   holding one of them in your head. It is one number; it belongs under the
   arrow that is pointing at the thing. Absent, not zeroed, when there is
   nothing being pointed at. */
'.capyui-mapdist{position:absolute;left:50%;bottom:2px;transform:translateX(-50%);',
  'display:flex;align-items:center;gap:4px;max-width:94%;',
  'padding:1px 6px;border-radius:999px;background:' + sysRgba(PALETTE.sail, 0.86) + ';',
  'font-size:9px;font-weight:700;line-height:1.5;color:' + ink + ';',
  'font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;',
  'text-overflow:ellipsis;opacity:0;transition:opacity .3s ease;}',
'.capyui-mapdist.show{opacity:1;}',
'.capyui-mapdist i{flex:0 0 auto;width:6px;height:6px;border-radius:50%;',
  'background:' + accent + ';text-decoration:none;}',

/* ---------- stamina ----------
   Bottom left, thin, and ABSENT while it is full: a bar that is always on screen
   is furniture, a bar that appears exactly when the animal is spending something
   is information. */
'.capyui-stam{position:absolute;left:16px;bottom:16px;width:clamp(96px,17vw,148px);',
  'height:7px;border-radius:999px;background:' + sysRgba(PALETTE.ibisHead, 0.20) + ';',
  'box-shadow:0 2px 6px ' + shadow + ';overflow:hidden;opacity:0;pointer-events:none;',
  'transition:opacity .35s ease;}',
'.capyui-stam.show{opacity:1;}',
'.capyui-stam i{display:block;height:100%;width:100%;border-radius:999px;',
  'background:' + tick + ';transform-origin:0 50%;transition:background .25s ease;}',
'.capyui-stam.low i{background:' + accent + ';}',
'.capyui-stam.blown{animation:capyui-blink 0.9s ease-in-out infinite;}',

/* ---------- the way home ---------- */
'.capyui-home{position:absolute;left:50%;bottom:clamp(18px,5vh,44px);',
  'transform:translateX(-50%) rotate(-.5deg);display:flex;align-items:center;gap:10px;',
  'background:' + paper + ';border:1px solid ' + paper2 + ';border-radius:999px;padding:6px 15px;',
  'box-shadow:0 6px 14px ' + shadow + ';color:' + ink + ';font-weight:700;white-space:nowrap;',
  'font-size:clamp(10px,2vw,13px);opacity:0;pointer-events:none;transition:opacity .4s ease;}',
'.capyui-home.show{opacity:1;}',
'.capyui-dots{display:flex;gap:5px;}',
'.capyui-dots i{width:8px;height:8px;border-radius:50%;border:1.6px solid ' + inkFaint + ';',
  'transition:background .2s ease,border-color .2s ease;}',
'.capyui-dots i.on{background:' + tick + ';border-color:' + tick + ';}',

/* ---------- touch layer ---------- */
'.capyui-touch{position:absolute;inset:0;display:none;}',
'.capyui-touch.on{display:block;}',
'.capyui-zone{position:absolute;left:0;bottom:0;width:46%;height:62%;pointer-events:auto;',
  'touch-action:none;}',
'.capyui-base{position:absolute;width:118px;height:118px;margin:-59px 0 0 -59px;border-radius:50%;',
  'border:2px solid ' + sysRgba(PALETTE.sail, 0.7) + ';background:' + sysRgba(PALETTE.water, 0.16) + ';',
  'opacity:0;transition:opacity .18s ease;}',
'.capyui-base.on{opacity:.95;}',
'.capyui-knob{position:absolute;left:50%;top:50%;width:52px;height:52px;margin:-26px 0 0 -26px;',
  'border-radius:50%;background:' + sysRgba(PALETTE.sail, 0.88) + ';box-shadow:0 3px 8px ' + shadow + ';}',
'.capyui-btn{position:absolute;pointer-events:auto;touch-action:none;border-radius:50%;',
  'display:flex;align-items:center;justify-content:center;font-weight:700;color:' + ink + ';',
  'background:' + sysRgba(PALETTE.sail, 0.86) + ';border:2px solid ' + sysRgba(PALETTE.ibisHead, 0.18) + ';',
  'box-shadow:0 4px 12px ' + shadow + ';letter-spacing:.08em;transition:transform .09s ease;}',
'.capyui-btn.press{transform:scale(.9);background:' + sysRgba(PALETTE.cloth1, 0.9) + ';}',
'.capyui-wheek{right:18px;bottom:26px;width:96px;height:96px;font-size:15px;}',
'.capyui-grab{right:120px;bottom:96px;width:74px;height:74px;font-size:13px;}',
/* third button of the fan, outboard of GRAB — the hop. There is no fourth: the
   whistle folded into the wheek. */
'.capyui-hop{right:132px;bottom:22px;width:68px;height:68px;font-size:12px;}',

/* Phone: tighter leading and smaller tick boxes. Five rows fit anywhere, so the
   card no longer needs a scroll of its own at any size. */
'@media (max-width:560px){.capyui-todo{left:8px;top:8px;padding:8px 10px 9px;',
  'width:clamp(150px,44vw,210px);}',
  '.capyui-todo h2{margin:3px 0 5px;letter-spacing:.22em;}',
  '.capyui-todo ul{gap:1px;}',
  '.capyui-task{font-size:11px;line-height:1.16;padding:0;gap:5px;}',
  '.capyui-box{width:.95em;height:.95em;border-width:1.4px;}',
  '.capyui-count{margin-top:5px;}',
  '.capyui-task.capyui-fold{margin-top:-1px;}',
  '.capyui-fly{right:8px;width:84px;padding:6px 8px 7px;}',
  '.capyui-home{font-size:10px;padding:5px 12px;gap:8px;}',
  '.capyui-toasts{left:auto;right:8px;bottom:auto;top:8px;transform:none;',
  'align-items:flex-end;width:min(50vw,220px);}}',
'@media (max-height:520px){.capyui-task{font-size:10px;line-height:1.12;}}',
''
  ].join('');
}

// ---------------------------------------------------------------------------
export function createSystems(game) {
  const THREEx = game.THREE || THREE;
  const scene = game.scene;
  const camera = game.camera;
  const renderer = game.renderer;
  const canvas = game.canvas || renderer.domElement;
  // PCFSoft, back again and this time affordable. It was dropped for PCF on an
  // integrated-GPU target when the render was the whole frame budget; it is now
  // about a tenth of it, and the staircase along the edge of a palm shadow on
  // flat sand is the most obviously unfinished thing in a still of this game.
  renderer.shadowMap.type = THREEx.PCFSoftShadowMap;

  // =========================================================================
  // 1. LIGHTING
  // Lambert goes through BRDF_Lambert (x 1/PI), so intensities are scaled so a
  // fully lit surface reads ~1.2 albedo (sun-bleached) and open shade ~0.47.
  // =========================================================================
  const sun = new THREEx.DirectionalLight(PALETTE.sunLight, 2.3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(sysSHADOW_RES, sysSHADOW_RES);
  sun.shadow.bias = -0.0002;
  sun.shadow.normalBias = 0.02;
  const sc = sun.shadow.camera;
  sc.left = -sysSHADOW_HALF; sc.right = sysSHADOW_HALF;
  sc.top = sysSHADOW_TOP;    sc.bottom = -sysSHADOW_HALF;
  sc.near = sysSUN_DIST - 30; sc.far = sysSUN_DIST + 34;
  sc.updateProjectionMatrix();
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREEx.HemisphereLight(PALETTE.skyLight, PALETTE.groundLight, 1.35);
  hemi.position.set(0, 40, 0);
  scene.add(hemi);
  const amb = new THREEx.AmbientLight(PALETTE.sail, 0.12);
  scene.add(amb);

  // The horizontal fill. See sysFILL_K. No shadow, no target of its own worth
  // moving: a directional light is a direction, and the direction is set from
  // the sun's on every biome change.
  const fill = new THREEx.DirectionalLight(PALETTE.skyLight, 0.3);
  fill.castShadow = false;
  scene.add(fill);
  scene.add(fill.target);

  // The shadow frustum's DEPTH is per-biome: a flat harbour needs 64 units of it,
  // a 62 m volcano needs more than twice that. Swapped on biome:enter only.
  function shadowFitBiome(i) {
    sc.near = Math.max(1, sysSUN_DIST - sysBIO_SC_NEAR[i]);
    sc.far = sysSUN_DIST + sysBIO_SC_FAR[i];
    sc.updateProjectionMatrix();
    sun.shadow.radius = sysBIO_SH_RAD[i];
    sun.shadow.normalBias = sysBIO_SH_NB[i];
    // ...and the star itself changes. This is the other half of the plaza fix: a
    // 61-degree sun throws half the shadow a 41-degree one does. Swapped inside the
    // white hold of the biome fade, so nothing on screen ever sees it move.
    sunAxes(i ? sysPASTO_SUN_DIR : sysSUN_DIR);
  }

  // Rebuild the light-space basis from a sun direction. Called on biome change
  // only — never per frame — so the texel snap in sunFollow stays valid.
  function sunAxes(dir) {
    // Straight back through the subject from the other side, and lower: the
    // sun's azimuth reversed, flattened towards the horizon. That is what
    // makes it a kicker on the dark edge instead of a second key light.
    sysFillDir.set(-dir.x, sysFILL_LIFT, -dir.z).normalize();
    fill.position.copy(sysFillDir).multiplyScalar(60);
    fill.target.position.set(0, 0, 0);
    fill.target.updateMatrixWorld();
    sysAxDir.copy(dir);
    sysLightOff.copy(sysAxDir).multiplyScalar(sysSUN_DIST);
    sysAxRight.crossVectors(sysWorldUp, sysAxDir).normalize();
    sysAxUp.crossVectors(sysAxDir, sysAxRight).normalize();
  }

  // The box's WIDTH is per-altitude. On the ground it stays the tight 44-unit box
  // that keeps the texels small; from the condor it opens out so the valley the
  // player can actually see is still inside the shadow frustum. Hysteresis keeps
  // this to a handful of projection rebuilds per flight instead of one per frame.
  function shadowFitAlt(alt) {
    const half = clamp(sysSHADOW_HALF + alt * sysSHADOW_ALT_K, sysSHADOW_HALF, sysSHADOW_HALF_MAX);
    if (Math.abs(half - sysShadowHalf) < sysSHADOW_HYST) return;
    sysShadowHalf = half;
    sysShadowTop = half + 22;
    sc.left = -half; sc.right = half;
    sc.top = sysShadowTop; sc.bottom = -half;
    sysTexelX = (half * 2) / sysSHADOW_RES;
    sysTexelY = (sysShadowTop + half) / sysSHADOW_RES;
    sc.updateProjectionMatrix();
  }

  // Three-axis atmosphere: `d` is the time-of-day drift (driven by the tally, so
  // the afternoon warms as the list is ticked), `b` is the biome, Sydney -> Pasto,
  // and `alt` is 0..1 of the climb — it only ever pushes the haze back, and only in
  // Pasto (it is multiplied by `b`), so Sydney's numbers are untouched.
  // Nothing here allocates: every colour is written into a module-level scratch.
  function atmosApply(d, b, alt) {
    sysColA.copy(sysDAY_SUN_A).lerp(sysDAY_SUN_B, d * sysDAY_SUN_MIX).lerp(sysBIO_SUN_B, b);
    sun.color.copy(sysColA);
    sun.intensity = lerp(lerp(sysDAY_SUN_I[0], sysDAY_SUN_I[1], d), sysBIO_SUN_I, b);

    sysColA.copy(sysDAY_SKY_A).lerp(sysDAY_SKY_B, d * sysDAY_SKY_MIX).lerp(sysBIO_HEMI_B, b);
    hemi.color.copy(sysColA);
    sysColA.copy(sysDAY_GND_A).lerp(sysDAY_GND_B, d * sysDAY_GND_MIX).lerp(sysBIO_GND_B, b);
    hemi.groundColor.copy(sysColA);
    hemi.intensity = lerp(lerp(sysDAY_HEMI_I[0], sysDAY_HEMI_I[1], d), sysBIO_HEMI_I, b);
    amb.intensity = lerp(lerp(sysDAY_AMB_I[0], sysDAY_AMB_I[1], d), sysBIO_AMB_I, b);
    // the fill is bounce light and bounce light is the sky
    fill.color.copy(hemi.color);
    fill.intensity = hemi.intensity * sysFILL_K;

    // Sydney's haze warms toward the towel pink; the Andes pull it cool and pale.
    sysColA.copy(sysDAY_FOG_A).lerp(sysDAY_FOG_B, d * sysDAY_FOG_MIX);
    if (scene.fog) {
      sysColB.copy(sysColA).lerp(sysBIO_FOG_B, b);
      scene.fog.color.copy(sysColB);
      const ab = alt * b;
      scene.fog.near = lerp(lerp(sysDAY_FOG_N[0], sysDAY_FOG_N[1], d), sysBIO_FOG_N, b) + ab * sysALT_FOG_N;
      scene.fog.far = lerp(lerp(sysDAY_FOG_F[0], sysDAY_FOG_F[1], d), sysBIO_FOG_F, b) + ab * sysALT_FOG_F;
    }
    // environment.js carries its own sky dome; pasto.js does not, so in the Andes
    // the clear colour IS the sky and has to go all the way to andesSkyTop.
    if (scene.background && scene.background.isColor) {
      scene.background.copy(sysColA).lerp(sysBIO_BG_B, b);
    }
  }

  sunAxes(sysSUN_DIR);

  function sunFollow(px, py, pz) {
    // Quantise the shadow-camera centre to whole texels in light space so the
    // shadow map does not shimmer while the capybara walks.
    sysV1.set(px, py, pz);
    let a = sysV1.dot(sysAxRight);
    let b = sysV1.dot(sysAxUp);
    const c = sysV1.dot(sysAxDir);
    a = Math.round(a / sysTexelX) * sysTexelX;
    b = Math.round(b / sysTexelY) * sysTexelY;
    sysV2.set(0, 0, 0)
      .addScaledVector(sysAxRight, a)
      .addScaledVector(sysAxUp, b)
      .addScaledVector(sysAxDir, c);
    sun.target.position.copy(sysV2);
    sun.target.updateMatrixWorld();
    sun.position.copy(sysV2).add(sysLightOff);
    sun.updateMatrixWorld();
  }
  sunFollow(0, 0, 22);

  function registerShadowTarget(o3d) {
    if (!o3d) return;
    if (o3d.isObject3D) sysEnableShadows(o3d);
  }

  // =========================================================================
  // 1d. THE SKY DOME — see sysSKY_TOP. Biome-neutral, one draw call, ~1 100
  // vertices, and it is a SKYBOX: it rides the lens, it neither reads nor
  // writes depth, and it is drawn before everything else. That is why one
  // radius is correct for a four-hundred-metre far plane and a two-thousand-
  // two-hundred-metre one, and why nothing in any world can ever poke through it.
  // =========================================================================
  function sysBuildSky() {
    const g = new THREEx.SphereGeometry(sysSKY_R, 32, 18);
    const pos = g.attributes.position;
    sysSkyT = new Float32Array(pos.count);
    sysSkyCol = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) sysSkyT[i] = pos.getY(i) / sysSKY_R;
    g.setAttribute('color', new THREEx.BufferAttribute(sysSkyCol, 3));
    const m = mat(0xffffff, { vertexColors: true, side: THREEx.BackSide }).clone();
    m.fog = false;
    m.depthWrite = false;
    m.depthTest = false;
    // The gorBuildSky exemption, for the gorBuildSky reason: flat shading is
    // what makes every OBJECT here read as folded paper, and on a dome it turns
    // a gradient into thirty-two visible quads.
    m.flatShading = false;
    m.needsUpdate = true;
    const mesh = new THREEx.Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = -20;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.visible = false;              // Sydney owns its own; see sysSKY_OWN
    scene.add(mesh);
    sysSkyMesh = mesh;
  }
  sysBuildSky();

  /**
   * Repaint the dome from a horizon colour and a zenith colour.
   *
   * Above the horizon the ramp is `t^0.62`, which spends most of its travel in
   * the first fifteen degrees — that is where the atmosphere actually is, and a
   * linear ramp puts the interesting part of the gradient somewhere nobody at a
   * 41-degree camera pitch will ever look. Below it the horizon colour simply
   * darkens, so the dome has a floor rather than a seam if the rig is ever
   * pitched down over an edge.
   */
  function sysSkyPaint(hz, top) {
    const c = sysSkyCol, tArr = sysSkyT;
    const hr = hz.r, hg = hz.g, hb = hz.b;
    const tr = top.r, tg = top.g, tb = top.b;
    for (let i = 0, n = tArr.length; i < n; i++) {
      const y = tArr[i], o = i * 3;
      if (y >= 0) {
        const k = Math.pow(y, 0.62);
        c[o] = hr + (tr - hr) * k;
        c[o + 1] = hg + (tg - hg) * k;
        c[o + 2] = hb + (tb - hb) * k;
      } else {
        const k = 1 + y * 0.20;
        c[o] = hr * k; c[o + 1] = hg * k; c[o + 2] = hb * k;
      }
    }
    sysSkyMesh.geometry.attributes.color.needsUpdate = true;
    sysSkyLastA.copy(hz);
    sysSkyLastB.copy(top);
  }

  // =========================================================================
  // 1b. THE BEACON — a soft mark standing on wherever the next task is.
  // Built here, so it is biome-neutral (main.js's capture tag is clear by the
  // time systems is constructed) and survives a hemisphere change untouched.
  // Two meshes, no shadows, no per-frame allocation.
  // =========================================================================
  const beaconGroup = new THREEx.Group();
  beaconGroup.visible = false;
  const beaconMat = mat(PALETTE.cloth3, { transparent: true, opacity: 0.5, depthWrite: false });
  const beaconRing = new THREEx.Mesh(
    new THREEx.CylinderGeometry(0.85, 0.85, 0.06, 14, 1, true), beaconMat);
  beaconRing.castShadow = false; beaconRing.receiveShadow = false;
  beaconGroup.add(beaconRing);
  const beaconShaft = new THREEx.Mesh(
    new THREEx.CylinderGeometry(0.10, 0.26, sysHINT_Y * 2, 8, 1, true), beaconMat);
  beaconShaft.position.y = sysHINT_Y;
  beaconShaft.castShadow = false; beaconShaft.receiveShadow = false;
  beaconGroup.add(beaconShaft);
  beaconGroup.frustumCulled = false;
  scene.add(beaconGroup);

  // =========================================================================
  // 1c. CONFETTI — the visible half of a task landing.
  // Torn paper in the palette's own cloth colours, thrown from the capybara and
  // tumbling under gravity. One InstancedMesh, one draw call, pooled, and
  // biome-neutral like the beacon. Nothing is allocated per burst.
  // =========================================================================
  const sysCONF_MAX = 26;
  const confMesh = new THREEx.InstancedMesh(
    new THREEx.PlaneGeometry(0.11, 0.16),
    mat(PALETTE.sail, { side: THREEx.DoubleSide, transparent: true, opacity: 0.95, depthWrite: false }),
    sysCONF_MAX);
  confMesh.castShadow = false;
  confMesh.receiveShadow = false;
  confMesh.frustumCulled = false;
  confMesh.instanceMatrix.setUsage(THREEx.DynamicDrawUsage);
  confMesh.count = sysCONF_MAX;
  scene.add(confMesh);
  const confPos = new Float32Array(sysCONF_MAX * 3);
  const confVel = new Float32Array(sysCONF_MAX * 3);
  const confSpin = new Float32Array(sysCONF_MAX * 3);
  const confRot = new Float32Array(sysCONF_MAX * 3);
  const confLife = new Float32Array(sysCONF_MAX);
  const confCloth = [PALETTE.cloth1, PALETTE.cloth2, PALETTE.cloth3, PALETTE.cloth5,
                     PALETTE.cloth8, PALETTE.petalYellow];
  let confHead = 0, confAny = false, confDirty = true;
  const confM4 = new THREEx.Matrix4();
  const confQ = new THREEx.Quaternion();
  const confE = new THREEx.Euler();
  const confV = new THREEx.Vector3();
  const confS = new THREEx.Vector3(1, 1, 1);
  for (let i = 0; i < sysCONF_MAX; i++) {
    confLife[i] = 0;
    confMesh.setColorAt(i, sysColA.setHex(confCloth[i % confCloth.length]));
  }
  if (confMesh.instanceColor) confMesh.instanceColor.needsUpdate = true;

  function confettiBurst(x, y, z, n) {
    for (let k = 0; k < n; k++) {
      const i = confHead;
      confHead = (confHead + 1) % sysCONF_MAX;
      const a = rand(0, Math.PI * 2), sp2 = rand(1.4, 3.6);
      confPos[i * 3] = x + rand(-0.14, 0.14);
      confPos[i * 3 + 1] = y + rand(0.1, 0.45);
      confPos[i * 3 + 2] = z + rand(-0.14, 0.14);
      confVel[i * 3] = Math.cos(a) * sp2;
      confVel[i * 3 + 1] = rand(3.2, 5.4);
      confVel[i * 3 + 2] = Math.sin(a) * sp2;
      confSpin[i * 3] = rand(-9, 9);
      confSpin[i * 3 + 1] = rand(-9, 9);
      confSpin[i * 3 + 2] = rand(-9, 9);
      confRot[i * 3] = rand(0, 6.28);
      confRot[i * 3 + 1] = rand(0, 6.28);
      confRot[i * 3 + 2] = rand(0, 6.28);
      confLife[i] = rand(1.1, 1.8);
    }
    confAny = true;
    confDirty = true;
  }

  function confettiStep(dt) {
    if (!confAny && !confDirty) return;
    let any = false;
    for (let i = 0; i < sysCONF_MAX; i++) {
      if (confLife[i] <= 0) {
        if (confDirty) {
          confM4.compose(confV.set(0, -900, 0), confQ.identity(), confS.set(0, 0, 0));
          confMesh.setMatrixAt(i, confM4);
        }
        continue;
      }
      any = true;
      confLife[i] -= dt;
      confVel[i * 3 + 1] -= 11 * dt;               // paper falls slowly
      confVel[i * 3] *= 1 - 1.6 * dt;              // ...and air drags it
      confVel[i * 3 + 2] *= 1 - 1.6 * dt;
      confPos[i * 3] += confVel[i * 3] * dt;
      confPos[i * 3 + 1] += confVel[i * 3 + 1] * dt;
      confPos[i * 3 + 2] += confVel[i * 3 + 2] * dt;
      confRot[i * 3] += confSpin[i * 3] * dt;
      confRot[i * 3 + 1] += confSpin[i * 3 + 1] * dt;
      confRot[i * 3 + 2] += confSpin[i * 3 + 2] * dt;
      const s = confLife[i] < 0.35 ? clamp(confLife[i] / 0.35, 0, 1) : 1;
      if (confLife[i] <= 0) { confLife[i] = 0; }
      confE.set(confRot[i * 3], confRot[i * 3 + 1], confRot[i * 3 + 2]);
      confQ.setFromEuler(confE);
      confV.set(confPos[i * 3], confPos[i * 3 + 1], confPos[i * 3 + 2]);
      confM4.compose(confV, confQ, confS.set(s, s, s));
      confMesh.setMatrixAt(i, confM4);
    }
    confMesh.instanceMatrix.needsUpdate = true;
    confDirty = any;
    confAny = any;
  }

  // =========================================================================
  // 5. AUDIO — pure WebAudio synth, lazily created on first gesture.
  // =========================================================================
  let ac = null, acMaster = null, acNoise = null, acAmbGain = null, acAmbOn = false;
  let acLimit = null;      // the master compressor — see audioEnsure
  let acEarAt = -1;        // the frame the listener was last resolved on
  let muted = false;
  const lastPlay = Object.create(null);

  function audioEnsure() {
    if (ac) return ac;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    acMaster = ac.createGain();
    acMaster.gain.value = muted ? 0 : 0.85;
    // ---- ONE LIMITER, AND IT IS NOT AN EFFECT -----------------------------
    // Seventeen chapters' worth of ambience, a generative score, a crowd and a
    // physics engine all summed into one gain and went straight at the DAC.
    // Nothing in the game asks how loud everything else already is, so the
    // busy moments — a chapter ceremony over Rio's bateria, the storm in the
    // Erg with a cheer in it — clipped, and a clip on a soft pastel score is
    // the ugliest sound this game can make. A gentle compressor with a high
    // threshold and a slow release is inaudible until it is needed and is the
    // difference between a peak and a crackle. It is one node.
    // If the browser has no compressor, the master goes straight out and this
    // is exactly the graph it was before.
    let out = ac.destination;
    try {
      if (ac.createDynamicsCompressor) {
        acLimit = ac.createDynamicsCompressor();
        acLimit.threshold.value = -8;
        acLimit.knee.value = 12;      // soft: it must never sound like an effect
        acLimit.ratio.value = 6;
        acLimit.attack.value = 0.006;
        acLimit.release.value = 0.22;
        acLimit.connect(ac.destination);
        out = acLimit;
      }
    } catch (e) { acLimit = null; out = ac.destination; }
    acMaster.connect(out);
    return ac;
  }

  /**
   * WHERE THE PLAYER IS LISTENING FROM. Refreshed once a frame by update(), not
   * per sound: a hundred impacts in one frame are all heard from the same head.
   * `sysEar` is the point, `sysEarRight` is the camera's own +x in world space,
   * which is all a stereo pan needs.
   */
  function audioEar() {
    // Once a frame, however many sounds ask. A collapsing stack of crates can
    // fire twenty impacts in one step and they are all heard from one head.
    if (acEarAt === game.state.time) return;
    acEarAt = game.state.time;
    const cp = camera.position;
    const capy = game.capy;
    if (capy && capy.position) {
      sysEar.set(cp.x + (capy.position.x - cp.x) * sysSFX_EAR,
                 cp.y + (capy.position.y - cp.y) * sysSFX_EAR,
                 cp.z + (capy.position.z - cp.z) * sysSFX_EAR);
    } else {
      sysEar.copy(cp);
    }
    // Column 0 of the camera's world matrix IS its right vector, already
    // normalised, and it is recomputed for the render anyway.
    const e = camera.matrixWorld.elements;
    sysEarRight.set(e[0], e[1], e[2]);
  }

  /**
   * The distance law and the pan, for a sound that said where it is.
   * Returns the gain multiplier, and writes the pan into sysSfxPan.
   * Answers 0 for anything the player cannot hear, which is the point: the
   * far field used to build a full oscillator graph to be inaudible with.
   */
  let sysSfxPan = 0;
  function audioPlace(x, y, z, near, far) {
    audioEar();
    const n = near > 0 ? near : sysSFX_NEAR;
    const f = far > 0 ? far : sysSFX_FAR;
    sysEarTo.set(x - sysEar.x, y - sysEar.y, z - sysEar.z);
    const d = sysEarTo.length();
    if (d >= f) return 0;
    let g = d <= n ? 1 : n / (n + sysSFX_ROLL * (d - n));
    // ...and a taper into the far plane, so a sound does not sit at 0.1 for
    // eighty metres and then stop dead when it crosses it.
    if (d > f - sysSFX_FADE) g *= (f - d) / sysSFX_FADE;
    if (!(g > sysSFX_CULL)) return 0;
    // Pan is the component along the camera's right, over the distance: the
    // sine of the bearing off the screen's centre line. Widened, then held off
    // the hard edges — a fully panned mono source on headphones sounds broken.
    sysSfxPan = d > 0.001
      ? clamp((sysEarTo.x * sysEarRight.x + sysEarTo.y * sysEarRight.y +
               sysEarTo.z * sysEarRight.z) / d * sysSFX_PAN_K, -1, 1) * sysSFX_PAN
      : 0;
    return g;
  }
  function audioUnlock() {
    const c = audioEnsure();
    if (!c) return;
    if (c.state === 'suspended' && c.resume) { const p = c.resume(); if (p && p.catch) p.catch(function () {}); }
    if (!acAmbGain) ambientStart();
    // The weather bed is built on the same gesture and for the same reason:
    // eight nodes that run for the life of the page cannot be created before
    // there is a context, and there is no context until somebody clicks.
    if (!wxBedBus) { try { wxBedStart(); } catch (e) { wxBedBus = null; } }
  }
  function noiseBuf() {
    if (acNoise) return acNoise;
    const n = Math.floor(ac.sampleRate * 1.2);
    acNoise = ac.createBuffer(1, n, ac.sampleRate);
    const d = acNoise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.22 + w * 0.78;
      d[i] = last;
    }
    return acNoise;
  }
  function noiseSrc() {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf();
    s.loop = true;
    s.playbackRate.value = rand(0.9, 1.1);
    return s;
  }
  function env(node, t, peak, atk, dec) {
    const g = node.gain;
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    g.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  }

  function sfxWheek(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.16) * pitch;
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'square';
    // Detuned against o1 so the two beat against each other — a squeak, not a beep.
    o2.detune.value = rand(-26, 26);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1450; bp.Q.value = 1.15;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
    const g = ac.createGain();
    const g2 = ac.createGain(); g2.gain.value = 0.16;
    const f0 = 400 * v, f1 = 1180 * v, f2 = 1520 * v, f3 = 620 * v, f4 = 330 * v;
    const fr = o1.frequency, fr2 = o2.frequency;
    fr.setValueAtTime(f0, t);
    fr.exponentialRampToValueAtTime(f1, t + 0.10);
    fr.exponentialRampToValueAtTime(f1 * 0.86, t + 0.155);
    fr.exponentialRampToValueAtTime(f2, t + 0.235);
    fr.exponentialRampToValueAtTime(f3, t + 0.36);
    fr.exponentialRampToValueAtTime(f4, t + 0.52);
    fr2.setValueAtTime(f0 * 2.01, t);
    fr2.exponentialRampToValueAtTime(f1 * 2.01, t + 0.10);
    fr2.exponentialRampToValueAtTime(f2 * 2.01, t + 0.235);
    fr2.exponentialRampToValueAtTime(f4 * 2.01, t + 0.52);
    // squeaky vibrato
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rand(17, 24);
    const lg = ac.createGain(); lg.gain.value = 32 * v;
    lfo.connect(lg); lg.connect(fr); lg.connect(fr2);
    const gg = g.gain;
    gg.setValueAtTime(0.0001, t);
    gg.exponentialRampToValueAtTime(0.38 * vol, t + 0.018);   // snap on
    gg.exponentialRampToValueAtTime(0.13 * vol, t + 0.16);   // the two-tone dip
    gg.exponentialRampToValueAtTime(0.40 * vol, t + 0.25);
    gg.exponentialRampToValueAtTime(0.0001, t + 0.56);
    o1.connect(bp); o2.connect(g2); g2.connect(bp);
    bp.connect(hp); hp.connect(g); g.connect(acMaster);
    o1.start(t); o2.start(t); lfo.start(t);
    o1.stop(t + 0.6); o2.stop(t + 0.6); lfo.stop(t + 0.6);
    // breathy tail
    const ns = noiseSrc();
    const nb = ac.createBiquadFilter(); nb.type = 'bandpass';
    nb.frequency.value = 1900; nb.Q.value = 0.8;
    const ng = ac.createGain();
    env(ng, t + 0.42, 0.05 * vol, 0.03, 0.14);
    ns.connect(nb); nb.connect(ng); ng.connect(acMaster);
    ns.start(t + 0.42); ns.stop(t + 0.64);
  }

  function sfxThud(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.86, 1.16) * pitch;
    const ns = noiseSrc();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900 * v, t);
    lp.frequency.exponentialRampToValueAtTime(150 * v, t + 0.16);
    lp.Q.value = 0.7;
    const g = ac.createGain();
    env(g, t, 0.46 * vol, 0.006, 0.19);
    ns.connect(lp); lp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 0.26);
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(126 * v, t);
    o.frequency.exponentialRampToValueAtTime(48 * v, t + 0.17);
    const og = ac.createGain();
    env(og, t, 0.34 * vol, 0.008, 0.19);
    o.connect(og); og.connect(acMaster);
    o.start(t); o.stop(t + 0.26);
  }

  function sfxSplash(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.12) * pitch;
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(3600 * v, t);
    bp.frequency.exponentialRampToValueAtTime(340 * v, t + 0.52);
    const g = ac.createGain();
    const gg = g.gain;
    gg.setValueAtTime(0.0001, t);
    gg.exponentialRampToValueAtTime(0.42 * vol, t + 0.02);
    gg.exponentialRampToValueAtTime(0.14 * vol, t + 0.2);
    gg.exponentialRampToValueAtTime(0.0001, t + 0.62);
    ns.connect(bp); bp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 0.66);
  }

  function sfxGasp(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.15) * pitch;
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.4;
    bp.frequency.setValueAtTime(620 * v, t);
    bp.frequency.exponentialRampToValueAtTime(1500 * v, t + 0.16);
    const g = ac.createGain();
    env(g, t, 0.26 * vol, 0.03, 0.16);
    ns.connect(bp); bp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 0.24);
  }

  function sfxPop(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.14) * pitch;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1050 * v, t);
    o.frequency.exponentialRampToValueAtTime(370 * v, t + 0.075);
    const g = ac.createGain();
    env(g, t, 0.3 * vol, 0.004, 0.09);
    o.connect(g); g.connect(acMaster);
    o.start(t); o.stop(t + 0.12);
  }

  // ---- FOOTFALL ------------------------------------------------------------
  // The single largest hole in the game's audio was that the capybara moved in
  // total silence. Everything else — the wheek, the thud, the gulls — is an
  // EVENT; a footfall is the continuous texture underneath them, and without it
  // an animal crossing a courtyard reads as a sprite being translated.
  //
  // Three surfaces, one voice. `pitch` carries the surface (systems cannot see
  // what the capybara is standing on and should not have to): under 0.9 is
  // soft ground, around 1.0 is stone, over 1.15 is hollow timber. What actually
  // changes is the FILTER and the decay, because that is what a surface is:
  //   soft   — low-passed, no ring, gone in 60 ms (grass, soil, sand)
  //   stone  — band-passed higher up with a short bright tail (cobbles, paving)
  //   timber — a low resonant peak that rings for a moment (a wharf, a deck)
  // Volume is scaled by the caller with the animal's speed, so a walk whispers
  // and a run is audible across the plaza.
  function sfxStep(vol, pitch, extra, wet) {
    const t = ac.currentTime;
    const soft = pitch < 0.9, wood = pitch > 1.15;
    const v = rand(0.94, 1.07);
    const ns = noiseSrc();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    const gg = g.gain;
    if (soft) {
      f.type = 'lowpass'; f.frequency.value = 900 * v; f.Q.value = 0.7;
      gg.setValueAtTime(0.0001, t);
      gg.exponentialRampToValueAtTime(0.075 * vol, t + 0.006);
      gg.exponentialRampToValueAtTime(0.0001, t + 0.075);
      ns.connect(f); f.connect(g);
      ns.start(t); ns.stop(t + 0.09);
    } else if (wood) {
      f.type = 'bandpass'; f.frequency.value = 240 * v; f.Q.value = 3.2;
      gg.setValueAtTime(0.0001, t);
      gg.exponentialRampToValueAtTime(0.14 * vol, t + 0.005);
      gg.exponentialRampToValueAtTime(0.0001, t + 0.19);
      // the hollow: a short sine thump under the noise, which is the deck itself
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(190 * v, t);
      o.frequency.exponentialRampToValueAtTime(96 * v, t + 0.13);
      const og = ac.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.10 * vol, t + 0.008);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(og); og.connect(acMaster);
      o.start(t); o.stop(t + 0.2);
      ns.connect(f); f.connect(g);
      ns.start(t); ns.stop(t + 0.22);
    } else {
      f.type = 'bandpass'; f.frequency.value = 1700 * v; f.Q.value = 1.1;
      gg.setValueAtTime(0.0001, t);
      gg.exponentialRampToValueAtTime(0.085 * vol, t + 0.004);
      gg.exponentialRampToValueAtTime(0.0001, t + 0.10);
      ns.connect(f); f.connect(g);
      ns.start(t); ns.stop(t + 0.12);
    }
    g.connect(acMaster);

    // ---- THE PUDDLE, ON TOP OF WHATEVER THAT WAS -------------------------
    // A SECOND LAYER, not a different material. The three branches above are
    // what the ground is MADE of; this is what is lying on it, and a wet
    // cobble is not a softer cobble — it is a cobble with a splash on it. So
    // the material voice is untouched and the water is mixed in beside it,
    // which also means a caller that never passes `wet` (every one of them
    // except the footfall) gets the identical sample it always got.
    //
    // A splash is a noise burst whose BAND OPENS UPWARD as it goes: the low
    // part is the displacement and the bright part is the spray coming off it.
    // A fixed band is a hiss, and a downward sweep is a drain.
    if (wet > 0.02) {
      const w = clamp(wet, 0, 1);
      const wv = rand(0.9, 1.14);
      const wn = noiseSrc();
      const wf = ac.createBiquadFilter();
      wf.type = 'bandpass'; wf.Q.value = 0.75;
      wf.frequency.setValueAtTime(950 * wv, t);
      wf.frequency.exponentialRampToValueAtTime(3400 * wv, t + 0.055);
      const wg = ac.createGain();
      wg.gain.setValueAtTime(0.0001, t);
      wg.gain.exponentialRampToValueAtTime(0.070 * vol * w, t + 0.005);
      wg.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      wn.connect(wf); wf.connect(wg); wg.connect(acMaster);
      wn.start(t); wn.stop(t + 0.15);
    }
  }

  /**
   * CLINK — the one voice this game was missing.
   *
   * Everything hard and hollow in the prop table (a glazed bowl, an enamel mug,
   * a wine bottle, a pair of acetate sunglasses, a camera body, a terracotta
   * pot) was going 'thud', which is a low-passed noise burst — the sound of a
   * sandbag. What makes a hard thing sound hard is INHARMONICITY: three or four
   * partials at ratios that are not whole numbers, so they beat against each
   * other instead of fusing into a note, and a decay measured in a couple of
   * hundred milliseconds rather than twenty.
   *
   * `pitch` carries the material, exactly the way it does for the footfall:
   * around 0.7 is metal (low, long, and the partials spread wide), 1.0 is fired
   * clay (mid, short, dead), 1.3 is glass (high, bright, and it rings).
   */
  function sfxClink(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.95, 1.08) * pitch;
    const f0 = 900 * v;
    // Deliberately not harmonic: 1, 2.76, 5.40 is roughly a struck bar, and the
    // ear reads the beating between them as "that is a solid object".
    const parts = [1, 2.76, 5.40, 8.93];
    const bright = clamp((pitch - 0.7) / 0.6, 0, 1);      // glass rings, metal booms
    const ring = lerp(0.42, 0.20, bright);
    for (let i = 0; i < parts.length; i++) {
      const o = ac.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f0 * parts[i] * rand(0.995, 1.005);
      const g = ac.createGain();
      // Higher partials die first, which is what stops it sounding like a bell.
      const rel = ring / (1 + i * 0.85);
      const pk = (0.15 / (1 + i * 1.15)) * vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0004, pk), t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rel);
      o.connect(g); g.connect(acMaster);
      o.start(t); o.stop(t + rel + 0.03);
    }
    // The strike itself: 8 ms of filtered noise. Without it the partials fade
    // up out of nothing and the whole thing reads as a synthesiser.
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2400 * v;
    const ng = ac.createGain();
    env(ng, t, 0.075 * vol, 0.002, 0.03);
    ns.connect(hp); hp.connect(ng); ng.connect(acMaster);
    ns.start(t); ns.stop(t + 0.06);
  }

  function sfxRustle(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.15) * pitch;
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2100 * v;
    const g = ac.createGain();
    const gg = g.gain;
    gg.setValueAtTime(0.0001, t);
    for (let i = 0; i < 4; i++) {
      gg.exponentialRampToValueAtTime((0.16 - i * 0.03) * vol, t + 0.03 + i * 0.07);
      gg.exponentialRampToValueAtTime(0.02 * vol, t + 0.065 + i * 0.07);
    }
    gg.exponentialRampToValueAtTime(0.0001, t + 0.34);
    ns.connect(hp); hp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 0.38);
  }

  function sfxWhistle(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.95, 1.08) * pitch;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(760 * v, t);
    o.frequency.exponentialRampToValueAtTime(1580 * v, t + 0.2);
    o.frequency.exponentialRampToValueAtTime(1180 * v, t + 0.44);
    const lfo = ac.createOscillator(); lfo.frequency.value = 6.2;
    const lg = ac.createGain(); lg.gain.value = 22;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = ac.createGain();
    env(g, t, 0.2 * vol, 0.04, 0.44);
    o.connect(g); g.connect(acMaster);
    o.start(t); lfo.start(t);
    o.stop(t + 0.52); lfo.stop(t + 0.52);
  }

  /**
   * THE TICK. A task landing has to feel like something, and 'pop' — a 90 ms
   * blip shared with every UI beep — did not. This is a rising three-note figure
   * voiced from the chord the score is ACTUALLY sitting on, so it lands in key in
   * either hemisphere, over a soft noise swell that gives it a body. `streak`
   * lifts the whole figure a tone at a time, so a run of quick completions
   * audibly climbs instead of repeating.
   */
  function sfxTick(vol, pitch, streak) {
    const t = ac.currentTime;
    const chord = musCurChord || sysMUS_CHORDS[0];
    const lift = clamp(streak || 0, 0, 4) * 2;         // whole tones
    // root, third-ish, octave — read off the live chord so it is never dissonant
    const pick = [chord[0], chord[2 % chord.length], chord[0] + 12];
    for (let i = 0; i < pick.length; i++) {
      const st = t + i * 0.062;
      let midi = pick[i] + 24 + lift;                  // up where a chime lives
      while (midi > 96) midi -= 12;
      const hz = sysMidiHz(midi) * pitch;
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 3.01;
      const g = ac.createGain();
      const g2 = ac.createGain();
      const rel = 0.9 + i * 0.35;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.13 * vol, st + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, st + rel);
      g2.gain.setValueAtTime(0.0001, st);
      g2.gain.exponentialRampToValueAtTime(0.030 * vol, st + 0.004);
      g2.gain.exponentialRampToValueAtTime(0.0001, st + rel * 0.4);
      o.connect(g); o2.connect(g2);
      g.connect(acMaster); g2.connect(acMaster);
      o.start(st); o2.start(st);
      o.stop(st + rel + 0.05); o2.stop(st + rel + 0.05);
    }
    // the paper-and-shaker swell underneath — this is most of the "weight"
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1400, t);
    bp.frequency.exponentialRampToValueAtTime(5200, t + 0.18);
    bp.Q.value = 0.7;
    const ng = ac.createGain();
    env(ng, t, 0.055 * vol, 0.012, 0.26);
    ns.connect(bp); bp.connect(ng); ng.connect(acMaster);
    ns.start(t); ns.stop(t + 0.34);
  }

  // The gull is the joke: a nasal, over-confident laugh that arrives one syllable
  // too many. Each cry rises, cracks, and falls, and the last one always sounds
  // personally aggrieved. Deliberately a touch too loud and a touch too long.
  function sfxGull(vol, pitch) {
    const t = ac.currentTime;
    // A missing/NaN volume used to reach the gain ramp as NaN and throw. Any
    // value that is not a positive number reads as "the default, please".
    if (!(vol > 0)) vol = 1;
    const v = rand(0.85, 1.2) * (pitch > 0 ? pitch : 1);
    const notes = randInt(3, 5);
    let st = t;
    for (let i = 0; i < notes; i++) {
      const last = i === notes - 1;
      const dur = last ? rand(0.34, 0.46) : rand(0.13, 0.19);
      const o = ac.createOscillator(); o.type = 'sawtooth';
      // A second oscillator a hair off unison: that beat is the nasal squawk.
      const o2 = ac.createOscillator(); o2.type = 'square';
      o2.detune.value = rand(14, 38);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = 2050 + i * 130; bp.Q.value = 3.6;
      const f0 = (760 + i * 55) * v;
      const fr = o.frequency, fr2 = o2.frequency;
      fr.setValueAtTime(f0, st);
      fr.exponentialRampToValueAtTime(f0 * 1.72, st + dur * 0.16);
      // the crack: a sharp overshoot before it gives up
      fr.exponentialRampToValueAtTime(f0 * 1.34, st + dur * 0.42);
      fr.exponentialRampToValueAtTime(f0 * (last ? 0.58 : 0.86), st + dur);
      fr2.setValueAtTime(f0 * 1.5, st);
      fr2.exponentialRampToValueAtTime(f0 * 2.4, st + dur * 0.2);
      fr2.exponentialRampToValueAtTime(f0 * (last ? 0.9 : 1.3), st + dur);
      const g = ac.createGain();
      const gg = g.gain;
      const pk = (last ? 0.062 : 0.05 - i * 0.004) * vol;
      gg.setValueAtTime(0.0001, st);
      gg.exponentialRampToValueAtTime(Math.max(0.0004, pk), st + 0.014);
      gg.exponentialRampToValueAtTime(Math.max(0.0004, pk * 0.55), st + dur * 0.55);
      gg.exponentialRampToValueAtTime(0.0001, st + dur + 0.05);
      // a chattering tremolo so it reads as a laugh rather than a siren
      const trem = ac.createOscillator(); trem.type = 'square';
      trem.frequency.value = rand(26, 38);
      const tg = ac.createGain(); tg.gain.value = pk * 0.34;
      trem.connect(tg); tg.connect(gg);
      const sub = ac.createGain(); sub.gain.value = 0.2;
      o2.connect(sub); sub.connect(bp);
      o.connect(bp); bp.connect(g); g.connect(acMaster);
      o.start(st); o2.start(st); trem.start(st);
      const stop = st + dur + 0.09;
      o.stop(stop); o2.stop(stop); trem.stop(stop);
      st += dur + (last ? 0 : rand(0.03, 0.07));
    }
  }

  // Dog: a blunt "wuf" — a noise slap over a fast down-swept body. Two barks,
  // occasionally three, because a dog that barks once is not a dog.
  function sfxBark(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.9, 1.15) * pitch;
    const n = Math.random() < 0.35 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const st = t + i * rand(0.15, 0.22);
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(420 * v, st);
      o.frequency.exponentialRampToValueAtTime(700 * v, st + 0.02);
      o.frequency.exponentialRampToValueAtTime(150 * v, st + 0.13);
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(1250 * v, st);
      bp.frequency.exponentialRampToValueAtTime(520 * v, st + 0.12);
      bp.Q.value = 1.6;
      const g = ac.createGain();
      env(g, st, (0.28 - i * 0.05) * vol, 0.006, 0.11);
      o.connect(bp); bp.connect(g); g.connect(acMaster);
      o.start(st); o.stop(st + 0.16);
      const ns = noiseSrc();
      const nh = ac.createBiquadFilter(); nh.type = 'highpass'; nh.frequency.value = 900;
      const ng = ac.createGain();
      env(ng, st, (0.13 - i * 0.02) * vol, 0.004, 0.06);
      ns.connect(nh); nh.connect(ng); ng.connect(acMaster);
      ns.start(st); ns.stop(st + 0.09);
    }
  }

  // Busker: one lazy downward strum. Voiced from whatever chord the score is
  // currently sitting on, so the busker is — implausibly — in key with the harbour.
  function sfxStrum(vol, pitch) {
    const t = ac.currentTime;
    const chord = musCurChord || sysMUS_CHORDS[0];
    const up = Math.random() < 0.3;
    for (let i = 0; i < 6; i++) {
      const st = t + i * rand(0.017, 0.03);
      // Fold the chord tone into that string's register — open-tuning voicing.
      const tgt = 40 + i * 5;
      let midi = chord[(up ? 5 - i : i) % chord.length];
      while (midi < tgt - 6) midi += 12;
      while (midi > tgt + 6) midi -= 12;
      const hz = sysMidiHz(midi) * pitch;
      const o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(hz * 1.006, st);
      o.frequency.exponentialRampToValueAtTime(hz, st + 0.06);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
      lp.frequency.setValueAtTime(hz * 7, st);
      lp.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 1.8), st + 0.5);
      const g = ac.createGain();
      const rel = rand(0.9, 1.5);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.055 * vol, st + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, st + rel);
      o.connect(lp); lp.connect(g); g.connect(acMaster);
      o.start(st); o.stop(st + rel + 0.05);
    }
    // pick noise — the fingernail, not the string
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const ng = ac.createGain();
    env(ng, t, 0.04 * vol, 0.005, 0.14);
    ns.connect(hp); hp.connect(ng); ng.connect(acMaster);
    ns.start(t); ns.stop(t + 0.2);
  }

  // Ferry horn: two low sawtooth stacks a fifth apart, slow on, slow off, with a
  // breath of air around them. Enormous, unhurried, entirely indifferent to you.
  function sfxHorn(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.97, 1.04) * pitch;
    const base = [78, 116, 155, 233];
    for (let i = 0; i < base.length; i++) {
      const o = ac.createOscillator();
      o.type = i < 2 ? 'sawtooth' : 'triangle';
      o.frequency.setValueAtTime(base[i] * v * 0.985, t);
      o.frequency.linearRampToValueAtTime(base[i] * v, t + 0.25);
      o.frequency.linearRampToValueAtTime(base[i] * v * 0.975, t + 1.5);
      o.detune.value = rand(-8, 8);
      const g = ac.createGain();
      const pk = (0.19 - i * 0.035) * vol;
      const gg = g.gain;
      gg.setValueAtTime(0.0001, t);
      gg.exponentialRampToValueAtTime(Math.max(0.0004, pk), t + 0.16);
      gg.setValueAtTime(Math.max(0.0004, pk), t + 1.05);
      gg.exponentialRampToValueAtTime(0.0001, t + 1.75);
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.value = 1100; lp.Q.value = 0.5;
      o.connect(lp); lp.connect(g); g.connect(acMaster);
      o.start(t); o.stop(t + 1.8);
    }
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 520; bp.Q.value = 0.7;
    const ng = ac.createGain();
    const ngg = ng.gain;
    ngg.setValueAtTime(0.0001, t);
    ngg.exponentialRampToValueAtTime(0.05 * vol, t + 0.2);
    ngg.exponentialRampToValueAtTime(0.0001, t + 1.7);
    ns.connect(bp); bp.connect(ng); ng.connect(acMaster);
    ns.start(t); ns.stop(t + 1.8);
  }

  // Sprinkler: a bright hiss chopped by the rotor — tsk-tsk-tsk-tssssshhh.
  function sfxHiss(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.94, 1.1) * pitch;
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 4200 * v; bp.Q.value = 0.55;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 * v;
    const g = ac.createGain();
    const gg = g.gain;
    gg.setValueAtTime(0.0001, t);
    // three ticks of the rotor, then the sweep across
    for (let i = 0; i < 3; i++) {
      gg.exponentialRampToValueAtTime(0.13 * vol, t + 0.02 + i * 0.1);
      gg.exponentialRampToValueAtTime(0.028 * vol, t + 0.06 + i * 0.1);
    }
    gg.exponentialRampToValueAtTime(0.1 * vol, t + 0.4);
    gg.exponentialRampToValueAtTime(0.0001, t + 1.05);
    // the sweep is in the filter, not the level: it reads as the jet passing you
    bp.frequency.setValueAtTime(2600 * v, t + 0.3);
    bp.frequency.exponentialRampToValueAtTime(6200 * v, t + 0.66);
    bp.frequency.exponentialRampToValueAtTime(2400 * v, t + 1.05);
    ns.connect(hp); hp.connect(bp); bp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 1.1);
  }

  // ---- THUNDER, AND IT IS ALWAYS DISTANT -----------------------------------
  // There is no lightning in this game and there is not going to be: a flash
  // is a hard cut in a game whose whole argument is that its light is stable,
  // and it would undo the one rule the micro-environment is built on. What is
  // left is the sound of one a long way off, which is a serene noise rather
  // than a frightening one — a very low, very slow swell with no transient in
  // it at all. The absence of a crack IS the distance.
  function sfxThunder(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.86, 1.14) * pitch;
    const ns = noiseSrc();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 210 * v; lp.Q.value = 0.9;
    const lp2 = ac.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 400 * v; lp2.Q.value = 0.5;
    const g = ac.createGain();
    const gg = g.gain;
    // Four seconds, and the attack is nearly a second of it. Anything faster
    // reads as a door.
    gg.setValueAtTime(0.0001, t);
    gg.exponentialRampToValueAtTime(0.10 * vol, t + 0.85);
    gg.exponentialRampToValueAtTime(0.055 * vol, t + 1.9);
    gg.exponentialRampToValueAtTime(0.070 * vol, t + 2.5);   // the roll, coming back
    gg.exponentialRampToValueAtTime(0.0001, t + 4.2);
    // ...and it gets DARKER as it goes, because the high end of a distant
    // rumble is what the air takes out of it first.
    lp.frequency.setValueAtTime(260 * v, t);
    lp.frequency.exponentialRampToValueAtTime(95 * v, t + 4.2);
    ns.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 4.3);
  }

  // ---- A DRIP. Water coming off an awning, a leaf or a hundred and seventy
  // metres of limestone ceiling. One pitched blip with a very fast downward
  // sweep — the sweep is the whole sound; at a constant pitch it is a marimba.
  function sfxDrip(vol, pitch) {
    const t = ac.currentTime;
    const v = rand(0.78, 1.3) * pitch;
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1500 * v, t);
    o.frequency.exponentialRampToValueAtTime(430 * v, t + 0.085);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085 * vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.20);
    // a breath of the splat underneath it, or it is a pluck rather than water
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 2600 * v; bp.Q.value = 1.4;
    const ng = ac.createGain();
    env(ng, t, 0.030 * vol, 0.004, 0.06);
    o.connect(g); g.connect(acMaster);
    ns.connect(bp); bp.connect(ng); ng.connect(acMaster);
    o.start(t); o.stop(t + 0.24);
    ns.start(t); ns.stop(t + 0.09);
  }

  // The chapter-unlock chime: a rising bell figure with a long tail. Warm, not fanfare.
  function sfxChime(vol, pitch) {
    const t = ac.currentTime;
    const seq = [64, 71, 76, 83];
    for (let i = 0; i < seq.length; i++) {
      const st = t + i * 0.13;
      const hz = sysMidiHz(seq[i]) * pitch;
      const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
      const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2.004;
      const g = ac.createGain();
      const rel = 1.7 + i * 0.35;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.14 * vol, st + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, st + rel);
      const g2 = ac.createGain();
      g2.gain.setValueAtTime(0.0001, st);
      g2.gain.exponentialRampToValueAtTime(0.05 * vol, st + 0.006);
      g2.gain.exponentialRampToValueAtTime(0.0001, st + rel * 0.5);
      o.connect(g); o2.connect(g2);
      g.connect(acMaster); g2.connect(acMaster);
      o.start(st); o2.start(st);
      o.stop(st + rel + 0.05); o2.stop(st + rel + 0.05);
    }
  }

  /**
   * A crowd. Applause is not one sound, it is a few hundred uncorrelated claps,
   * so this is broadband noise shaped with a fast ragged attack and a long
   * uneven tail, plus a low roar underneath it for the bodies. Used at Arpoador,
   * where Cariocas have applauded the sunset every evening for decades.
   */
  function sfxCheer(vol, pitch) {
    const t = ac.currentTime;
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1900 * pitch; bp.Q.value = 0.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.085 * vol, t + 0.09);
    // the ragged plateau: a clapping crowd never holds a level
    for (let i = 0; i < 6; i++) {
      g.gain.exponentialRampToValueAtTime((0.05 + Math.random() * 0.045) * vol, t + 0.2 + i * 0.22);
    }
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    ns.connect(bp); bp.connect(g); g.connect(acMaster);
    ns.start(t); ns.stop(t + 2.2);
    // the roar of the bodies underneath
    const ns2 = noiseSrc();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.6;
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.exponentialRampToValueAtTime(0.05 * vol, t + 0.25);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    ns2.connect(lp); lp.connect(g2); g2.connect(acMaster);
    ns2.start(t); ns2.stop(t + 2.1);
  }

  function ambientStart() {
    if (!ac || acAmbGain) return;
    acAmbGain = ac.createGain();
    acAmbGain.gain.value = 0.0001;
    acAmbGain.connect(acMaster);
    const ns = noiseSrc();
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 430; lp.Q.value = 0.5;
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
    const sway = ac.createGain(); sway.gain.value = 0.7;
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.11;
    const lg = ac.createGain(); lg.gain.value = 0.3;
    lfo.connect(lg); lg.connect(sway.gain);
    ns.connect(lp); lp.connect(hp); hp.connect(sway); sway.connect(acAmbGain);
    ns.start(); lfo.start();
  }
  function ambientSet(on) {
    if (!acAmbGain || acAmbOn === on) return;
    acAmbOn = on;
    acAmbGain.gain.setTargetAtTime(on ? 0.05 : 0.0001, ac.currentTime, 0.6);
  }

  // =========================================================================
  // 5a-bis. THE WEATHER BED — four continuous voices under everything.
  //
  // NOT one-shots. A rain sound made of scheduled one-shots is a machine gun
  // with a low-pass on it; rain is a continuous noise process and the only
  // honest way to mix it is a continuous node whose GAIN moves. Four sources,
  // built once, running for the life of the page, and the entire per-frame
  // cost is four `setTargetAtTime` calls on four gains.
  //
  // THE SCORE IS THE POINT AND THIS IS NOT. The brief is "without overpowering
  // the primary musical score", and there are two separate mechanisms for it:
  //
  //   1. the bus ceiling (sysWX_BED_MAX) is a fifth of what the master would
  //      let it be, so even a full Kowloon downpour sits under a solo pad;
  //   2. it DUCKS against the music's own intensity, so the bed gets out of
  //      the way of a swell and comes back afterwards. A bed that does not
  //      duck is a bed that is either always too loud or always inaudible,
  //      and the score in this game deliberately moves a long way.
  //
  // Every level arrives from game.weather.bed(). A chapter with an all-zero
  // bed row (Marrakech's rain, the Drift's drip) never opens that gain at all,
  // and a build with no weather module never calls sysWxBedSet.
  // =========================================================================
  let wxBedBus = null, wxBedRain = null, wxBedWind = null, wxBedChirp = null, wxBedRustle = null;
  let wxBedWindLP = null, wxBedRainBP = null;
  let wxDripAt = 0;
  const sysWX_BED_MAX  = 0.19;   // ceiling on the whole bus, against a 0.85 master
  const sysWX_BED_TAU  = 0.85;   // seconds. Slow: weather does not step.
  const sysWX_DUCK     = 0.45;   // how much of the bed a full musical swell takes

  function wxBedStart() {
    if (!ac || wxBedBus) return;
    wxBedBus = ac.createGain();
    wxBedBus.gain.value = 0.0001;
    wxBedBus.connect(acMaster);

    // ---- rain. Two bands, because one is a hiss and rain is not a hiss: a
    // bright band is the drops hitting things and a dark one is the general
    // roar of a lot of them at once a long way off.
    wxBedRain = ac.createGain(); wxBedRain.gain.value = 0.0001;
    const rn = noiseSrc();
    wxBedRainBP = ac.createBiquadFilter();
    wxBedRainBP.type = 'bandpass'; wxBedRainBP.frequency.value = 1750; wxBedRainBP.Q.value = 0.42;
    const rlo = ac.createBiquadFilter();
    rlo.type = 'lowpass'; rlo.frequency.value = 620; rlo.Q.value = 0.4;
    const rloG = ac.createGain(); rloG.gain.value = 0.55;
    const rn2 = noiseSrc();
    rn.connect(wxBedRainBP); wxBedRainBP.connect(wxBedRain);
    rn2.connect(rlo); rlo.connect(rloG); rloG.connect(wxBedRain);
    wxBedRain.connect(wxBedBus);
    rn.start(); rn2.start();

    // ---- wind. A lowpass on noise, with the CUTOFF swayed rather than the
    // level: moving the level is a fan being switched on and off, moving the
    // cutoff is air going round something.
    wxBedWind = ac.createGain(); wxBedWind.gain.value = 0.0001;
    const wn = noiseSrc();
    wxBedWindLP = ac.createBiquadFilter();
    wxBedWindLP.type = 'lowpass'; wxBedWindLP.frequency.value = 340; wxBedWindLP.Q.value = 0.7;
    const whp = ac.createBiquadFilter(); whp.type = 'highpass'; whp.frequency.value = 70;
    const wlfo = ac.createOscillator(); wlfo.frequency.value = 0.073;
    const wlfoG = ac.createGain(); wlfoG.gain.value = 170;
    wlfo.connect(wlfoG); wlfoG.connect(wxBedWindLP.frequency);
    wn.connect(wxBedWindLP); wxBedWindLP.connect(whp); whp.connect(wxBedWind);
    wxBedWind.connect(wxBedBus);
    wn.start(); wlfo.start();

    // ---- crickets. A high triangle gated hard by a fast LFO through a shaper
    // — a cricket is a pulse train, not a tone, and an ungated oscillator up
    // there is a mosquito and an immediate complaint.
    wxBedChirp = ac.createGain(); wxBedChirp.gain.value = 0.0001;
    const co = ac.createOscillator(); co.type = 'triangle'; co.frequency.value = 4320;
    const co2 = ac.createOscillator(); co2.type = 'sine'; co2.frequency.value = 6510;
    const co2g = ac.createGain(); co2g.gain.value = 0.35;
    const gate = ac.createGain(); gate.gain.value = 0;
    const glfo = ac.createOscillator(); glfo.type = 'square'; glfo.frequency.value = 13.5;
    const glfoG = ac.createGain(); glfoG.gain.value = 0.5;
    // ...and a second, much slower gate, because a field of crickets comes in
    // and out in waves rather than running flat for an hour.
    const wave = ac.createGain(); wave.gain.value = 0.55;
    const wlfo2 = ac.createOscillator(); wlfo2.frequency.value = 0.19;
    const wlfo2G = ac.createGain(); wlfo2G.gain.value = 0.4;
    wlfo2.connect(wlfo2G); wlfo2G.connect(wave.gain);
    glfo.connect(glfoG); glfoG.connect(gate.gain);
    co.connect(gate); co2.connect(co2g); co2g.connect(gate);
    gate.connect(wave); wave.connect(wxBedChirp);
    wxBedChirp.connect(wxBedBus);
    co.start(); co2.start(); glfo.start(); wlfo2.start();

    // ---- leaves. Bright noise, swayed on its own slow LFO. This is the voice
    // the gust actually drives, and it is the reason a wind shift is audible
    // in a chapter that has no rain in it at all.
    wxBedRustle = ac.createGain(); wxBedRustle.gain.value = 0.0001;
    const sn = noiseSrc();
    const shp = ac.createBiquadFilter(); shp.type = 'highpass'; shp.frequency.value = 2300;
    const slp = ac.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 7400;
    const ssway = ac.createGain(); ssway.gain.value = 0.6;
    const slfo = ac.createOscillator(); slfo.frequency.value = 0.147;
    const slfoG = ac.createGain(); slfoG.gain.value = 0.45;
    slfo.connect(slfoG); slfoG.connect(ssway.gain);
    sn.connect(shp); shp.connect(slp); slp.connect(ssway); ssway.connect(wxBedRustle);
    wxBedRustle.connect(wxBedBus);
    sn.start(); slfo.start();
  }

  /** Drive the bed from weather.js's levels. Four gain writes and no more. */
  function sysWxBedSet(dt) {
    const W = game.weather;
    if (!W || !ac || !wxBedBus) return;
    const b = W.bed();
    const t = ac.currentTime;
    // The bus. Silent while the world is not being played, for exactly the
    // reason sfx() is: an open journal or a background tab is not weather.
    const playing = game.state.started && !game.state.paused && !document.hidden && !muted;
    const duck = 1 - clamp(musIntensity, 0, 1) * sysWX_DUCK;
    const busy = playing ? sysWX_BED_MAX * duck : 0.0001;
    wxBedBus.gain.setTargetAtTime(Math.max(0.0001, busy), t, sysWX_BED_TAU * 0.5);
    wxBedRain.gain.setTargetAtTime(Math.max(0.0001, b.rain * 0.62), t, sysWX_BED_TAU);
    wxBedWind.gain.setTargetAtTime(Math.max(0.0001, b.wind * 0.50), t, sysWX_BED_TAU);
    wxBedChirp.gain.setTargetAtTime(Math.max(0.0001, b.chirp * 0.030), t, sysWX_BED_TAU);
    wxBedRustle.gain.setTargetAtTime(Math.max(0.0001, b.rustle * 0.085), t, sysWX_BED_TAU);
    // The rain gets BRIGHTER as it gets harder rather than only louder, which
    // is the difference between a shower arriving and a volume knob turning.
    wxBedRainBP.frequency.setTargetAtTime(1250 + b.rain * 1400, t, sysWX_BED_TAU);
    wxBedWindLP.frequency.setTargetAtTime(230 + b.wind * 460, t, sysWX_BED_TAU);

    // ---- and the drip, which is the one voice that must NOT be continuous.
    // Water coming off a roof is a discrete event with a long gap; smeared
    // into a noise bed it is a tap left running. Scheduled on a jittered timer
    // so it never falls into a rhythm.
    if (playing && b.drip > 0.04) {
      wxDripAt -= dt;
      if (wxDripAt <= 0) {
        wxDripAt = rand(0.35, 1.9) / clamp(b.drip, 0.05, 1);
        sfx('drip', { volume: 0.18 + b.drip * 0.5 });
      }
    }
  }

  // =========================================================================
  // 5b. MUSIC — generative lush pad, pure synthesis, lookahead-scheduled.
  // Signal: pad voices -> filter -> pad gain --+--> dry --+
  //         plucks -----> pan ---------------> dry -+     +--> musVol -> master
  //                            \-> send -> convolver(generated IR) -> wet -+
  // Nothing here is created or touched per render frame.
  // =========================================================================
  let musVol = null, musDry = null, musSend = null, musWet = null, musConv = null;
  let musPlaceLP = null, musPlacePan = null, musPlaceGain = null;
  let musPad = null, musFilt = null, musBassGain = null, musPluckDry = null;
  let musTimerId = 0;
  let musChordAt = 0, musPluckAt = 0, musIdx = 0, musChordStart = 0;
  let musMuted = false, musLevel = 1;
  let musIntensity = 0, musChaseT = 0, musApplyT = 0;
  // The beat clock. Published as game.music so cali.js can judge a dance step
  // against the ACTUAL audio timeline rather than against a parallel timer that
  // would drift out of sync inside a minute.
  let musBarAnchor = 0, musBarIndex = 0, musBeatLen = 0;
  let musDrum = null, musBarAt = 0;
  const musVoices = [];
  const musUsed = [];
  let musBassV = null;
  // Which harmonic palette the score is living in, plus the two chord arrays the
  // pluck scheduler needs (by reference — a chapter change swaps the palette out
  // from under the indices, so indices alone would point at the wrong chords).
  let musPal = sysMUS_PAL[0];
  let musShakuAt = 0, musBuoyAt = 0;   // the two slow voices keep their own clocks
  let musCurChord = null, musPrevChord = null;
  let musShimGain = null, musShimV = null, musProg = 0;
  // The choir. Real pad voices through a formant pair rather than the main
  // low-pass, silent until an Icelandic sky says otherwise.
  let musChoirGain = null, musChoirIn = null;
  const musChoirV = [];
  let musChoirLevel = 0;
  // The lift. One gain, one envelope value and one clock — everything else
  // about it is the pad's own chord, read live.
  let musLiftGain = null, musLift = 0, musLiftT = 0;
  // Audio-clock time before which musSwell() will not schedule another figure.
  // See the note in musSwell: the held swells call it sixty times a second.
  let musLiftArpAt = 0;
  const musLiftV = [];
  // The two live inputs the gnawa cell is written against, both owned by the
  // update loop below and both read by musGnawaCell().
  let musGnawaStrip = 0, musGnawaBuild = 0;
  // Venice's tide and Hong Kong's show, on the same footing: one number each,
  // written from the biome every frame, glided rather than switched.
  let musVenTide = 0, musHkShow = 0;

  // Procedurally generated impulse response: exponentially decaying, darkened
  // noise. This is the difference between thin beeps and something lush.
  function musIR(secs, decay) {
    const rate = ac.sampleRate;
    const n = Math.max(1, Math.floor(rate * secs));
    const buf = ac.createBuffer(2, n, rate);
    const atk = Math.max(1, Math.floor(rate * 0.006));
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        lp = lp * 0.62 + (Math.random() * 2 - 1) * 0.38;
        const tail = Math.pow(1 - i / n, decay);
        d[i] = lp * tail * (i < atk ? i / atk : 1);
      }
    }
    return buf;
  }

  function musMakeVoice(centre, level, type, spread, out) {
    const v = { centre: centre, note: centre, level: level, active: 0, banks: [] };
    for (let b = 0; b < 2; b++) {
      const g = ac.createGain();
      g.gain.value = b === 0 ? level : 0;
      g.connect(out);
      const oscs = [];
      for (let k = 0; k < spread.length; k++) {
        const o = ac.createOscillator();
        o.type = type;
        o.detune.value = spread[k] + rand(-2, 2);
        o.frequency.value = sysMidiHz(centre);
        o.connect(g);
        o.start();
        oscs.push(o);
      }
      v.banks.push({ g: g, oscs: oscs });
    }
    return v;
  }

  function musSetChord(idx, when, xf) {
    const chord = musPal.chords[idx];
    const fade = xf || sysMUS_XFADE;
    musPrevChord = musCurChord;
    musCurChord = chord;
    musUsed.length = 0;
    for (let i = 0; i < musVoices.length; i++) {
      const v = musVoices[i];
      const n = sysMusPick(chord, v.note, v.centre, musUsed);
      musUsed.push(n);
      v.note = n;
      const idle = v.banks[1 - v.active];
      const act = v.banks[v.active];
      const hz = sysMidiHz(n);
      for (let k = 0; k < idle.oscs.length; k++) idle.oscs[k].frequency.setValueAtTime(hz, when);
      idle.g.gain.setValueAtTime(0, when);
      idle.g.gain.linearRampToValueAtTime(v.level, when + fade);
      act.g.gain.setValueAtTime(v.level, when);
      act.g.gain.linearRampToValueAtTime(0, when + fade);
      v.active = 1 - v.active;
    }
    if (musBassV) {
      const v = musBassV;
      let n = musPal.roots[idx];
      v.note = n;
      const idle = v.banks[1 - v.active];
      const act = v.banks[v.active];
      const hz = sysMidiHz(n);
      for (let k = 0; k < idle.oscs.length; k++) idle.oscs[k].frequency.setValueAtTime(hz, when);
      idle.g.gain.setValueAtTime(0, when);
      idle.g.gain.linearRampToValueAtTime(v.level, when + fade);
      act.g.gain.setValueAtTime(v.level, when);
      act.g.gain.linearRampToValueAtTime(0, when + fade);
      v.active = 1 - v.active;
    }
  }

  // Chapter change. Nothing stops and nothing restarts: the palette pointer swaps,
  // the pad voice-leads into the nearest tones of the new key over 6.5 s, and the
  // bus/filter/bass targets glide there over about the same window. The two keys
  // share six of seven notes, so the overlap is a shimmer rather than a clash.
  function musSetPalette(n, immediate) {
    const pal = sysMUS_PAL[n] || sysMUS_PAL[0];
    if (musPal === pal) return;
    musPal = pal;
    // The index must move with the pointer even when the context is suspended:
    // the band palettes' next-tables are shorter than the pad palettes', so a
    // stale musIdx indexes past the end and musTick throws on every interval.
    musIdx = 0;
    if (!ac || !musVol || ac.state !== 'running') return;
    const when = ac.currentTime + 0.08;
    musChordStart = when;
    // A chapter change is a drift, not a cut — but the drift may never be longer
    // than the palette it is drifting INTO holds a chord for, or the voice-lead
    // is still moving when the next chord lands and the pad sits in a permanent
    // smear. Pasto changes chord every ~5 s, so 6.5 s of crossfade is too slow.
    const far = Math.min(sysMUS_XFADE2, pal.xfade * 2);
    musSetChord(0, when, immediate === false ? pal.xfade : far);
    musChordAt = when + rand(pal.dwellA, pal.dwellB);
    musBarAt = 0;     // re-anchor the rhythm to the new palette's own grid
    musApplyT = 10;   // force the bus/filter/bass glide on the next update
  }

  /**
   * THE LIFT, FIRED.
   *
   * `k` is 0..1 — how big the moment is. Two things happen and they are
   * deliberately different lengths: the three high voices bloom over 1.4 s and
   * take nine seconds to go, which is the part that reads as the place opening
   * up; and a rising arpeggio runs up the chord that is SOUNDING RIGHT NOW,
   * which is the part that reads as a flourish.
   *
   * The arpeggio is built from `musCurChord`, not from a fixed figure, for the
   * same reason the lift voices are in musVoices: the score never stops and
   * never repeats, so anything written against a remembered key is out of tune
   * half the time. Read the harmony, climb it, and it is right in all eleven
   * palettes without a line of per-place code.
   *
   * Safe to call at any time from anywhere: with no audio context, a suspended
   * one, or muted sound, it does nothing at all. CONTRACT: sound is a reward,
   * never a requirement, so the visual half of a wow never waits on this.
   */
  /**
   * The lift's shape, 0..1, from its remaining time. It blooms over
   * sysMUS_LIFT_UP and then falls away over sysMUS_LIFT_DN — asymmetric on
   * purpose: arriving takes a beat and a half, leaving takes nine seconds, which
   * is what makes it a place opening up rather than a chime.
   */
  // The up/dn actually in force. It is LATCHED at musSwell() rather than read
  // live, because a chapter change during the nine seconds a lift is decaying
  // would otherwise re-scale the envelope's own clock underneath it and the
  // tail would jump. Defaults cover the case where the envelope is running
  // before anything has ever swelled (it cannot, but a default is free).
  let musLiftUp = sysMUS_LIFT_UP, musLiftDn = sysMUS_LIFT_DN;

  function musLiftEnv() {
    if (musLiftT <= 0) return 0;
    const up = musLiftUp, dn = musLiftDn;
    // musLiftT counts DOWN from up + dn, so the bloom is at the top of it.
    if (musLiftT > dn) return clamp((up + dn - musLiftT) / up, 0, 1);
    const t = musLiftT / dn;
    return t * t;                     // and it goes the way a room goes quiet
  }

  /**
   * Play one note of a lift figure on whichever voice the place uses. Every
   * instrument here takes (when, midi, pan, vel) except the two that are blown
   * or bowed as single lines — the quena has no pan and the violin wants a
   * duration — so this is the one place that knows the difference.
   */
  function musLiftNote(inst, when, midi, pan, vel, gap) {
    switch (inst) {
      case 'koto':   musKoto(when, midi, pan, vel); return;
      case 'mallet': musMallet(when, midi, pan, vel); return;
      case 'bow':    musBow(when, midi, pan, vel); return;
      case 'glass':  musGlass(when, midi, pan, vel); return;
      case 'quena':  musQuena(when, midi, vel); return;
      case 'violin': musViolin(when, midi, vel, gap * 1.6); return;
      default:       musPluck(when, midi, pan, vel); return;
    }
  }

  // The default character, for a palette that has not been given one. Nothing
  // in sysMUS_PAL is missing a `lift` — a table cannot be missing a rung — but
  // this keeps musSwell total rather than conditional.
  const musLIFT_DEF = { shape: 'up', n: sysMUS_LIFT_ARP, gap: sysMUS_LIFT_GAP, oct: 0, vel: 1 };

  function musSwell(k) {
    const s = clamp(typeof k === 'number' ? k : 1, 0, 1);
    // WHICH FIGURE. Read from the live palette, so a marquee moment sounds like
    // the place it happens in and not like the last twelve — see the `lift`
    // rows in sysMUS_PAL and the shape notes above sysMusLiftDeg().
    const ch = (musPal && musPal.lift) || musLIFT_DEF;
    const inst = ch.inst || (musPal && musPal.lead !== 'none' ? musPal.lead : 'pluck');
    const n = ch.n || sysMUS_LIFT_ARP;
    const gap = ch.gap || sysMUS_LIFT_GAP;
    const shape = sysMUS_LIFT_SHAPES[ch.shape] ? ch.shape : 'up';
    // The envelope is state, not sound, so it is set even when muted: coming
    // back off mute mid-moment should not find a half-finished swell.
    // Latched here rather than read live in musLiftEnv — see musLiftUp.
    // Held rather than replaced while one is already running, for the same
    // reason musLift is: iceland.js and goreme.js call this every frame for
    // twelve seconds, and a swell whose envelope shortened underneath it in the
    // middle of the aurora would be a step, not a hold.
    if (musLiftT <= 0) {
      musLiftUp = ch.up || sysMUS_LIFT_UP;
      musLiftDn = ch.dn || sysMUS_LIFT_DN;
    }
    musLiftT = Math.max(musLiftT, musLiftUp + musLiftDn);
    musLift = Math.max(musLift, s);
    if (!ac || !musVol || ac.state !== 'running' || musMuted) return;
    const chord = musCurChord;
    if (!chord || !chord.length) return;
    // ---- ONE FIGURE PER MOMENT, NOT ONE PER FRAME ------------------------
    // musSwell() is called every frame for the twelve seconds the aurora is
    // climbing (and the same in Cappadocia and Palawan) because holding the
    // envelope is what the hold is FOR. Scheduling the arpeggio unconditionally
    // therefore fired seven hundred overlapping runs, which on the two palettes
    // whose voices ring for ten seconds is not a flourish, it is a wall. The
    // sustained bed is what a hold is made of; the figure plays once, at the
    // front of it.
    const now = ac.currentTime;
    if (now < musLiftArpAt) return;
    musLiftArpAt = now + (musLiftUp + musLiftDn) * 0.55;
    const when = now + 0.04;
    const pan = ch.pan === undefined ? 0.28 : ch.pan;
    // Climb (or pour down) the chord that is SOUNDING, one tone at a time,
    // getting quieter as it goes — a figure that gets LOUDER as it rises reads
    // as an alarm, and this is the opposite of an alarm. 'swell' is the single
    // exception and it is the one place where an alarm is the right answer.
    let t = 0;
    for (let i = 0; i < n; i++) {
      const deg = sysMusLiftDeg(shape, i, n);
      const idx = ((deg % chord.length) + chord.length) % chord.length;
      // OCTAVE STACKING HAS TO STOP SOMEWHERE, AND THE STOP IS ABSOLUTE.
      //
      // The original figure was nine notes long, so 12 * floor(i / chord.length)
      // could never carry it more than two octaves and nobody had to think about
      // it. The long figures here — sixteen opening outward over Hong Kong,
      // eighteen shimmering over Palawan — reach degree seventeen, and the
      // chord tables are not all in the same register either: Kyoto's bottom is
      // MIDI 33 and Cappadocia's top is 82, a range of four octaves before the
      // figure adds a note. Capping the octave COUNT is therefore not enough —
      // two octaves over Palawan's top tone, plus the +12 every lift has, plus
      // that row's +5, is MIDI 120, which is eight kilohertz: a dog whistle, not
      // a shimmer.
      //
      // So the ceiling is stated in pitch, not in octaves, and it is the lift's
      // own register: sysMUS_LIFT sits at 79/84/88, and the flourish belongs in
      // the same air as the voices it is announcing. musFold drops a note by
      // octaves until it is under the roof, which keeps it a chord tone and
      // keeps consecutive notes distinct — a rising run that reaches the top
      // wraps and carries on rising, which on the two eighteen-note textures is
      // the nicest thing it could have done and on the nine-note runs never
      // happens at all.
      const midi = musFold(chord[idx] + 12 * Math.floor(deg / chord.length) + 12 + (ch.oct || 0),
                           sysMUS_LIFT_LO, sysMUS_LIFT_HI);
      // Proportional, not a fixed decrement: the old '0.115 - i * 0.008' went
      // NEGATIVE at fourteen notes and silently truncated any figure longer
      // than that, which is most of the interesting ones.
      const fall = shape === 'swell' ? -0.42 : 0.52;
      const vel = 0.115 * (ch.vel || 1) * (1 - (n > 1 ? i / (n - 1) : 0) * fall)
                * (0.55 + s * 0.45);
      if (vel > 0.004) {
        const g = sysMusLiftGap(shape, gap, i, n);
        musLiftNote(inst, when + t, midi, (i % 2 ? pan : -pan), vel, g);
        t += g;
      } else {
        t += sysMusLiftGap(shape, gap, i, n);
      }
    }
    // The pad leans in underneath it too — wider and brighter — but that is NOT
    // written here. musPad.gain and musFilt.frequency have exactly one writer,
    // the 0.3 s block in update(), which re-derives them from the live palette
    // every third of a second; anything scheduled from here would be overwritten
    // by the next tick of it and the lean-in would last 300 ms. It reads
    // musLiftEnv() instead.
  }

  // Sparse bell / marimba-ish pluck, long release, always a tone of the chord.
  function musPluck(when, midi, panv, vel) {
    const hz = sysMidiHz(midi);
    const rel = rand(2.4, 4.2);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2.008;
    const g = ac.createGain();
    const g2 = ac.createGain();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.setValueAtTime(hz * 6, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(220, hz * 1.6), when + 1.1);
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel, when + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(vel * 0.34, when + 0.008);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + rel * 0.55);
    o.connect(g); o2.connect(g2);
    g.connect(lp); g2.connect(lp);
    let tail = lp;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner();
      pan.pan.value = panv;
      lp.connect(pan);
      tail = pan;
    }
    tail.connect(musPluckDry);
    tail.connect(musSend);
    o.start(when); o2.start(when);
    o.stop(when + rel + 0.1); o2.stop(when + rel + 0.1);
  }

  // ---- the instruments each place is actually played on ---------------------
  // Every biome had its own HARMONY already; four of them were still being
  // played by the same generic triangle-wave pluck, which is why Sydney, the
  // Quay and Kyoto sounded like the same score in three keys. A place is its
  // timbre at least as much as its chords.

  /**
   * KOTO — Kyoto. Thirteen strings of waxed silk over movable bridges.
   * Three things make it read as a koto rather than as a plucked synth: the
   * plectrum transient (a 40 ms band of noise, without which any plucked string
   * sounds like a pad with a fast attack), the very long shimmering tail under a
   * fast-closing filter, and ato-oshi — the left hand pressing the string BEHIND
   * the bridge a moment after the pluck, which bends the note up a semitone
   * while it rings. The bend is the signature; it is used on about a third of
   * the notes, because a player who did it on every note would be showing off.
   */
  function musKoto(when, midi, panv, vel) {
    const hz = sysMidiHz(midi);
    const rel = rand(3.4, 5.4);
    const out = ac.createGain();
    out.gain.value = 1;
    // the plectrum
    const ns = ac.createBufferSource(); ns.buffer = noiseBuf();
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass';
    nf.frequency.value = Math.min(9000, hz * 3.4); nf.Q.value = 1.2;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(Math.max(0.0004, vel * 0.62), when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.045);
    ns.connect(nf); nf.connect(ng); ng.connect(out);
    // the string
    const o = ac.createOscillator(); o.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'triangle';
    o.frequency.setValueAtTime(hz, when);
    o2.frequency.setValueAtTime(hz, when);
    o2.detune.value = rand(-6, 6);
    if (Math.random() < 0.34) {
      // ato-oshi: up a semitone, a beat after the attack, and it stays there
      const t1 = when + rand(0.22, 0.38), t2 = t1 + 0.13, up = hz * 1.0595;
      o.frequency.setValueAtTime(hz, t1); o.frequency.linearRampToValueAtTime(up, t2);
      o2.frequency.setValueAtTime(hz, t1); o2.frequency.linearRampToValueAtTime(up, t2);
    }
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(Math.min(12000, hz * 9), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(240, hz * 1.5), when + 0.9);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), when + 0.006);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0003, vel * 0.26), when + 0.34);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
    const g2 = ac.createGain(); g2.gain.value = 0.4;
    o.connect(g); o2.connect(g2); g2.connect(g);
    g.connect(lp); lp.connect(out);
    let tail = out;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner(); pan.pan.value = panv;
      out.connect(pan); tail = pan;
    }
    tail.connect(musPluckDry); tail.connect(musSend);
    ns.start(when); o.start(when); o2.start(when);
    ns.stop(when + 0.12); o.stop(when + rel + 0.1); o2.stop(when + rel + 0.1);
  }

  /**
   * SHAKUHACHI — Kyoto's lead, and the whole reason the chapter can be sparse
   * without being empty. A bamboo flute is mostly BREATH: the noise band is
   * loudest at the attack and never goes away, and leaving it out is what makes
   * a synth flute sound like a synth. The vibrato arrives late, the way a held
   * breath does, and the note falls slightly flat as it dies (meri) because the
   * player's chin drops as the air runs out.
   */
  function musShaku(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const dur = rand(1.5, 2.6);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(hz, when);
    o.frequency.setValueAtTime(hz, when + dur * 0.62);
    o.frequency.linearRampToValueAtTime(hz * 0.978, when + dur);   // meri
    const vib = ac.createOscillator(); vib.type = 'sine';
    vib.frequency.value = rand(4.2, 5.2);
    const vg = ac.createGain();
    vg.gain.setValueAtTime(0.0001, when);
    vg.gain.linearRampToValueAtTime(hz * 0.008, when + dur * 0.55);
    vib.connect(vg); vg.connect(o.frequency);
    const ns = ac.createBufferSource(); ns.buffer = noiseBuf(); ns.loop = true;
    const nf = ac.createBiquadFilter(); nf.type = 'bandpass';
    nf.frequency.value = Math.min(8000, hz * 2.1); nf.Q.value = 0.75;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel * 0.85), when + 0.10);
    ng.gain.exponentialRampToValueAtTime(Math.max(0.0003, vel * 0.20), when + 0.42);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), when + 0.14);
    g.gain.setValueAtTime(Math.max(0.0004, vel), when + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = Math.min(6000, hz * 5);
    o.connect(g); ns.connect(nf); nf.connect(ng);
    g.connect(lp); ng.connect(lp);
    lp.connect(musPluckDry); lp.connect(musSend);
    o.start(when); vib.start(when); ns.start(when);
    o.stop(when + dur + 0.2); vib.stop(when + dur + 0.2); ns.stop(when + dur + 0.2);
  }

  /**
   * MALLET — Sydney. Soft rosewood, felt-headed: the sound of a hot afternoon in
   * a public garden. A struck bar is a sine plus a strong partial at roughly the
   * fourth harmonic and nothing else; the pluck's sawtooth had far too much in
   * it for a place whose whole character is bleached and open.
   */
  function musMallet(when, midi, panv, vel) {
    const hz = sysMidiHz(midi);
    const rel = rand(1.1, 1.8);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
    const parts = [[1, 1], [3.94, 0.24], [9.2, 0.07]];
    const oscs = [];
    for (let i = 0; i < parts.length; i++) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = hz * parts[i][0];
      const pg = ac.createGain(); pg.gain.value = parts[i][1];
      o.connect(pg); pg.connect(g);
      oscs.push(o);
    }
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = Math.min(7000, hz * 8);
    g.connect(lp);
    let tail = lp;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner(); pan.pan.value = panv;
      lp.connect(pan); tail = pan;
    }
    tail.connect(musPluckDry); tail.connect(musSend);
    for (let i = 0; i < oscs.length; i++) { oscs[i].start(when); oscs[i].stop(when + rel + 0.1); }
  }

  /**
   * BUOY BELL — Circular Quay. One struck bell out on the water, far enough away
   * that it is almost all reverb. Inharmonic partials, because a bell's are, and
   * a bell built from a harmonic series sounds like an organ.
   */
  function musBuoy(when, vel) {
    const hz = sysMidiHz(50 + randInt(0, 3));
    const rel = rand(4.5, 7.0);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, vel), when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
    const parts = [[1, 1], [2.76, 0.5], [5.4, 0.24], [8.9, 0.1]];
    const oscs = [];
    for (let i = 0; i < parts.length; i++) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.value = hz * parts[i][0];
      const pg = ac.createGain(); pg.gain.value = parts[i][1];
      o.connect(pg); pg.connect(g);
      oscs.push(o);
    }
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    g.connect(lp);
    lp.connect(musPluckDry);
    lp.connect(musSend); lp.connect(musSend);      // twice: it is a long way off
    for (let i = 0; i < oscs.length; i++) { oscs[i].start(when); oscs[i].stop(when + rel + 0.1); }
  }

  // ---- the Cali band -------------------------------------------------------
  /** Two hardwood sticks. Almost pure tone, almost no decay, very loud in the mix. */
  function musClave(when, vel) {
    // a real clave is a tuned block: a strong partial near 2.5k and a weak one
    // a fifth above it, and the whole thing is over in 80 ms
    for (let k = 0; k < 2; k++) {
      const o = ac.createOscillator();
      o.type = k ? 'sine' : 'triangle';
      o.frequency.setValueAtTime((k ? 3720 : 2480) * rand(0.99, 1.01), when);
      o.frequency.exponentialRampToValueAtTime((k ? 3400 : 2280), when + 0.05);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * (k ? 0.035 : 0.085), when + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, when + (k ? 0.05 : 0.085));
      o.connect(g); g.connect(musPluckDry); g.connect(musSend);
      o.start(when); o.stop(when + 0.1);
    }
  }

  /** Congas. k: 0 heel, 1 slap, 2 open tone. */
  function musConga(when, k, vel) {
    const hz = k === 2 ? 196 : k === 1 ? 320 : 150;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * rand(0.98, 1.02), when);
    // a struck membrane drops in pitch as the head relaxes — this is most of
    // what separates a conga from a sine blip
    o.frequency.exponentialRampToValueAtTime(hz * 0.72, when + (k === 2 ? 0.16 : 0.06));
    const og = ac.createGain();
    const dur = k === 2 ? 0.30 : k === 1 ? 0.10 : 0.07;
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(vel * (k === 2 ? 0.10 : k === 1 ? 0.055 : 0.035), when + 0.004);
    og.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(og);
    // the skin: a noise transient over the top, brightest on a slap
    const ns = noiseSrc();
    const nf = ac.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = k === 1 ? 2600 : k === 2 ? 900 : 600;
    nf.Q.value = 0.9;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * (k === 1 ? 0.075 : 0.028), when + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + (k === 1 ? 0.075 : 0.045));
    ns.connect(nf); nf.connect(ng);
    og.connect(musPluckDry); ng.connect(musPluckDry);
    og.connect(musSend);
    o.start(when); o.stop(when + dur + 0.05);
    ns.start(when); ns.stop(when + 0.12);
  }

  /** Campana — the big hand cowbell that runs the montuno section. */
  function musCampana(when, vel) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.055, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.20);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 2.2;
    // two inharmonic square partials is the classic cowbell recipe
    for (const hz of [538, 800]) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.value = hz * rand(0.995, 1.005);
      o.connect(bp);
      o.start(when); o.stop(when + 0.24);
    }
    bp.connect(g); g.connect(musPluckDry); g.connect(musSend);
  }

  /** Tumbao bass. Round, short, and never on the downbeat. */
  function musTumbaoNote(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 0.5;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(900, when);
    lp.frequency.exponentialRampToValueAtTime(240, when + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.20, when + 0.012);
    g.gain.exponentialRampToValueAtTime(vel * 0.09, when + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musPluckDry);
    o.start(when); o.stop(when + 0.4);
    o2.start(when); o2.stop(when + 0.4);
  }

  /** Montuno piano — struck octaves, hard attack, no sustain pedal. */
  function musMontunoNote(when, midi, vel) {
    for (let k = 0; k < 2; k++) {
      const hz = sysMidiHz(midi + k * 12);
      const o = ac.createOscillator();
      o.type = k ? 'triangle' : 'square';
      o.frequency.value = hz * rand(0.998, 1.002);
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 0.6;
      lp.frequency.setValueAtTime(hz * 7, when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(400, hz * 2), when + 0.09);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * (k ? 0.030 : 0.048), when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + rand(0.28, 0.42));
      o.connect(lp); lp.connect(g);
      g.connect(musPluckDry); g.connect(musSend);
      o.start(when); o.stop(when + 0.5);
    }
  }

  /** A brass stab: the whole section hitting one chord and stopping dead. */
  function musBrassStab(when, chord, vel) {
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(1200, when);
    lp.frequency.linearRampToValueAtTime(3200, when + 0.05);
    lp.frequency.exponentialRampToValueAtTime(900, when + 0.30);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.055, when + 0.022);   // brass has a lip on it
    g.gain.setValueAtTime(vel * 0.055, when + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    for (let i = 0; i < 3; i++) {
      const n = chord[Math.min(chord.length - 1, i + 1)] + 12;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = sysMidiHz(n);
      o.detune.value = rand(-7, 7);
      o.connect(lp);
      o.start(when); o.stop(when + 0.4);
    }
    lp.connect(g); g.connect(musPluckDry); g.connect(musSend);
  }

  // ---- the Rio bateria -----------------------------------------------------
  /**
   * THE SURDO. The biggest drum in the bateria and the reason a samba school can
   * be heard from a mile away. k: 0 muffled, 1 open.
   *
   * A real surdo is a very low fundamental with almost no overtone, a fast
   * downward pitch bend as the head relaxes, and — on the open stroke — a long
   * ring. The muffled stroke is the same drum with a hand left on it, so it is
   * the same pitch and a tenth of the decay.
   */
  function musSurdo(when, k, vel) {
    const open = k === 1;
    const hz = open ? 62 : 71;
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(hz * 1.5, when);
    o.frequency.exponentialRampToValueAtTime(hz, when + 0.045);
    o.frequency.exponentialRampToValueAtTime(hz * 0.82, when + (open ? 0.5 : 0.12));
    const g = ac.createGain();
    const dur = open ? 0.62 : 0.13;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * (open ? 0.30 : 0.11), when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(g);
    // the beater: a soft thud of noise on top, or it is a sine and not a drum
    const ns = noiseSrc();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 340; lp.Q.value = 0.7;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * 0.055, when + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    ns.connect(lp); lp.connect(ng);
    // Almost entirely dry. A 3.6 s reverb tail on the lowest drum in the game
    // turns the avenue into a car park.
    g.connect(musDrum); ng.connect(musDrum);
    o.start(when); o.stop(when + dur + 0.05);
    ns.start(when); ns.stop(when + 0.1);
  }

  /** Caixa — the snare that never stops. Almost pure noise, very short. */
  function musCaixa(when, vel) {
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1750;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 3600 * rand(0.96, 1.04); bp.Q.value = 0.6;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.030, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.045 + vel * 0.03);
    ns.connect(hp); hp.connect(bp); bp.connect(g);
    g.connect(musDrum); g.connect(musSend);
    ns.start(when); ns.stop(when + 0.1);
  }

  /** Tamborim — six inches across, hit with a plastic beater, extremely bright. */
  function musTamborim(when, vel) {
    const o = ac.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880 * rand(0.98, 1.02), when);
    o.frequency.exponentialRampToValueAtTime(620, when + 0.05);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.045, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.075);
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 5200; bp.Q.value = 1.1;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * 0.038, when + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
    o.connect(g); ns.connect(bp); bp.connect(ng);
    g.connect(musDrum); ng.connect(musDrum); g.connect(musSend);
    o.start(when); o.stop(when + 0.12);
    ns.start(when); ns.stop(when + 0.08);
  }

  /** Agogo — the two-bell. Same inharmonic recipe as the campana, higher and
   *  cleaner, and it is a PAIR, so the two pitches have to be distinct. */
  function musAgogo(when, high, vel) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.042, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.16);
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = high ? 3100 : 2350; bp.Q.value = 2.6;
    const base = high ? 760 : 570;
    for (const mul of [1, 1.487]) {
      const o = ac.createOscillator();
      o.type = 'square';
      o.frequency.value = base * mul * rand(0.996, 1.004);
      o.connect(bp);
      o.start(when); o.stop(when + 0.2);
    }
    bp.connect(g); g.connect(musDrum); g.connect(musSend);
  }

  /**
   * CUICA. A friction drum: a stick inside the shell rubbed with a wet cloth, so
   * the pitch slides continuously and it sounds like an animal. There is nothing
   * else like it in any other biome and it is the single most identifiably
   * Brazilian sound in this file — which is why it gets used sparingly, once or
   * twice a bar, rather than becoming a novelty.
   */
  function musCuica(when, vel, up) {
    const o = ac.createOscillator();
    o.type = 'sawtooth';
    const a = up ? 210 : 380, b = up ? 430 : 190;
    o.frequency.setValueAtTime(a, when);
    o.frequency.exponentialRampToValueAtTime(b, when + 0.17);
    // a resonant peak standing in for the body of the drum: this is what makes
    // it a voice rather than a siren
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 5.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.055, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.22);
    o.connect(bp); bp.connect(g);
    g.connect(musDrum); g.connect(musSend);
    o.start(when); o.stop(when + 0.26);
  }

  /** Cavaquinho — four steel strings, strummed, bright and very short. The
   *  strum is a few milliseconds of stagger across the notes, which is the
   *  whole difference between a strum and a chord. */
  function musCavaco(when, chord, vel) {
    for (let i = 0; i < 4; i++) {
      const n = chord[Math.min(chord.length - 1, i)] + 24;
      const t = when + i * 0.009;
      const o = ac.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = sysMidiHz(n) * rand(0.997, 1.003);
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = sysMidiHz(n) * 2.2; bp.Q.value = 1.6;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vel * 0.026, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + rand(0.13, 0.21));
      o.connect(bp); bp.connect(g);
      g.connect(musPluckDry); g.connect(musSend);
      o.start(t); o.stop(t + 0.26);
    }
  }

  /** Samba bass. Round and short, like the tumbao, but it lands WITH the surdo
   *  instead of dodging the downbeat — which is the opposite of salsa and the
   *  reason it needs its own voice rather than borrowing the tumbao's. */
  function musSambaBassNote(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 0.5;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.0;
    lp.frequency.setValueAtTime(820, when);
    lp.frequency.exponentialRampToValueAtTime(220, when + 0.2);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.19, when + 0.010);
    g.gain.exponentialRampToValueAtTime(vel * 0.07, when + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.30);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musPluckDry);
    o.start(when); o.stop(when + 0.36);
    o2.start(when); o2.stop(when + 0.36);
  }

  // ---- the Pasto band ------------------------------------------------------
  /** Fold a midi note into a register, by octaves. */
  function musFold(n, lo, hi) {
    while (n < lo) n += 12;
    while (n > hi) n -= 12;
    return n < lo ? n + 12 : n;
  }

  /**
   * CHARANGO. A ten-string lute the size of a forearm, its five courses tuned in
   * OCTAVES rather than unisons — that octave doubling is the whole sound, and a
   * single detuned oscillator per note gets nowhere near it. So every strum tone
   * is two oscillators an octave apart, the upper one louder than the lower,
   * through a bandpass sitting where the little sound box resonates.
   * Strummed, not plucked: the notes are spread over ~18 ms of rasgueo.
   */
  // NODE BUDGET. A strum is five a bar at 108, so the per-note cost is the whole
  // design constraint: one filter and one noise burst are SHARED across the
  // strum, and each string's envelope rides on the gain it already needed for
  // its octave balance. That is 13 nodes a strum instead of 36 — the first cut
  // ran ~160 nodes a second and sfx() would have started swallowing wheeks.
  function musCharango(when, chord, vel, up) {
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1750; bp.Q.value = 0.55;
    bp.connect(musPluckDry); bp.connect(musSend);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const idx = up ? (n - 1 - i) : i;
      const hz = sysMidiHz(musFold(chord[idx % chord.length], sysMUS_CHG_LO, sysMUS_CHG_HI));
      const st = when + i * 0.007;                  // the rasgueo spread
      const rel = rand(0.42, 0.68);
      for (let o = 0; o < 2; o++) {
        const osc = ac.createOscillator();
        osc.type = o ? 'triangle' : 'sawtooth';
        osc.frequency.value = o ? hz * 2 : hz;      // the octave course
        osc.detune.value = rand(-6, 6);
        const og = ac.createGain();
        const pk = vel * (0.050 - i * 0.007) * (o ? 0.62 : 1);
        og.gain.setValueAtTime(0.0001, st);
        og.gain.exponentialRampToValueAtTime(Math.max(0.0004, pk), st + 0.004);
        og.gain.exponentialRampToValueAtTime(0.0001, st + rel);
        osc.connect(og); og.connect(bp);
        osc.start(st); osc.stop(st + rel + 0.04);
      }
    }
    // the nail across the strings — one burst for the whole stroke, not per note
    const ns = noiseSrc();
    const nh = ac.createBiquadFilter();
    nh.type = 'highpass'; nh.frequency.value = 3400;
    const ng = ac.createGain();
    env(ng, when, 0.016 * vel, 0.003, 0.035);
    ns.connect(nh); nh.connect(ng); ng.connect(musPluckDry);
    ns.start(when); ns.stop(when + 0.07);
  }

  /** BOMBO LEGÜERO. A wooden shell with a soft mallet: pitch drops fast, almost
   *  no attack click, and the body is felt more than heard. Mostly dry. */
  function musBombo(when, vel) {
    const o = ac.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(96, when);
    o.frequency.exponentialRampToValueAtTime(46, when + 0.13);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0004, 0.30 * vel), when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.34);
    o.connect(g); g.connect(musDrum);
    o.start(when); o.stop(when + 0.38);
    // the mallet on the hide, not a click
    const ns = noiseSrc();
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 380; lp.Q.value = 0.6;
    const ng = ac.createGain();
    env(ng, when, 0.05 * vel, 0.004, 0.07);
    ns.connect(lp); lp.connect(ng); ng.connect(musDrum);
    ns.start(when); ns.stop(when + 0.12);
  }

  /**
   * QUENA. An end-blown notched flute, so the breath is not an ornament on the
   * tone — it is half of it, and a pure oscillator reads as a synth lead every
   * time. Triangle for the body, a quiet octave for the edge, and a band of
   * noise at the blowing frequency that comes in with the note and leaves before
   * it does. The vibrato arrives late, the way a player's does.
   */
  function musQuena(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const dur = rand(0.55, 1.15);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0006, vel), when + 0.07);
    g.gain.setValueAtTime(Math.max(0.0006, vel), when + dur * 0.62);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2;
    const g2 = ac.createGain(); g2.gain.value = 0.22;
    // vibrato, fading IN over the first third
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = rand(4.8, 6.0);
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0.0001, when);
    lg.gain.linearRampToValueAtTime(hz * 0.011, when + dur * 0.45);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    o.connect(g); o2.connect(g2); g2.connect(g);
    // the breath
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz * 2.1; bp.Q.value = 1.4;
    const ng = ac.createGain();
    env(ng, when, vel * 0.5, 0.05, dur * 0.55);
    ns.connect(bp); bp.connect(ng); ng.connect(musPluckDry); ng.connect(musSend);
    ns.start(when); ns.stop(when + dur + 0.1);
    g.connect(musPluckDry); g.connect(musSend);
    o.start(when); o2.start(when); lfo.start(when);
    const stop = when + dur + 0.08;
    o.stop(stop); o2.stop(stop); lfo.stop(stop);
  }

  /**
   * A BOWED STRING — Iceland's lead, and the only voice in the game that is not
   * struck, plucked or blown.
   *
   * Three things do it. The attack is nine tenths of a second, which is longer
   * than any other envelope here by a factor of seventy and is what makes a note
   * seem to have started before you noticed it. The filter OPENS across the
   * attack rather than closing across the decay, because a bow puts more energy
   * into the upper partials the longer it is drawn. And there is a band of noise
   * under the whole thing at about a fiftieth of the level — rosin on horsehair,
   * inaudible on its own, and without it the note is a synth pad.
   */
  function musBow(when, midi, panv, vel) {
    const hz = sysMidiHz(midi);
    const atk = rand(0.7, 1.15);
    const dur = rand(3.4, 6.0);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = hz * 1.0032;
    const o3 = ac.createOscillator(); o3.type = 'triangle'; o3.frequency.value = hz * 0.5;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(Math.max(180, hz * 1.2), when);
    lp.frequency.linearRampToValueAtTime(Math.min(6000, hz * 5.5), when + atk * 1.4);
    lp.frequency.linearRampToValueAtTime(Math.max(200, hz * 1.6), when + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + atk);
    g.gain.setValueAtTime(vel, when + dur * 0.55);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g3 = ac.createGain();
    g3.gain.setValueAtTime(0.0001, when);
    g3.gain.linearRampToValueAtTime(vel * 0.4, when + atk * 1.3);
    g3.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    // the vibrato only arrives once the note is established, the way a player's
    // hand does
    const lfo = ac.createOscillator(); lfo.frequency.value = rand(4.4, 5.6);
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0.0001, when);
    lg.gain.linearRampToValueAtTime(hz * 0.0055, when + atk + 0.6);
    lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    // the rosin
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = Math.min(7000, hz * 4.5); bp.Q.value = 0.9;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.linearRampToValueAtTime(vel * 0.10, when + atk * 0.5);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.8);
    ns.connect(bp); bp.connect(ng);
    o.connect(g); o2.connect(g); o3.connect(g3);
    g.connect(lp); g3.connect(lp); ng.connect(lp);
    let tail = lp;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner();
      pan.pan.value = panv;
      lp.connect(pan);
      tail = pan;
    }
    tail.connect(musPluckDry);
    tail.connect(musSend);
    const stop = when + dur + 0.12;
    o.start(when); o2.start(when); o3.start(when); lfo.start(when); ns.start(when);
    o.stop(stop); o2.stop(stop); o3.stop(stop); lfo.stop(stop); ns.stop(stop);
  }

  /**
   * GLASS — the Drift. A wetted finger on the rim of a bowl.
   *
   * Everything else in this score is struck, plucked or bowed, and all three of
   * those have an ATTACK, which is a transient, which is an event, which puts a
   * thing in a place. A rubbed glass has none: it fades in from nothing over the
   * best part of a second and it fades out over ten, so you cannot tell when it
   * started and you cannot tell when it stopped. That is what a chapter with no
   * ground under it should sound like, and it is why this is the one lead voice
   * in the game with no percussive component at all.
   *
   * Two details make it read as glass rather than as a sine pad:
   *   - THE PARTIALS ARE INHARMONIC. A bowl rings at roughly 1 : 2.76 : 5.40,
   *     not at 1 : 2 : 3. Those ratios are why it shimmers instead of blending,
   *     and moving them to whole numbers turns it back into an organ.
   *   - IT BEATS. The two halves of the fundamental are a fraction of a hertz
   *     apart, so the note breathes on its own at about a second and a half —
   *     which is the sound of a hand going round a rim, and it costs one extra
   *     oscillator.
   */
  function musGlass(when, midi, panv, vel) {
    const hz = sysMidiHz(midi);
    const atk = rand(0.75, 1.35);
    const dur = rand(7.0, 11.5);
    const beat = rand(0.5, 0.9);          // Hz of drift between the two halves
    const parts = [1, 2.76, 5.40];
    const lvls = [1, 0.30, 0.11];
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(vel, when + atk);
    g.gain.setValueAtTime(vel, when + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const oscs = [];
    for (let i = 0; i < parts.length; i++) {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = hz * parts[i];
      const pg = ac.createGain();
      pg.gain.value = lvls[i];
      o.connect(pg); pg.connect(g);
      oscs.push(o);
      if (i === 0) {
        // the beating twin
        const o2 = ac.createOscillator();
        o2.type = 'sine';
        o2.frequency.value = hz + beat;
        const p2 = ac.createGain();
        p2.gain.value = 0.75;
        o2.connect(p2); p2.connect(g);
        oscs.push(o2);
      }
    }
    let tail = g;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner();
      pan.pan.value = panv;
      g.connect(pan);
      tail = pan;
    }
    tail.connect(musPluckDry);
    tail.connect(musSend);
    const stop = when + dur + 0.15;
    for (let i = 0; i < oscs.length; i++) { oscs[i].start(when); oscs[i].stop(stop); }
  }

  /**
   * THE GUEMBRI (sintir, hajhouj). A three-string bass lute with a camel-skin
   * face and a metal rattle on the neck. It is not a bass guitar: the skin is
   * loose, so the note has a percussive THUMP at the front and almost no
   * sustain, and the buzz is a feature of the instrument rather than a fault in
   * it. Both are modelled — the pitch drops a fourth in forty milliseconds
   * (that is the skin), and there is a short burst of high noise on the attack
   * (that is the rattle).
   */
  function musGuembri(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const dur = rand(0.42, 0.62);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(hz * 1.34, when);
    o.frequency.exponentialRampToValueAtTime(hz, when + 0.045);
    const o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = hz;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.30, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(vel * 0.055, when + 0.006);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + dur * 0.4);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 2.2;
    lp.frequency.setValueAtTime(Math.min(2600, hz * 9), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, hz * 2.2), when + dur * 0.7);
    // the rattle
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 3400; bp.Q.value = 1.4;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(Math.max(0.0004, vel * 0.045), when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
    ns.connect(bp); bp.connect(ng);
    o.connect(g); o2.connect(g2);
    g.connect(lp); g2.connect(lp);
    lp.connect(musDrum); ng.connect(musDrum);
    const stop = when + dur + 0.06;
    o.start(when); o2.start(when); ns.start(when); ns.stop(stop);
    o.stop(stop); o2.stop(stop);
  }

  /** QRAQEB — two pairs of iron castanets, and the whole bed of the music. A
   *  very short, very bright noise burst with two metallic partials ringing on
   *  top of it, which is what iron on iron actually is. */
  function musQraqeb(when, vel) {
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 3800;
    const g = ac.createGain();
    g.gain.setValueAtTime(Math.max(0.0004, vel * 0.055), when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.035);
    ns.connect(hp); hp.connect(g); g.connect(musDrum);
    ns.start(when); ns.stop(when + 0.06);
    for (let k = 0; k < 2; k++) {
      const o = ac.createOscillator(); o.type = 'square';
      o.frequency.value = k ? 5100 : 6900;
      const og = ac.createGain();
      og.gain.setValueAtTime(Math.max(0.0002, vel * 0.014), when);
      og.gain.exponentialRampToValueAtTime(0.0001, when + 0.055);
      o.connect(og); og.connect(musDrum);
      o.start(when); o.stop(when + 0.07);
    }
  }

  /** TBEL — a big shallow double-headed drum played with sticks. Lower than a
   *  surdo and much drier: no room on it at all, because it is being played
   *  outdoors on sand. */
  function musTbel(when, vel) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(128, when);
    o.frequency.exponentialRampToValueAtTime(52, when + 0.13);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.44);
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.7;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(Math.max(0.0004, vel * 0.09), when);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.07);
    ns.connect(bp); bp.connect(ng);
    o.connect(g); g.connect(musDrum); ng.connect(musDrum);
    o.start(when); o.stop(when + 0.5);
    ns.start(when); ns.stop(when + 0.1);
  }

  /** Hands. A clap is a very short broadband slap with a little bit of room on
   *  it; six people clapping is the same thing three times, a few milliseconds
   *  apart, which is the only way to keep it from sounding like one person. */
  function musClap(when, vel) {
    for (let k = 0; k < 3; k++) {
      const t = when + k * rand(0.006, 0.017);
      const ns = noiseSrc();
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = rand(1250, 1800); bp.Q.value = 1.1;
      const g = ac.createGain();
      g.gain.setValueAtTime(Math.max(0.0004, vel * 0.07 * (1 - k * 0.22)), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
      ns.connect(bp); bp.connect(g); g.connect(musDrum); g.connect(musSend);
      ns.start(t); ns.stop(t + 0.11);
    }
  }

  /** One 6/8 bar of the rhythm section, on whichever chord is live at that time. */
  function musBar(t0, rh) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const lvl = 0.75 + musIntensity * 0.35;
    for (let i = 0; i < rh.length; i++) {
      const e = rh[i];
      const w = t0 + e.t * sysMUS_EIGHTH;
      if (e.k === 1) musBombo(w, e.v * lvl);
      else musCharango(w, chord, e.v * lvl, e.t === 3);
    }
  }

  /**
   * One bar of salsa. `half` is 0 or 1 — which half of the two-bar clave cycle
   * this bar is, because the clave is the only thing here that does not repeat
   * every bar and everything else is placed against it.
   */
  function musSalsaBar(t0, half) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const E = sysMUS_SALSA_EIGHTH;
    const lvl = 0.80 + musIntensity * 0.30;
    const root = musPal.roots[musIdx];
    const nextRoot = musPal.roots[musPal.next[musIdx][0]];

    // --- clave. Absolute eighths over the two-bar cycle, so this bar takes the
    //     strokes that fall inside its own eight.
    for (let i = 0; i < sysMUS_CLAVE.length; i++) {
      const e = sysMUS_CLAVE[i] - half * sysMUS_SALSA_BAR;
      if (e >= 0 && e < sysMUS_SALSA_BAR) musClave(t0 + e * E, lvl);
    }
    // --- congas
    for (let i = 0; i < sysMUS_CONGA.length; i++) {
      const c = sysMUS_CONGA[i];
      musConga(t0 + c.t * E, c.k, c.v * lvl);
    }
    // --- campana on the quarters, accented on 1 and 3
    for (let e = 0; e < sysMUS_SALSA_BAR; e += 2) {
      musCampana(t0 + e * E, (e % 4 === 0 ? 0.9 : 0.55) * lvl);
    }
    // --- tumbao. The beat-4 note anticipates the next chord, which is the
    //     entire feel of a salsa bassline.
    for (let i = 0; i < sysMUS_TUMBAO.length; i++) {
      const b = sysMUS_TUMBAO[i];
      const useNext = b.a && half === 1;
      musTumbaoNote(t0 + b.t * E, (useNext ? nextRoot : root) + (b.a ? 12 : 0), b.v * lvl);
    }
    // --- montuno guajeo, in octaves off the chord tones
    for (let i = 0; i < sysMUS_MONTUNO.length; i++) {
      const m = sysMUS_MONTUNO[i];
      musMontunoNote(t0 + m.t * E, chord[m.d] + 12, m.v * lvl * 0.9);
    }
    // --- brass: one stab per cycle, on the last clave stroke, and only when
    //     something is actually going on. Sparse is the point — a section that
    //     plays every bar is a fanfare, not a band.
    if (half === 1 && (musIntensity > 0.25 || Math.random() < 0.22)) {
      musBrassStab(t0 + 6 * E, chord, (0.55 + musIntensity * 0.6) * lvl);
    }
  }

  /** One 2/4 bar of the bateria. `half` alternates so the two-bar figures
   *  (the tamborim, the bass anticipation) know which half they are in. */
  function musSambaBar(t0, half) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const S = sysMUS_SAMBA_16;
    const lvl = 0.80 + musIntensity * 0.30;
    const root = musPal.roots[musIdx];
    const nextRoot = musPal.roots[musPal.next[musIdx][0]];

    // --- the surdo. The chapter, in two strokes.
    for (let i = 0; i < sysMUS_SURDO.length; i++) {
      const u = sysMUS_SURDO[i];
      musSurdo(t0 + u.t * S, u.k, u.v * lvl);
    }
    // --- caixa, every sixteenth
    for (let e = 0; e < sysMUS_SAMBA_BAR; e++) musCaixa(t0 + e * S, sysMUS_CAIXA[e] * lvl);
    // --- tamborim, the two-bar teleco-teco
    const tp = sysMUS_TAMB[half];
    for (let i = 0; i < tp.length; i++) musTamborim(t0 + tp[i] * S, (i === 0 ? 0.9 : 0.7) * lvl);
    // --- agogo
    for (let i = 0; i < sysMUS_AGOGO.length; i++) {
      const a = sysMUS_AGOGO[i];
      musAgogo(t0 + a.t * S, a.h, a.v * lvl);
    }
    // --- bass, with the surdo
    for (let i = 0; i < sysMUS_SAMBA_BASS.length; i++) {
      const b = sysMUS_SAMBA_BASS[i];
      const useNext = b.a && half === 1;
      musSambaBassNote(t0 + b.t * S, useNext ? nextRoot : root, b.v * lvl);
    }
    // --- cavaquinho, off the beat
    for (let i = 0; i < sysMUS_CAVACO.length; i++) {
      const c = sysMUS_CAVACO[i];
      musCavaco(t0 + c.t * S, chord, c.v * lvl * 0.9);
    }
    // --- the cuica, sparingly. It is a voice, and a voice that talks over every
    //     bar stops being funny by the second one.
    if (half === 1 && (musIntensity > 0.3 || Math.random() < 0.3)) {
      musCuica(t0 + 6 * S, (0.6 + musIntensity * 0.5) * lvl, 1);
    } else if (half === 0 && Math.random() < 0.12) {
      musCuica(t0 + 2 * S, 0.45 * lvl, 0);
    }
  }

  // ---- the Venice continuo --------------------------------------------------
  /**
   * HARPSICHORD. Three things make a plucked keyboard read as a harpsichord
   * rather than as any other plucked thing:
   *   1. THERE IS NO DYNAMIC. A harpsichord cannot be played louder — the
   *      plectrum plucks the string the same way however hard the key is hit —
   *      so the velocities here vary the FILTER and the note count, never the
   *      gain by much. That constraint is the instrument.
   *   2. IT IS BUZZY. A sawtooth through a high-Q bandpass, plus a very short
   *      noise transient for the quill, and a second string tuned four cents
   *      sharp because a two-manual instrument is never quite in tune with
   *      itself.
   *   3. IT STOPS. The damper lands about 400 ms after the key, so the tail is
   *      short and the room has to do the sustaining. That is why the reverb
   *      send on this voice is the biggest in the game.
   */
  function musCembalo(when, chord, vel) {
    if (!chord) return;
    for (let i = 0; i < chord.length; i++) {
      if (i === 1 && Math.random() < 0.4) continue;     // voice it, don't block it
      const midi = musFold(chord[i], 55, 79);
      const hz = sysMidiHz(midi);
      const rel = 0.34 + Math.random() * 0.16;
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
      const o2 = ac.createOscillator(); o2.type = 'sawtooth';
      o2.frequency.value = hz * 1.0023;
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = hz * 2.4; bp.Q.value = 1.6;
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.017, when + 0.004);
      g.gain.exponentialRampToValueAtTime(vel * 0.006, when + 0.09);
      g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
      o.connect(bp); o2.connect(bp); bp.connect(g);
      g.connect(musPluckDry); g.connect(musSend);
      o.start(when); o2.start(when);
      o.stop(when + rel + 0.05); o2.stop(when + rel + 0.05);
    }
    // the quill
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2600;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * 0.010, when + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.028);
    ns.connect(hp); hp.connect(ng); ng.connect(musPluckDry); ng.connect(musSend);
    ns.start(when); ns.stop(when + 0.06);
  }

  /** CELLO — the walking half of the continuo. Bowed, so it has an attack you
   *  can hear the rosin in and a body that keeps going while the harpsichord's
   *  damper has already landed. It is mixed as loud as the lead, because in this
   *  music it IS a lead. */
  function musCello(when, midi, vel, dur) {
    const hz = sysMidiHz(midi);
    const d = dur || 0.58;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'triangle'; o2.frequency.value = hz * 0.5;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.1;
    lp.frequency.setValueAtTime(hz * 3.2, when);
    lp.frequency.linearRampToValueAtTime(hz * 5.4, when + 0.09);
    lp.frequency.exponentialRampToValueAtTime(Math.max(180, hz * 2.2), when + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.052, when + 0.038);
    g.gain.setValueAtTime(vel * 0.052, when + d * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    // the bow itself — without a whisper of noise a sawtooth is a synth
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = hz * 4; bp.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * 0.006, when + 0.03);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + d * 0.5);
    ns.connect(bp); bp.connect(ng);
    o.connect(lp); o2.connect(lp); lp.connect(g);
    g.connect(musPluckDry); g.connect(musSend);
    ng.connect(musPluckDry);
    o.start(when); o2.start(when); ns.start(when);
    o.stop(when + d + 0.06); o2.stop(when + d + 0.06); ns.stop(when + d + 0.06);
  }

  /** ORGAN PEDAL — one note, very low, only ever heard when the tide is up.
   *  San Marco has had an organ in it since about 1490 and this is the sound of
   *  the water arriving underneath it. */
  function musOrganPedal(when, midi, vel, dur) {
    const hz = sysMidiHz(midi);
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 2;
    const o3 = ac.createOscillator(); o3.type = 'sine'; o3.frequency.value = hz * 3.01;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel * 0.05), when + 0.5);
    g.gain.setValueAtTime(Math.max(0.0002, vel * 0.05), when + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g2 = ac.createGain(); g2.gain.value = 0.4;
    const g3 = ac.createGain(); g3.gain.value = 0.16;
    o.connect(g); o2.connect(g2); g2.connect(g); o3.connect(g3); g3.connect(g);
    g.connect(musPluckDry); g.connect(musSend);
    o.start(when); o2.start(when); o3.start(when);
    o.stop(when + dur + 0.1); o2.stop(when + dur + 0.1); o3.stop(when + dur + 0.1);
  }

  /** BAROQUE VIOLIN. The vibrato does not start with the note — it arrives
   *  about a fifth of a second in, which is what a bowed string actually does
   *  and is most of the difference between a violin and a sawtooth. */
  function musViolin(when, midi, vel, dur) {
    const hz = sysMidiHz(midi);
    const d = dur || 0.5;
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
    const lfo = ac.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 5.4;
    const lg = ac.createGain();
    lg.gain.setValueAtTime(0.0001, when);
    lg.gain.linearRampToValueAtTime(hz * 0.008, when + Math.min(0.28, d * 0.55));
    lfo.connect(lg); lg.connect(o.frequency);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(hz * 2.4, when);
    lp.frequency.linearRampToValueAtTime(hz * 4.6, when + 0.07);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, hz * 2.6), when + d);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), when + 0.045);
    g.gain.setValueAtTime(Math.max(0.0002, vel), when + d * 0.66);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    o.connect(lp); lp.connect(g);
    let tail = g;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner(); pan.pan.value = -0.16;
      g.connect(pan); tail = pan;
    }
    tail.connect(musPluckDry); tail.connect(musSend);
    o.start(when); lfo.start(when);
    o.stop(when + d + 0.06); lfo.stop(when + d + 0.06);
  }

  // ---- the Hong Kong machine ------------------------------------------------
  /** An eighties drum-machine kick: a sine that falls two octaves in 60 ms, with
   *  a click on top. Nothing about it is a real drum and it should not be. */
  function musHkKick(when, vel) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(148, when);
    o.frequency.exponentialRampToValueAtTime(44, when + 0.062);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.30, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.30);
    o.connect(g); g.connect(musDrum);
    o.start(when); o.stop(when + 0.34);
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3200;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, when);
    ng.gain.exponentialRampToValueAtTime(vel * 0.020, when + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, when + 0.014);
    ns.connect(hp); hp.connect(ng); ng.connect(musDrum);
    ns.start(when); ns.stop(when + 0.04);
  }
  /** And the gated snare, which is the single most eighties noise there is: a
   *  wide band of noise with a hard, unnaturally square end on it. */
  function musHkSnare(when, vel) {
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 1900; bp.Q.value = 0.5;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.045, when + 0.003);
    g.gain.setValueAtTime(vel * 0.030, when + 0.085);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.115);   // the gate
    ns.connect(bp); bp.connect(g); g.connect(musDrum); g.connect(musSend);
    ns.start(when); ns.stop(when + 0.16);
    const o = ac.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(232, when);
    o.frequency.exponentialRampToValueAtTime(176, when + 0.06);
    const og = ac.createGain();
    og.gain.setValueAtTime(0.0001, when);
    og.gain.exponentialRampToValueAtTime(vel * 0.018, when + 0.003);
    og.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
    o.connect(og); og.connect(musDrum);
    o.start(when); o.stop(when + 0.1);
  }
  function musHkHat(when, vel, open) {
    const ns = noiseSrc();
    const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7400;
    const g = ac.createGain();
    const d = open ? 0.16 : 0.032;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.016, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + d);
    ns.connect(hp); hp.connect(g); g.connect(musDrum);
    ns.start(when); ns.stop(when + d + 0.03);
  }
  /** The bass: a square through a low resonant filter, which is what every synth
   *  bass in this idiom is, and one octave of movement is the whole part. */
  function musHkBass(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const o = ac.createOscillator(); o.type = 'square'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = hz * 0.997;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 5.5;
    lp.frequency.setValueAtTime(hz * 7, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(120, hz * 2.2), when + 0.13);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.075, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.19);
    o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(musPluckDry);
    o.start(when); o2.start(when);
    o.stop(when + 0.24); o2.stop(when + 0.24);
  }
  /** The arpeggio: one blip per sixteenth, very short, through a filter that
   *  opens with the show. This is the sustained harmony of the chapter — there
   *  is almost no pad under it — so it never stops for the whole biome. */
  function musHkArp(when, midi, vel, open) {
    const hz = sysMidiHz(midi);
    const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'square';
    o2.frequency.value = hz * 2.005;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 6.5;
    lp.frequency.setValueAtTime(hz * (3.5 + open * 5), when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(300, hz * 1.6), when + 0.11);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.020, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.10);
    const g2 = ac.createGain(); g2.gain.value = 0.3;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g);
    let tail = g;
    if (ac.createStereoPanner) {
      const pan = ac.createStereoPanner();
      pan.pan.value = ((midi % 4) - 1.5) * 0.32;
      g.connect(pan); tail = pan;
    }
    tail.connect(musPluckDry); tail.connect(musSend);
    o.start(when); o2.start(when);
    o.stop(when + 0.15); o2.stop(when + 0.15);
  }
  /** GUZHENG — the one acoustic thing in the chapter. A plucked steel string
   *  with the left hand pressing behind the bridge to bend it up a tone AFTER
   *  the note has sounded, which is the ornament the whole instrument is about. */
  function musGuzheng(when, midi, vel) {
    const hz = sysMidiHz(midi);
    const rel = rand(1.6, 2.8);
    const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = hz;
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz * 3.02;
    if (Math.random() < 0.45) {
      o.frequency.setValueAtTime(hz, when + 0.16);
      o.frequency.linearRampToValueAtTime(hz * 1.122, when + 0.34);
      o.frequency.linearRampToValueAtTime(hz, when + 0.62);
    }
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(hz * 8, when);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, hz * 2), when + 0.9);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vel * 0.030, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + rel);
    const g2 = ac.createGain();
    g2.gain.setValueAtTime(0.0001, when);
    g2.gain.exponentialRampToValueAtTime(vel * 0.008, when + 0.004);
    g2.gain.exponentialRampToValueAtTime(0.0001, when + rel * 0.35);
    o.connect(lp); lp.connect(g); o2.connect(g2);
    g.connect(musPluckDry); g.connect(musSend);
    g2.connect(musPluckDry); g2.connect(musSend);
    o.start(when); o2.start(when);
    o.stop(when + rel + 0.1); o2.stop(when + rel + 0.1);
  }
  /** A pad stab, one per tower, while the show is on. Four notes, wide, and it
   *  is the only time this palette does anything sustained at all. */
  function musHkStab(when, chord, vel) {
    if (!chord) return;
    for (let i = 0; i < chord.length; i += 2) {
      const midi = musFold(chord[i], 62, 88);
      const hz = sysMidiHz(midi);
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz;
      const o2 = ac.createOscillator(); o2.type = 'sawtooth';
      o2.frequency.value = hz * 1.006;
      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass'; lp.Q.value = 2.0;
      lp.frequency.setValueAtTime(hz * 6, when);
      lp.frequency.exponentialRampToValueAtTime(Math.max(500, hz * 1.8), when + 0.9);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, when);
      g.gain.exponentialRampToValueAtTime(vel * 0.013, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 1.0);
      o.connect(lp); o2.connect(lp); lp.connect(g);
      g.connect(musPluckDry); g.connect(musSend);
      o.start(when); o2.start(when);
      o.stop(when + 1.05); o2.stop(when + 1.05);
    }
  }

  /**
   * ONE BAR OF CONTINUO — a cello walking in crotchets and a harpsichord filling
   * the gaps between them. `musVenTide` (0..1, from venice.js) is the one live
   * input: as the water comes up the harpsichord thins out and an organ pedal
   * arrives underneath, so the tide is audible from inside a lane where the
   * square cannot be seen at all.
   */
  function musBaroqueBar(t0) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const Q = sysMUS_BAR_Q;
    const lvl = 0.85 + musIntensity * 0.25;
    const root = musPal.roots[musIdx];
    const tide = musVenTide;

    for (let i = 0; i < sysMUS_CONTINUO.length; i++) {
      const c = sysMUS_CONTINUO[i];
      const midi = musFold(chord[c.d % chord.length], root + 5, root + 21);
      musCello(t0 + c.t * Q, midi, c.v * lvl * (1 - tide * 0.18), Q * 1.85);
    }
    // the harpsichord is what the water takes away
    if (tide < 0.92) {
      for (let i = 0; i < sysMUS_CEMBALO.length; i++) {
        const c = sysMUS_CEMBALO[i];
        if (tide > 0.35 && i > 1 && Math.random() < tide) continue;
        musCembalo(t0 + c.t * Q, chord, c.v * lvl * (1 - tide * 0.55));
      }
    }
    // ...and the organ is what it brings
    if (tide > 0.22) {
      musOrganPedal(t0, root - 12, (tide - 0.22) * 1.3 * lvl, Q * sysMUS_BAR_QN);
    }
  }

  /**
   * ONE BAR OF THE MACHINE. Sixteen sixteenths, and `musBeatLen` is a CROTCHET —
   * kowloon.js lights one tower per `game.music.beats()`, so this is the clock
   * the far shore is dancing to.
   *
   * `musHkShow` (0..1) is the live input: the filter opens, the hats double, and
   * a stab lands on the downbeat. It is not a different arrangement, it is the
   * same arrangement with the lid off, which is what a city doing this once an
   * evening should sound like.
   */
  function musHkBar(t0, bar) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const S = sysMUS_HK_16;
    const lvl = 0.85 + musIntensity * 0.25;
    const show = musHkShow;
    const root = musPal.roots[musIdx];

    for (let i = 0; i < sysMUS_HK_KICK.length; i++) {
      const k = sysMUS_HK_KICK[i];
      musHkKick(t0 + k.t * S, k.v * lvl);
    }
    for (let i = 0; i < sysMUS_HK_SNARE.length; i++) {
      const k = sysMUS_HK_SNARE[i];
      musHkSnare(t0 + k.t * S, k.v * lvl * (0.9 + show * 0.3));
    }
    for (let e = 0; e < sysMUS_HK_BAR; e++) {
      const v = sysMUS_HK_HAT[e];
      if (v > 0) musHkHat(t0 + e * S, v * lvl, e === 14);
      else if (show > 0.5 && e % 2 === 1) musHkHat(t0 + e * S, 0.3 * lvl * show, false);
    }
    for (let i = 0; i < sysMUS_HK_BASS.length; i++) {
      const b = sysMUS_HK_BASS[i];
      musHkBass(t0 + b.t * S, root + b.o, b.v * lvl);
    }
    for (let e = 0; e < sysMUS_HK_BAR; e++) {
      const step = sysMUS_HK_ARP[(e + bar * 3) % sysMUS_HK_ARP.length];
      const midi = musFold(root + 24 + sysMUS_HK_YU[step], 62, 86);
      musHkArp(t0 + e * S, midi, (e % 2 === 0 ? 1 : 0.62) * lvl, show);
    }
    // the guzheng, every fourth bar, and only in the gaps
    if (bar % 4 === 2) {
      const n = 3 + (Math.random() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const step = sysMUS_HK_YU[randInt(0, 4)];
        musGuzheng(t0 + (4 + i * 3) * S, musFold(root + 24 + step, 66, 88),
                   (0.8 - i * 0.12) * lvl);
      }
    }
    if (show > 0.25) musHkStab(t0, chord, show * lvl);
  }

  /**
   * ONE CELL OF GNAWA — twelve pulses, and the same twelve pulses again.
   *
   * Two live inputs make this the only arrangement in the game that is written
   * against the WORLD rather than only against the clock:
   *
   *   musGnawaStrip  the sandstorm. Everything but the iron goes; the qraqeb
   *                  stay because a sandstorm IS a hiss, and taking them out
   *                  too would leave a hole where the music was rather than a
   *                  storm where the music was.
   *   musGnawaBuild  the fire circle. The hands come in on the four dotted
   *                  beats, the tbel doubles up, and the guembri leans on it.
   */
  function musGnawaCell(t0) {
    const chord = (t0 < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
    if (!chord) return;
    const P = sysMUS_GNAWA_PULSE;
    const strip = musGnawaStrip;
    const open = 1 - strip;
    const build = musGnawaBuild;
    const lvl = (0.78 + musIntensity * 0.28) * (0.55 + build * 0.55);
    const root = musPal.roots[musIdx];

    // --- the iron. Never stops, and in the storm it is all there is.
    for (let e = 0; e < sysMUS_GNAWA_CELL; e++) {
      musQraqeb(t0 + e * P, sysMUS_QRAQEB[e] * (0.62 + build * 0.5) * (0.7 + strip * 0.5));
      // at full build they double, which is what a gnawa group does when the
      // thing they are playing for starts to work
      if (build > 0.5 && e % 2 === 1) musQraqeb(t0 + (e + 0.5) * P, sysMUS_QRAQEB[e] * 0.34 * build);
    }
    if (open < 0.05) return;

    // --- the guembri
    for (let i = 0; i < sysMUS_GUEMBRI.length; i++) {
      const gq = sysMUS_GUEMBRI[i];
      musGuembri(t0 + gq.t * P, root + sysMUS_GUEMBRI_P[gq.d], gq.v * lvl * open);
    }
    // --- the drum
    for (let i = 0; i < sysMUS_TBEL.length; i++) {
      const tb = sysMUS_TBEL[i];
      musTbel(t0 + tb.t * P, tb.v * lvl * open);
      if (build > 0.45 && tb.t === 0) musTbel(t0 + 3 * P, tb.v * 0.55 * build * open);
    }
    // --- and the hands, only when something is going on
    if (build > 0.2) {
      for (let i = 0; i < sysMUS_GNAWA_CLAP.length; i++) {
        musClap(t0 + sysMUS_GNAWA_CLAP[i] * P, (0.5 + build * 0.6) * open);
      }
    }
  }

  // Lookahead scheduler on the AudioContext clock — never the render loop.
  function musTick() {
    if (!ac || !musVol || ac.state !== 'running') return;
    const now = ac.currentTime;
    if (musChordAt < now) musChordAt = now + 0.05;
    if (musPluckAt < now) musPluckAt = now + 0.2;
    const horizon = now + sysMUS_LOOK;
    let guard = 0;
    while (musChordAt < horizon && guard++ < 8) {
      const nx = musPal.next[musIdx] || musPal.next[0];
      musIdx = nx[randInt(0, nx.length - 1)];
      musChordStart = musChordAt;
      musSetChord(musIdx, musChordAt, musPal.xfade);
      musChordAt += rand(musPal.dwellA, musPal.dwellB);
    }
    guard = 0;
    const lead = musPal.lead;
    while (musPluckAt < horizon && guard++ < 12) {
      if (Math.random() < 0.7) {
        const ch = (musPluckAt < musChordStart && musPrevChord) ? musPrevChord : musCurChord;
        if (ch) {
          const pan = rand(-0.75, 0.75);
          const v = rand(0.028, 0.075) * (0.75 + musIntensity * 0.5);
          if (lead === 'quena') {
            musQuena(musPluckAt, musFold(ch[randInt(0, ch.length - 1)], sysMUS_QNA_LO, sysMUS_QNA_HI),
              rand(0.030, 0.058) * (0.8 + musIntensity * 0.4));
          } else if (lead === 'koto') {
            // A koto sits LOW compared with the pluck it replaces — the open
            // strings of a standard hirajoshi tuning run from about D3 — and the
            // chapter's chord set was written for exactly those pitches.
            musKoto(musPluckAt, musFold(ch[randInt(0, ch.length - 1)] + 12 * randInt(0, 1), 50, 74),
              pan, v * 1.15);
          } else if (lead === 'bow') {
            // A bowed note is a LONG note and two of them overlapping is a
            // chord, which the pad is already doing, so the register is pushed
            // up out of the pad's way and the velocity down under it.
            musBow(musPluckAt, musFold(ch[randInt(0, ch.length - 1)] + 12, 62, 84),
              pan * 0.6, rand(0.020, 0.040) * (0.85 + musIntensity * 0.35));
          } else if (lead === 'glass') {
            // A glass note lasts ten seconds, so two of them overlap by design
            // and the register has to stay clear of the pad — high, and quiet
            // enough that three at once is still a texture and not a chord.
            musGlass(musPluckAt, musFold(ch[randInt(0, ch.length - 1)] + 12 * randInt(1, 2), 64, 88),
              pan * 0.7, rand(0.016, 0.032) * (0.85 + musIntensity * 0.3));
          } else if (lead === 'violin') {
            // A FIGURE, NOT A NOTE. Baroque melody is a line: every other
            // palette here drops one note into a gap, and one note in this
            // idiom sounds like somebody testing an instrument. Four quavers
            // stepping through the chord in one direction is the smallest
            // thing that reads as a phrase.
            const dir = Math.random() < 0.55 ? 1 : -1;
            let idx = randInt(0, ch.length - 1);
            const n = randInt(3, 5);
            for (let k = 0; k < n; k++) {
              const m = musFold(ch[((idx % ch.length) + ch.length) % ch.length] + 12, 67, 88);
              musViolin(musPluckAt + k * sysMUS_BAR_Q, m,
                        rand(0.024, 0.042) * (0.85 + musIntensity * 0.3) * (k === 0 ? 1.15 : 1),
                        sysMUS_BAR_Q * (k === n - 1 ? 2.2 : 1.05));
              idx += dir;
            }
          } else if (lead === 'mallet') {
            musMallet(musPluckAt, Math.min(88, ch[randInt(0, ch.length - 1)] + 12 * randInt(1, 2)),
              pan, v * 1.2);
          } else {
            const n = Math.min(84, ch[randInt(0, ch.length - 1)] + 12 * randInt(1, 2));
            musPluck(musPluckAt, n, pan, v);
          }
        }
      }
      musPluckAt += rand(musPal.pluckA, musPal.pluckB) * (1 - musIntensity * 0.32);
    }
    // ---- the sparse voices: one phrase, a long way apart --------------------
    // These are ATMOSPHERE, not melody. The gap between them is doing as much
    // work as the notes are, so they get their own slow clocks rather than
    // riding the pluck's.
    if (musPal.shaku) {
      if (musShakuAt < now) musShakuAt = now + rand(3, 9);
      guard = 0;
      while (musShakuAt < horizon && guard++ < 4) {
        const ch = musCurChord;
        if (ch) {
          const n = randInt(2, 4);
          let t = musShakuAt;
          let m = musFold(ch[randInt(0, ch.length - 1)], 62, 79);
          const dir = Math.random() < 0.5 ? -1 : 1;
          for (let i = 0; i < n; i++) {
            musShaku(t, m, rand(0.020, 0.036) * (0.85 + musIntensity * 0.3));
            t += rand(1.5, 2.6);
            m = musFold(ch[randInt(0, ch.length - 1)] + dir * 12 * (Math.random() < 0.4 ? 1 : 0), 62, 79);
          }
          musShakuAt = t + rand(9, 19);
        } else musShakuAt += 6;
      }
    }
    if (musPal.buoy) {
      if (musBuoyAt < now) musBuoyAt = now + rand(4, 10);
      guard = 0;
      while (musBuoyAt < horizon && guard++ < 4) {
        musBuoy(musBuoyAt, rand(0.026, 0.044));
        musBuoyAt += rand(11, 23);
      }
    }
    // ---- rhythm section, on its own much shorter horizon --------------------
    if (musPal.band === 'salsa') {
      const barLen = sysMUS_SALSA_BAR * sysMUS_SALSA_EIGHTH;
      if (musBarAt < now) {
        // (Re)anchor. Everything that has to line up with the beat — the chord
        // changes, the clave, and the dance floor in Cali — is measured from
        // musBarAnchor, so it is set ONCE and then only ever marched forward.
        musBarAt = now + 0.08;
        musBarAnchor = musBarAt;
        musBarIndex = 0;
        // pull the harmony onto the same grid: two bars a chord, changing on a
        // downbeat, or the vamp and the clave drift apart within a minute
        musChordAt = musBarAt;
      }
      guard = 0;
      while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 4) {
        musSalsaBar(musBarAt, musBarIndex & 1);
        musBarAt += barLen;
        musBarIndex++;
      }
      musBeatLen = barLen / 4;
      return;
    }
    if (musPal.band === 'gnawa') {
      // A cell rather than a bar, because 12/8 gnawa has no bar line the way a
      // 4/4 arrangement does — it has a cycle, and the cycle is the unit.
      const cellLen = sysMUS_GNAWA_CELL * sysMUS_GNAWA_PULSE;
      if (musBarAt < now) {
        musBarAt = now + 0.08;
        musBarAnchor = musBarAt;
        musBarIndex = 0;
        musChordAt = musBarAt;          // four cells a chord, changing on a downbeat
      }
      guard = 0;
      while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 4) {
        musGnawaCell(musBarAt);
        musBarAt += cellLen;
        musBarIndex++;
      }
      // four dotted-quarter beats to the cell
      musBeatLen = cellLen / 4;
      return;
    }
    if (musPal.band === 'baroque') {
      // ONE CHORD A BAR, and the chord change is pulled onto the bar line: a
      // sequence whose harmony drifts off the downbeat stops being a sequence
      // within about four bars and starts being a mistake.
      const barLen = sysMUS_BAR_QN * sysMUS_BAR_Q;
      if (musBarAt < now) {
        musBarAt = now + 0.08;
        musBarAnchor = musBarAt;
        musBarIndex = 0;
        musChordAt = musBarAt;
      }
      guard = 0;
      while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 4) {
        musBaroqueBar(musBarAt);
        musBarAt += barLen;
        musBarIndex++;
      }
      musBeatLen = barLen / 4;
      return;
    }
    if (musPal.band === 'hk') {
      const barLen = sysMUS_HK_BAR * sysMUS_HK_16;
      if (musBarAt < now) {
        musBarAt = now + 0.08;
        musBarAnchor = musBarAt;
        musBarIndex = 0;
        musChordAt = musBarAt;
      }
      guard = 0;
      while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 4) {
        musHkBar(musBarAt, musBarIndex);
        musBarAt += barLen;
        musBarIndex++;
      }
      // A CROTCHET, not a bar. kowloon.js lights one tower per game.music
      // .beats(), so this number is literally the speed of the marquee moment.
      musBeatLen = barLen / 4;
      return;
    }
    if (musPal.band === 'samba') {
      // Same shape as the salsa branch, but a 2/4 bar: the anchor lands on a
      // downbeat and musBeatLen is HALF a bar, so game.music.beats() counts
      // 0,1,2,3... = one, two, one, two. rio.js scores odd beats — the surdo —
      // and that identity is the whole chapter, so it must not be reshuffled.
      const barLen = sysMUS_SAMBA_BAR * sysMUS_SAMBA_16;
      if (musBarAt < now) {
        musBarAt = now + 0.08;
        musBarAnchor = musBarAt;
        musBarIndex = 0;
        musChordAt = musBarAt;         // two bars a chord, changing on a downbeat
      }
      guard = 0;
      while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 6) {
        musSambaBar(musBarAt, musBarIndex & 1);
        musBarAt += barLen;
        musBarIndex++;
      }
      musBeatLen = barLen / 2;
      return;
    }
    const rh = musPal.rhythm;
    if (!rh) { musBarAt = 0; musBeatLen = 0; return; }
    const barLen = sysMUS_BAR * sysMUS_EIGHTH;
    if (musBarAt < now) musBarAt = now + 0.06;
    guard = 0;
    while (musBarAt < now + sysMUS_RHY_LOOK && guard++ < 4) {
      musBar(musBarAt, rh);
      musBarAt += barLen;
    }
    musBeatLen = 0;
  }

  function musicStart() {
    if (!ac || musVol) return;
    musVol = ac.createGain();
    musVol.gain.value = musMuted ? 0.0001 : musLevel;
    // ---- THE SCORE CAN BECOME A THING IN THE WORLD -------------------------
    // Everything the music does still goes through musVol, so the player's own
    // volume and the mute key keep working untouched. What is inserted between
    // musVol and the master is a PLACE: a gain, a low-pass and a pan that a
    // biome may claim by publishing musSource(). Left unclaimed the gain is 1,
    // the filter is at 20 kHz and the pan is centre, which is bit-for-bit what
    // this graph did before — no biome pays for a feature it does not use.
    //
    // Chapter five is the one that uses it. The salsa has been a score for five
    // tasks; the moment the chiva pulls away it is a band on the roof of a bus,
    // and being swept off that roof by a cable is a thing you HEAR happen.
    musPlaceLP = ac.createBiquadFilter();
    musPlaceLP.type = 'lowpass';
    musPlaceLP.Q.value = 0.4;
    musPlaceLP.frequency.value = 20000;
    musPlacePan = ac.createStereoPanner ? ac.createStereoPanner() : null;
    musPlaceGain = ac.createGain();
    musPlaceGain.gain.value = 1;
    musVol.connect(musPlaceLP);
    if (musPlacePan) { musPlaceLP.connect(musPlacePan); musPlacePan.connect(musPlaceGain); }
    else musPlaceLP.connect(musPlaceGain);
    musPlaceGain.connect(acMaster);

    musConv = ac.createConvolver();
    musConv.normalize = true;
    musConv.buffer = musIR(3.6, 2.4);
    musWet = ac.createGain(); musWet.gain.value = 0.95;
    musConv.connect(musWet); musWet.connect(musVol);
    musSend = ac.createGain(); musSend.gain.value = 1;
    musSend.connect(musConv);
    musDry = ac.createGain(); musDry.gain.value = 0.5;
    musDry.connect(musVol);
    musPluckDry = ac.createGain(); musPluckDry.gain.value = 0.42;
    musPluckDry.connect(musVol);
    // The bombo goes almost entirely dry: a 3.6 s convolution tail on a drum is
    // a cathedral, and this one is standing in an open square.
    musDrum = ac.createGain(); musDrum.gain.value = 0.62;
    musDrum.connect(musVol);
    const drumSend = ac.createGain(); drumSend.gain.value = 0.10;
    musDrum.connect(drumSend); drumSend.connect(musSend);

    // slow-moving low-pass over the whole pad
    musFilt = ac.createBiquadFilter();
    musFilt.type = 'lowpass'; musFilt.Q.value = 0.6; musFilt.frequency.value = 620;
    musPad = ac.createGain(); musPad.gain.value = sysMUS_BUS;
    musFilt.connect(musPad);
    musPad.connect(musDry); musPad.connect(musSend);

    // two independent slow LFOs so the drift never repeats on a short cycle
    const lf1 = ac.createOscillator(); lf1.frequency.value = 0.031;
    const lg1 = ac.createGain(); lg1.gain.value = 210;
    lf1.connect(lg1); lg1.connect(musFilt.frequency); lf1.start();
    const lf2 = ac.createOscillator(); lf2.frequency.value = 0.0173;
    const lg2 = ac.createGain(); lg2.gain.value = 120;
    lf2.connect(lg2); lg2.connect(musFilt.frequency); lf2.start();
    // gentle chorus: a very slow detune wobble on part of each bank
    const lf3 = ac.createOscillator(); lf3.frequency.value = 0.077;
    const lg3 = ac.createGain(); lg3.gain.value = 5.5;
    lf3.connect(lg3); lf3.start();

    for (let i = 0; i < sysMUS_CENTRE.length; i++) {
      const v = musMakeVoice(sysMUS_CENTRE[i], sysMUS_LEVEL[i], sysMUS_TYPE[i], sysMUS_SPREAD, musFilt);
      for (let b = 0; b < 2; b++) lg3.connect(v.banks[b].oscs[i % v.banks[b].oscs.length].detune);
      musVoices.push(v);
    }
    // soft bass underneath, mostly dry so it stays defined
    const bassLp = ac.createBiquadFilter();
    bassLp.type = 'lowpass'; bassLp.frequency.value = 210; bassLp.Q.value = 0.4;
    musBassGain = ac.createGain(); musBassGain.gain.value = 0.26;
    bassLp.connect(musBassGain); musBassGain.connect(musDry);
    musBassV = musMakeVoice(33, 0.5, 'sine', [0, 5], bassLp);

    // The thickening layer: high, breathy, silent at 0 tasks and only ever a
    // shimmer at 18. It is a full chord voice, so it voice-leads with the rest.
    musShimGain = ac.createGain();
    musShimGain.gain.value = 0.0001;
    // Routed around the pad's low-pass so it stays airy rather than muffled, but
    // still through the same reverb, so it sits in the same room as everything else.
    musShimGain.connect(musDry);
    musShimGain.connect(musSend);
    musShimV = musMakeVoice(sysMUS_SHIM, sysMUS_SHIM_L, 'triangle', sysMUS_SPREAD, musShimGain);
    for (let b = 0; b < 2; b++) lg3.connect(musShimV.banks[b].oscs[0].detune);
    musVoices.push(musShimV);

    // ---- THE CHOIR -------------------------------------------------------
    // Four sawtooth banks through three parallel band-passes tuned to the
    // formants of an open "ah". That is genuinely all a sung vowel is: a buzzy
    // source and a couple of resonances, and a sawtooth is a very good larynx.
    //
    // They are pushed into musVoices, so they voice-lead across every chord
    // change exactly like the pad does and cost nothing at all when the gain is
    // down. And the gain is down everywhere but under one sky.
    musChoirGain = ac.createGain();
    musChoirGain.gain.value = 0.0001;
    musChoirGain.connect(musDry);
    musChoirGain.connect(musSend);
    musChoirIn = ac.createGain();
    musChoirIn.gain.value = 1;
    for (let k = 0; k < sysMUS_FORMANT.length; k++) {
      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = sysMUS_FORMANT[k];
      bp.Q.value = k === 2 ? 5 : 7;
      const bg = ac.createGain();
      bg.gain.value = k === 0 ? 1 : k === 1 ? 0.62 : 0.22;
      musChoirIn.connect(bp); bp.connect(bg); bg.connect(musChoirGain);
    }
    // a whisper of the raw source under the formants, or it reads as a vocoder
    const chDry = ac.createGain(); chDry.gain.value = 0.12;
    musChoirIn.connect(chDry); chDry.connect(musChoirGain);
    for (let k = 0; k < sysMUS_CHOIR_C.length; k++) {
      const v = musMakeVoice(sysMUS_CHOIR_C[k], sysMUS_CHOIR_L[k], 'sawtooth', sysMUS_SPREAD, musChoirIn);
      for (let b = 0; b < 2; b++) lg3.connect(v.banks[b].oscs[0].detune);
      musChoirV.push(v);
      musVoices.push(v);
    }

    // ---- THE LIFT --------------------------------------------------------
    // Built exactly like the shimmer and for the same reason: routed AROUND the
    // pad's low-pass so it stays bright (the pad's filter sits at 470 in Iceland
    // and these notes live two octaves above it), and through the same reverb so
    // it is in the same room as the rest of the score. It is in musVoices, so it
    // voice-leads through every chord change for as long as it is up, and costs
    // nothing but three oscillator phases for the other fifty-nine minutes.
    musLiftGain = ac.createGain();
    musLiftGain.gain.value = 0.0001;
    musLiftGain.connect(musDry);
    musLiftGain.connect(musSend);
    for (let k = 0; k < sysMUS_LIFT.length; k++) {
      const v = musMakeVoice(sysMUS_LIFT[k], sysMUS_LIFT_L[k], 'triangle', sysMUS_SPREAD, musLiftGain);
      for (let b = 0; b < 2; b++) lg3.connect(v.banks[b].oscs[0].detune);
      musLiftV.push(v);
      musVoices.push(v);
    }

    musIdx = randInt(0, musPal.chords.length - 1);
    musChordStart = ac.currentTime;
    musSetChord(musIdx, ac.currentTime + 0.05, musPal.xfade);
    musChordAt = ac.currentTime + rand(musPal.dwellA, musPal.dwellB);
    musPluckAt = ac.currentTime + rand(4, 8);

    // fade in over a few seconds — the game has already started by here
    musVol.gain.setValueAtTime(0.0001, ac.currentTime);
    musVol.gain.setTargetAtTime(musMuted ? 0.0001 : musLevel, ac.currentTime + 0.4, 1.8);
    musTick();
    if (!musTimerId) musTimerId = setInterval(musTick, sysMUS_TICK);
  }

  function musApplyVolume() {
    if (!musVol) return;
    musVol.gain.setTargetAtTime(musMuted ? 0.0001 : musLevel, ac.currentTime, 0.12);
  }

  // ---- PUTTING THE SCORE SOMEWHERE ------------------------------------------
  // Asked of the LIVE biome only, for the same reason capyWater() and wind() are
  // — game.cali stays resident after you leave Cali, and a band that was still
  // eight hundred metres away in world coordinates would quietly mute the music
  // for the rest of the run.
  const musROLL_FLAT = 8;      // m inside which it is simply "here", at full level
  const musROLL_REF = 16;      // m of falloff to half
  const musROLL_MIN = 0.05;
  function musSourceOf() {
    const b = game.biome;
    if (!b) return null;
    const api = b.isActive('cali') ? game.cali : null;
    if (!api || typeof api.musSource !== 'function') return null;
    const s = api.musSource();
    if (!s || typeof s.x !== 'number' || s.x !== s.x) return null;
    return s;
  }
  function musPlaceTick() {
    if (!ac || !musPlaceGain || ac.state !== 'running') return;
    const s = musSourceOf();
    let g = 1, f = 20000, pan = 0;
    if (s) {
      const l = (game.capy && game.capy.position) || camera.position;
      const dx = s.x - l.x, dy = s.y - l.y, dz = s.z - l.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const over = Math.max(0, d - musROLL_FLAT);
      g = clamp(1 / (1 + (over * over) / (musROLL_REF * musROLL_REF)), musROLL_MIN, 1);
      // Distance eats the top before it eats the level — that is the whole
      // reason this is a filter and not just a fader. A salsa band two streets
      // away is congas and bass and no cymbals.
      const t = clamp(over / 62, 0, 1);
      f = 780 + 19220 * (1 - t) * (1 - t);
      // Pan by where it is across the screen, not by world x: the rig orbits.
      camera.getWorldDirection(sysV1);
      sysV2.set(-sysV1.z, 0, sysV1.x).normalize();          // camera right, flattened
      pan = clamp((dx * sysV2.x + dz * sysV2.z) / 26, -0.85, 0.85);
    }
    const now = ac.currentTime;
    musPlaceGain.gain.setTargetAtTime(g, now, 0.16);
    musPlaceLP.frequency.setTargetAtTime(f, now, 0.16);
    if (musPlacePan) musPlacePan.pan.setTargetAtTime(pan, now, 0.20);
  }
  function setMusicMuted(m) {
    musMuted = !!m;
    musApplyVolume();
    toast(musMuted ? 'music off' : 'music on');
  }
  function setMusicVolume(v) {
    musLevel = clamp(v, 0, 1);
    musApplyVolume();
    toast('music ' + Math.round(musLevel * 100) + '%');
  }

  /**
   * A CHURCH ORGAN. Specifically the Klais in Hallgrimskirkja, which is fifteen
   * metres tall and has five thousand two hundred and seventy-five pipes, and
   * which a capybara is about to lean on.
   *
   * It is the biggest sound in this game and it is built out of the smallest
   * idea: an organ stop is a rank of pipes sounding the SAME note at different
   * octaves and fifths, and a "full organ" is several of those ranks at once.
   * So this is one chord, voiced at unison, octave, twelfth and fifteenth, on
   * sawtooths, with a thirty-millisecond wind chiff at the front (the sound of
   * the pallet opening, without which no amount of harmonics reads as a pipe)
   * and a two-second release that is really the room.
   *
   * It borrows the chord the SCORE is currently sitting on, so it can never be
   * out of key with whatever else is playing.
   */
  function sfxOrgan(vol, pitch) {
    const t = ac.currentTime;
    const chord = musCurChord || [38, 45, 50, 53, 57];
    const hold = 3.2, rel = 2.4;
    const out = ac.createGain();
    out.gain.value = 1;
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(600, t);
    lp.frequency.linearRampToValueAtTime(3600, t + 0.35);
    lp.frequency.linearRampToValueAtTime(1400, t + hold + rel);
    lp.connect(out);
    // 16', 8', 5 1/3' and 4' — unison, octave, twelfth, fifteenth
    const RANK = [-12, 0, 7, 12];
    const LVL  = [0.055, 0.060, 0.020, 0.028];
    for (let i = 0; i < chord.length; i++) {
      for (let r = 0; r < RANK.length; r++) {
        const hz = sysMidiHz(chord[i] + RANK[r]) * pitch;
        if (hz > 9000) continue;
        const o = ac.createOscillator();
        o.type = r === 2 ? 'triangle' : 'sawtooth';
        o.frequency.value = hz;
        o.detune.value = rand(-4, 4);
        const g = ac.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(LVL[r] * vol, t + 0.09);
        g.gain.setValueAtTime(LVL[r] * vol, t + hold);
        g.gain.exponentialRampToValueAtTime(0.0001, t + hold + rel);
        o.connect(g); g.connect(lp);
        o.start(t); o.stop(t + hold + rel + 0.1);
      }
    }
    // a 32' pedal, sine, because at that pitch a sawtooth is just a rattle
    const ped = ac.createOscillator(); ped.type = 'sine';
    ped.frequency.value = sysMidiHz(chord[0] - 24) * pitch;
    const pg = ac.createGain();
    pg.gain.setValueAtTime(0.0001, t);
    pg.gain.linearRampToValueAtTime(0.09 * vol, t + 0.25);
    pg.gain.setValueAtTime(0.09 * vol, t + hold);
    pg.gain.exponentialRampToValueAtTime(0.0001, t + hold + rel);
    ped.connect(pg); pg.connect(out);
    ped.start(t); ped.stop(t + hold + rel + 0.1);
    // the chiff
    const ns = noiseSrc();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2200; bp.Q.value = 0.8;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.05 * vol, t + 0.02);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    ns.connect(bp); bp.connect(ng); ng.connect(out);
    ns.start(t); ns.stop(t + 0.35);
    out.connect(acMaster);
    // and the building it is in
    if (musSend) { const w = ac.createGain(); w.gain.value = 0.55; out.connect(w); w.connect(musSend); }
  }

  const sfxTable = {
    wheek: sfxWheek, thud: sfxThud, splash: sfxSplash, gasp: sfxGasp,
    pop: sfxPop, rustle: sfxRustle, whistle: sfxWhistle,
    // Circular Quay and Pasto voices — these were synthesised but never reachable through
    // game.sfx(), so every caller outside systems.js was silently dropping them.
    gull: sfxGull, bark: sfxBark, strum: sfxStrum, horn: sfxHorn,
    hiss: sfxHiss, chime: sfxChime, tick: sfxTick, step: sfxStep,
    cheer: sfxCheer, organ: sfxOrgan,
    // The micro-environment's two voices. See THE GLOBAL ENVIRONMENT.
    thunder: sfxThunder, drip: sfxDrip,
    // What a hard thing sounds like. See physVOICE in props.js for who asks.
    clink: sfxClink,
  };
  const sfxGap = {
    wheek: 0.16, thud: 0.05, splash: 0.12, gasp: 0.12, pop: 0.05, rustle: 0.08, whistle: 0.2,
    gull: 0.8, bark: 0.35, strum: 0.5, horn: 2.2, hiss: 1.2, chime: 1.5, tick: 0.12,
    cheer: 3.0, organ: 4.0,
    // Four seconds long and at most one per shower, so the gap is a formality;
    // the drip's is real, because the bed schedules it on a jittered timer that
    // at a high drip level can ask for one every third of a second.
    thunder: 6.0, drip: 0.22,
    // a flat-out run is ~7 strides a second; the throttle must sit under that or
    // it starts eating every other footfall and the gait audibly limps
    step: 0.055,
    // The same gap 'thud' has, and for the same reason: clink is the other half
    // of the impact channel, so a tumbling stack of bowls has to be allowed to
    // sound like a tumbling stack of bowls.
    clink: 0.05,
  };

  function sfx(name, opts) {
    if (muted) return;
    // ---- THE WORLD IS ONLY ALLOWED TO SPEAK WHILE IT IS BEING PLAYED ------
    // main.js runs EVERY module's update() every frame, and only the physics
    // step is behind `paused`. That is deliberate and correct - a paused world
    // still has to draw itself and still has to hold its shape - but it means
    // the sixteen biomes carry on ringing bells, sounding horns, popping bus
    // doors and clattering storks' bills behind an open journal, behind the
    // title card, and in a background tab. Measured standing still for
    // fourteen seconds: Rio dings its tram twice, Marrakech's storks fire
    // three bill-claps, Kowloon's bus pops twice - all of it while the game
    // is nominally not running. That is the 'random sounds in the background'
    // this game has always had, and it is one gate rather than sixteen.
    //
    // `ui` is the exception and there are only a handful: the sound a menu
    // makes about ITSELF is the one thing that must still be audible when the
    // menu is what is on the screen.
    if (!(opts && opts.ui)) {
      if (!game.state.started || game.state.paused || document.hidden) return;
    }
    const fn = sfxTable[name];
    if (!fn) return;
    // Never construct the AudioContext here: it may only be born from a genuine
    // user gesture (audioUnlock). Before that, sound is silently dropped.
    if (!ac || !acMaster || ac.state !== 'running') return;
    const c = ac;
    const now = c.currentTime;
    // ---- THE THROTTLE, AND THE ONE THING ALLOWED PAST IT ------------------
    // Every gap in sfxGap exists to stop a machine-gun: 'cheer' is 3 s because
    // Rio, Marrakech and Hong Kong all fire one from their AMBIENCE, and three
    // crowds a second is a football match. The cost is that a once-a-chapter
    // payoff can land inside somebody else's ambient cheer and be dropped
    // silently — which is the worst possible failure for the one sound in the
    // chapter that the player was owed. `force` is for that case and no other:
    // it is never on a timer, never in an update loop, and there are eleven of
    // them in the whole game.
    const gap = sfxGap[name] || 0.05;
    const force = !!(opts && opts.force);
    let vol = opts && opts.volume !== undefined ? clamp(opts.volume, 0, 2) : 1;
    const pitch = opts && opts.pitch !== undefined ? clamp(opts.pitch, 0.4, 2.5) : 1;
    const extra = opts && opts.streak !== undefined ? opts.streak : 0;
    // A fourth channel, and the only voice that reads it is the footfall. It
    // is threaded here rather than folded into `pitch` because pitch already
    // carries the MATERIAL and a wet cobble is not a softer cobble. Every
    // other synth in the table takes two arguments and ignores this one.
    const wetness = opts && opts.wet !== undefined ? clamp(opts.wet, 0, 1) : 0;

    // ---- DOES THIS SOUND KNOW WHERE IT IS? --------------------------------
    // `at` (anything with x/y/z — a THREE.Vector3, a CANNON.Vec3, a prop's
    // body.position) or a bare x/y/z on the options. Anything else is the mono
    // path this game has always had, unchanged to the last sample.
    let px = 0, py = 0, pz = 0, placed = false;
    const at = opts && opts.at;
    if (at && typeof at.x === 'number' && at.x === at.x) { px = at.x; py = at.y || 0; pz = at.z || 0; placed = true; }
    else if (opts && typeof opts.x === 'number' && opts.x === opts.x) { px = opts.x; py = opts.y || 0; pz = opts.z || 0; placed = true; }

    let pan = 0;
    if (placed) {
      const g = audioPlace(px, py, pz, opts.near, opts.far);
      // THE CULL IS THE POINT, AND IT COMES BEFORE THE THROTTLE. A gull four
      // hundred metres out over the Bacino used to build eleven oscillators,
      // three filters and a noise source in order to be inaudible — and, worse,
      // it then stamped lastPlay and swallowed the next gull, the one you could
      // actually have heard. Silence must not consume the throttle.
      if (g <= 0) return;
      vol *= g;
      pan = sysSfxPan;
    }
    if (!force && lastPlay[name] !== undefined && now - lastPlay[name] < gap) return;
    lastPlay[name] = now;

    // ---- ONE SWAP, SEVENTEEN SYNTHS ---------------------------------------
    // Every voice in this file ends its graph with `.connect(acMaster)`, in
    // about forty places. Rather than thread an output node through all of
    // them — which is forty chances to miss one, and the one you miss is a
    // sound that never pans — the destination is pointed at a per-call panner
    // for the duration of the call and put straight back. The synths build
    // their whole graph synchronously, so there is no window in which this can
    // be observed by anything else, and a synth that is not placed sees the
    // real master exactly as before.
    const saved = acMaster;
    let node = null;
    if (placed && c.createStereoPanner) {
      try {
        node = c.createStereoPanner();
        node.pan.value = pan;
        node.connect(saved);
        acMaster = node;
      } catch (e) { node = null; acMaster = saved; }
    }
    try { fn(vol, pitch, extra, wetness); }
    catch (e) { /* audio node budget exhausted — ignore */ }
    finally { acMaster = saved; }
  }
  function setMuted(m) {
    muted = m;
    if (acMaster) acMaster.gain.setTargetAtTime(m ? 0.0001 : 0.85, ac.currentTime, 0.05);
    toast(m ? 'sound off' : 'sound on');
  }

  // =========================================================================
  // 4. UI
  // =========================================================================
  const hudRoot = document.getElementById('hud');
  hudRoot.classList.add('capyui', 'capyui-font');
  const styleTag = sysEl('style');
  styleTag.textContent = sysBuildCSS();
  document.head.appendChild(styleTag);

  // --- title card ----------------------------------------------------------
  // ELEVEN PLACES DO NOT FIT IN A ROW OF TORN TICKETS.
  //
  // The picker was a flex-wrap of one ticket per chapter, which was charming at
  // two, crowded at nine, and at eleven it wrapped into four ragged rows of
  // different widths with the last one below the fold on a 720p laptop. Worse,
  // every ticket was the same size and the same weight, so the ONE row that
  // matters to a returning player — carry on — was a twelfth of the card.
  //
  // What it is now, top to bottom, is the order the three questions actually
  // get asked in:
  //
  //   1. "am I coming back?"  — one full-width row, the only accented thing on
  //      the card, and it is not there at all on a fresh file.
  //   2. "where, then?"       — a GRID, not a wrap: fixed columns, so every
  //      chapter is the same shape and the eye can go straight down the
  //      numbers. Each row carries its own progress once there is any, because
  //      "Cali, 3 of 8" is the single most useful thing a returning player can
  //      be told about a place.
  //   3. "how do I move?"     — the controls, demoted to the bottom in two
  //      columns, because they are reference and not a decision.
  // ---- TWO PAGES, BECAUSE THE CARD WAS ASKING TWO QUESTIONS AT ONCE ------
  // Everything on this card was earned and none of it was wrong, and together
  // it was a masthead, a carry-on row, a hero tile, a scrolling shelf of
  // sixteen places, a rule and thirteen keys: six blocks of unrelated
  // information stacked on one sheet of paper, and the first thing a new
  // player ever sees. The two questions it asks have nothing to do with each
  // other.
  //
  //   1. WHAT IS THIS AND HOW DO I MOVE?   the name, and six keys
  //   2. WHERE AM I GOING?                 sixteen places
  //
  // So they are two pages of the same card and only one of them is in the
  // flow at a time. Page one is short enough to read; page two is nothing but
  // the picker and can have all the room it wants. titlePage(n) is the whole
  // of the state, and it is a class plus two hidden flags rather than a
  // rebuild, so the shelf keeps its scroll position and the deal-in animation
  // can never run twice.
  const titleEl = sysEl('div', 'capyui-title');
  const cardEl = sysEl('div', 'capyui-card');
  const p1El = sysEl('div', 'capyui-page capyui-p1');
  const p2El = sysEl('div', 'capyui-page capyui-p2');
  cardEl.appendChild(p1El);
  cardEl.appendChild(p2El);
  p1El.appendChild(sysEl('h1', null, 'Untitled Capybara Game'));
  p1El.appendChild(sysEl('div', 'capyui-sub',
    'one capybara, ' + CHAPTERS.length + ' places, no supervision'));

  // ---- WHAT IS ALREADY ON THE FILE ---------------------------------------
  // Read before anything is built: both the carry-on row and every per-chapter
  // tally on the grid come out of it.
  const jrFile = saveRead();
  const jrFileCount = jrFile && jrFile.tasks ? jrFile.tasks.length : 0;
  // task id -> true, for the per-chapter tallies below
  const jrFileDone = Object.create(null);
  if (jrFile && jrFile.tasks) {
    for (let i = 0; i < jrFile.tasks.length; i++) jrFileDone[jrFile.tasks[i]] = true;
  }
  const jrFileSeen = Object.create(null);
  if (jrFile && jrFile.seen) {
    for (let i = 0; i < jrFile.seen.length; i++) jrFileSeen[jrFile.seen[i]] = true;
  }

  if (jrFileCount > 0) {
    const cd = chapterDef(chapterOf(jrFile.biome || 'sydney'));
    // A REAL BUTTON, NOT A DIV WEARING ITS NAME. A div with role="button" and a
    // tabindex is focusable and announces itself as a button, and then does
    // nothing at all when a keyboard player presses Enter on it — which is
    // worse than not being focusable, because it promises.
    // The pointerdown listener stays, and does nothing but stop the card's own
    // catch-all from starting Sydney before the click lands.
    const el = sysEl('button', 'capyui-carry');
    el.type = 'button';
    const cl = sysEl('span', 'capyui-carryl');
    cl.appendChild(sysEl('b', null, 'Carry on'));
    cl.appendChild(sysEl('i', null, 'you were last in ' + cd.name));
    el.appendChild(cl);
    el.appendChild(sysEl('span', 'capyui-carryn',
      jrFileCount + ' / ' + TASKS.length));
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    el.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      startGame(jrFile.biome || 'sydney', true);
    });
    p1El.appendChild(el);
  }

  // ---- PAGE ONE: THE CONTROLS, AND ONE DOOR OUT OF IT --------------------
  // The six verbs, at the size of something meant to be read rather than the
  // size of a footnote, and then one button. The furniture is a fold: there
  // for the player who wants it, and costing the other one nothing.
  p1El.appendChild(sysEl('div', 'capyui-label', 'how to be a capybara'));
  p1El.appendChild(sysFillLegend(sysEl('div', 'capyui-legend capyui-legbig')));
  {
    // THE GUARD GOES ON THE SUMMARY, NOT ON THE DETAILS.
    // A <details> is a block: at the card's width that is a 640 px strip across
    // the middle of the page, and stopping propagation on it swallowed every
    // click that landed anywhere in that band - including the ones that meant
    // 'start the game', which is what the whole backdrop is for. Measured: a
    // click at (400, 400) on a 1280x720 window did nothing at all. Only the
    // summary is a control; only the summary should eat a click.
    const more = sysEl('details', 'capyui-more');
    const sum = sysEl('summary', null, 'and a few extras');
    sum.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    more.appendChild(sum);
    const moreLeg = sysFillLegend(sysEl('div', 'capyui-legend'), 'more');
    moreLeg.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    more.appendChild(moreLeg);
    p1El.appendChild(more);
  }
  const goEl = sysEl('button', 'capyui-go');
  goEl.type = 'button';
  goEl.appendChild(sysEl('b', null,
    jrFileCount > 0 ? 'Start somewhere fresh' : 'Choose a place'));
  goEl.appendChild(sysEl('i', null, CHAPTERS.length + ' of them, in any order'));
  // TWO FILLED ACCENT BUTTONS ON ONE CARD IS NO HIERARCHY AT ALL. With a
  // journey on file the primary action is carrying on with it, and this one
  // steps back to an outline so the eye is told which of the two the card
  // thinks you want. On a fresh file there is nothing to compete with and it
  // stays the filled one.
  if (jrFileCount > 0) goEl.classList.add('alt');
  goEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  goEl.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    titlePage(2);
  });
  p1El.appendChild(goEl);
  p1El.appendChild(sysEl('div', 'capyui-begin',
    jrFileCount > 0 ? 'ENTER to carry on' : 'ENTER to begin'));

  // ---- PAGE TWO: NOTHING BUT THE PICKER ----------------------------------
  const backEl = sysEl('button', 'capyui-back');
  backEl.type = 'button';
  backEl.textContent = 'back';
  backEl.setAttribute('aria-label', 'back to the front of the card');
  backEl.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  backEl.addEventListener('click', function (e) {
    e.preventDefault(); e.stopPropagation();
    titlePage(1);
  });
  p2El.appendChild(backEl);
  p2El.appendChild(sysEl('h1', 'capyui-h2', 'Where would you like to start?'));

  // --- the grid ------------------------------------------------------------
  // ONE ROW PER CHAPTER, AND THE ROW IS IN shared.js. This used to be a
  // hand-typed copy of CHAPTERS with its own subtitle on every line, which is
  // exactly the duplication CHAPTERS was created to end — and it had already
  // drifted: two of the hints did not match the place cards they were about.
  //
  // The keys run 1-9, then 0 for the tenth, then sysPICK_EXTRA for everything
  // after that. That is not elegant and it does not need to be: the badge on
  // every row says which key it is, so nothing about it has to be guessed.
  // ---- ONE TILE, AND IT IS THE SAME FUNCTION FOR ALL OF THEM -------------
  // The hero and the shelf differ by a CLASS and by nothing else, which is the
  // whole reason the layout can survive a seventeenth chapter: there is no
  // arithmetic anywhere in here that knows how many places there are.
  const pickDefs = CHAPTERS.map(function (c, i) {
    return { biome: c.biome, name: c.name, n: c.n, hint: c.hint || c.sub,
             key: sysPickLabel(i) };
  });
  function buildPick(d, i, hero) {
    const ids = tasksInChapter(d.n);
    let done = 0;
    for (let k = 0; k < ids.length; k++) if (jrFileDone[ids[k]]) done++;
    const el = sysEl('button', 'capyui-pick');
    el.type = 'button';
    if (hero) el.classList.add('hero');
    el.style.setProperty('--i', String(i));
    // the place itself, drawn in its own colours
    const art = sysEl('span', 'capyui-pickart');
    art.style.background = sysMarkTint(d.biome, 0.30);
    const mark = sysBuildMark(d.biome);
    // THE HERO'S PICTURE IS CROPPED, NOT STRETCHED. Every mark is authored in
    // a 64 x 40 box and the tiles draw it with preserveAspectRatio="none",
    // which is right when the tile is nearly that shape and is a disaster on a
    // panel twice as wide as it is tall: the Opera House came out as five
    // vertical spikes. `slice` fills the panel and crops the overflow.
    if (mark && hero) mark.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    if (mark) art.appendChild(mark);
    // A ROW WITH NO KEY IS STILL A ROW YOU CAN CLICK. Past the twentieth
    // chapter sysPickLabel runs out; the badge simply is not drawn, and
    // nothing else about the tile changes.
    if (d.key) art.appendChild(sysEl('span', 'capyui-pickkey', d.key));
    el.appendChild(art);
    const body = sysEl('span', 'capyui-pickbody');
    body.appendChild(sysEl('b', null, d.name));
    body.appendChild(sysEl('i', null, d.hint));
    // The hero is the only one with room for a third line, and there is
    // exactly one thing worth telling a player who has never played this.
    if (hero) {
      body.appendChild(sysEl('em', 'capyui-pickfirst',
        ids.length + ' things to do, and nobody watching'));
    }
    el.appendChild(body);
    // The tally is only ever shown for somewhere you have actually been. On a
    // fresh file it says nothing at all, because "0 / 8" fifteen times over is
    // not information, it is wallpaper.
    if (done > 0 || jrFileSeen[d.n]) {
      const tally = sysEl('span', 'capyui-picktally', done + '/' + ids.length);
      if (done >= ids.length && ids.length) tally.classList.add('full');
      el.appendChild(tally);
    }
    // A FINISHED PLACE STILL HAS A REASON TO GO BACK, and this is where it has
    // to be said, because the picker is the only screen where a returning
    // player compares sixteen places against each other. "Cali, 8 of 8" says
    // the place is spent; "8 of 8, longest run 14 on the beat" says there is a
    // number in there with your name on it. Only ever shown once the list is
    // done, so it cannot crowd a chapter you are still working through.
    if (done >= ids.length && ids.length) {
      const fileRecs = (jrFile && jrFile.recs) || {};
      let bestId = '';
      for (let k = 0; k < ids.length; k++) {
        if (RECORDS[ids[k]] && fileRecs[ids[k]] !== undefined) { bestId = ids[k]; break; }
      }
      if (bestId) {
        const rd = RECORDS[bestId];
        body.appendChild(sysEl('em', 'capyui-pickrec',
          rd.label + ' ' + fileRecs[bestId].toFixed(rd.dp) + rd.unit));
      }
    }
    el.setAttribute('aria-label', d.name + ', chapter ' + d.n +
      (d.key ? ', key ' + d.key : '') +
      (done > 0 ? ', ' + done + ' of ' + ids.length + ' done' : ''));
    // stopPropagation, or the card's own catch-all listener starts Sydney first
    el.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    el.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      startGame(d.biome);
    });
    return el;
  }

  // ---- THE HERO. Chapter one, out of the grid entirely ------------------
  // It used to be a 2x2 tile INSIDE the grid, which made the layout an
  // arithmetic problem: four columns, one tile eating four cells, and
  // therefore exactly twelve other chapters or a ragged half-row at the
  // bottom. That held for precisely as long as there were thirteen places.
  // Out here it is a row of its own, it gets more space than it ever had, and
  // the number of chapters no longer has to divide by anything.
  p2El.appendChild(buildPick(pickDefs[0], 0, true));

  p2El.appendChild(sysEl('div', 'capyui-label',
    'or go straight somewhere else'));

  // ---- THE SHELF --------------------------------------------------------
  const picksEl = sysEl('div', 'capyui-picks');
  // A SCROLL REGION, not a taller card. Fifteen tiles is three rows; thirty
  // would be six, and a card that grows without limit pushes its own footer —
  // the key legend, which is the only statement of the control scheme this
  // game has — off the bottom of a laptop screen. The shelf scrolls; the
  // masthead, the carry-on button and the controls never move.
  picksEl.style.setProperty('--cols', String(sysPickCols(pickDefs.length - 1)));
  picksEl.setAttribute('role', 'group');
  picksEl.setAttribute('aria-label', 'the other places');
  for (let i = 1; i < pickDefs.length; i++) {
    picksEl.appendChild(buildPick(pickDefs[i], i, false));
  }
  p2El.appendChild(picksEl);

  p2El.appendChild(sysEl('div', 'capyui-begin',
    // Derived from CHAPTERS, not typed. It read "1 – 8" for the whole of the
    // session that added the ninth one, and the next chapter caught it out the
    // same way — so it is now the actual key list, generated.
    'or press its key  ·  ' +
    pickDefs.map(function (d) { return d.key; }).join(' ') +
    '  ·  ESC to go back'));
  titleEl.appendChild(cardEl);
  hudRoot.appendChild(titleEl);

  // WHICH PAGE IS IN THE FLOW. The page that is not showing is hidden, not
  // merely transparent: a hidden page cannot be tabbed into, is not read out
  // by a screen reader, and - the part that actually bites - cannot swallow a
  // click meant for the page in front of it. Focus moves with the page, or a
  // keyboard player who pressed the button that turned it is left focused on
  // an element that is no longer on the screen.
  let titlePageN = 1;
  function titlePage(n) {
    if (n === titlePageN || started) return;
    titlePageN = n;
    cardEl.classList.toggle('two', n === 2);
    p1El.hidden = n !== 1;
    p2El.hidden = n !== 2;
    // Back to the top of the card: page two is a great deal taller than page
    // one, and coming back to a masthead scrolled out of view reads as the
    // card having been replaced rather than turned.
    if (titleEl.scrollTop) titleEl.scrollTop = 0;
    try { (n === 2 ? (picksEl.querySelector('.capyui-pick') || backEl) : goEl).focus(); }
    catch (e) { /* focus is a nicety, never a crash */ }
  }
  p2El.hidden = true;

  // --- the journal ---------------------------------------------------------
  // One card that answers the three questions a rolling window of four rows
  // cannot: what is the whole journey, how far through it am I, and — the one
  // that actually changes how the game plays — WHERE CAN I GO FROM HERE.
  const jrEl = sysEl('div', 'capyui-jr');
  // It is a modal: it covers the game, it pauses it, and Escape closes it. Say
  // so, so that a screen reader treats it as one rather than as some text that
  // has appeared over the top of a canvas.
  const jrCard = sysEl('div', 'capyui-jrcard');
  jrCard.setAttribute('role', 'dialog');
  jrCard.setAttribute('aria-modal', 'true');
  jrCard.setAttribute('aria-label', 'The journey so far');
  jrCard.tabIndex = -1;
  const jrTitle = sysEl('h2', null, 'The journey so far');
  const jrCount = sysEl('div', 'capyui-jrsub', '');
  jrCard.appendChild(jrTitle);
  jrCard.appendChild(jrCount);
  jrCard.appendChild(sysEl('div', 'capyui-rule'));
  const jrRows = [];
  // THE CONTROLS LIVE HERE TOO, because this is the card that is still in the
  // DOM three hours in. It is folded away by default (the board is a travel
  // decision and thirteen lines of keys under it would bury the thirteen lines
  // that matter); H, ? or the summary itself opens it, and it STAYS open once
  // opened, so a player who needed it once does not have to find it twice.
  const jrKeys = sysEl('details', 'capyui-jrkeys');
  const jrKeysSum = sysEl('summary', null, 'the controls');
  jrKeys.appendChild(jrKeysSum);
  jrKeys.appendChild(sysFillLegend(sysEl('div', 'capyui-legend'), 'all'));
  const jrFoot = sysEl('div', 'capyui-jrfoot', '');
  jrEl.appendChild(jrCard);
  jrEl.inert = true;
  hudRoot.appendChild(jrEl);
  let jrShown = false, jrDepart = false;

  // --- to-do list ---
  const todoEl = sysEl('div', 'capyui-todo');
  const todoHeadEl = sysEl('h2', null, 'To do');
  todoEl.appendChild(todoHeadEl);

  const listEl = sysEl('ul');
  const taskRec = Object.create(null);
  // ---- A LIST OF FOUR THINGS, NOT TWENTY-EIGHT ----------------------------
  // The whole checklist on one sheet was 28 rows plus headings, taller than the
  // window, permanently scrolled — and because every row was in the same <ul>,
  // Sydney's tasks sat directly above Pasto's with nothing but a heading between
  // them, so the list read as one undifferentiated pile wherever you were
  // standing. What a player needs is the next few things, here, now.
  //
  // So every row is still built once and never destroyed, but only a WINDOW of
  // them is in the flow: the first sysTODO_WINDOW unticked tasks of whichever
  // chapter matches the biome you are actually in, plus whichever row you have
  // just ticked, which lingers long enough to be struck through before it rolls
  // itself up. Nothing from the other hemisphere can appear, by construction.
  const chapMax = chapterCount();
  function chapLabel(n) { const d = CHAPTERS[n - 1]; return d ? d.name : ('Chapter ' + n); }
  const chapRec = [];   // chapRec[n], 1-based
  for (let n = 1; n <= chapMax; n++) {
    const ids = tasksInChapter(n);
    chapRec[n] = { n: n, ids: ids };
    for (let i = 0; i < ids.length; i++) {
      const li = sysEl('li', 'capyui-task capyui-hidden');
      const tilt = 'rotate(' + rand(-0.6, 0.6).toFixed(2) + 'deg)';
      li.style.transform = tilt;
      li.appendChild(sysEl('span', 'capyui-box'));
      const txt = sysEl('span', 'capyui-txt', '');
      li.appendChild(txt);
      // bearing + distance, filled in only while this is the top open row
      const aim = sysEl('span', 'capyui-aim');
      const arrow = sysEl('i', 'capyui-arrow');
      const dist = sysEl('span', null, '');
      aim.appendChild(arrow);
      aim.appendChild(dist);
      li.appendChild(aim);
      // Tap a row to point the arrow at it — see todoPin. Captured on the row,
      // so it never reaches the canvas and can never be mistaken for a grab.
      // role + aria-label rather than a real <button>, deliberately: Tab is
      // bound to the journal in this game (and preventDefault'd), so putting a
      // hundred and thirty-three rows into the tab order would build a focus
      // ring nobody can reach. The keyboard has its own way in — F — and it is
      // on the legend, which is what the guideline about gesture-only actions
      // is actually asking for.
      li.setAttribute('role', 'button');
      li.setAttribute('aria-label', 'point the arrow at this');
      (function (id) {
        li.addEventListener('pointerdown', function (ev) {
          ev.preventDefault(); ev.stopPropagation();
          todoPinTo(id);
        });
      })(ids[i]);
      listEl.appendChild(li);
      taskRec[ids[i]] = { def: null, li: li, txt: txt, done: false, chapter: n, tilt: tilt,
                          shown: false, aim: aim, arrow: arrow, dist: dist };
    }
  }
  for (let i = 0; i < TASKS.length; i++) {
    const r = taskRec[TASKS[i].id];
    if (!r) continue;
    r.def = TASKS[i];
    // the TEXT span by name, never li.lastChild — the row also carries the aim
    r.txt.textContent = TASKS[i].text;
  }
  todoEl.appendChild(listEl);
  const clueEl = sysEl('div', 'capyui-clue off', '');
  todoEl.appendChild(clueEl);
  const countEl = sysEl('div', 'capyui-count', '');
  todoEl.appendChild(countEl);
  hudRoot.appendChild(todoEl);

  // --- toasts ---
  const toastWrap = sysEl('div', 'capyui-toasts');
  // Every hint, every ticked task and every one of chapter nine's three
  // teaching lines arrives here and nowhere else. Polite, so it waits its turn.
  toastWrap.setAttribute('role', 'status');
  toastWrap.setAttribute('aria-live', 'polite');
  hudRoot.appendChild(toastWrap);

  // --- perf ---
  const perfEl = sysEl('div', 'capyui-perf');
  hudRoot.appendChild(perfEl);

  // --- flight readout: altimeter, airspeed, thermal tell ---
  // Only ever on screen while the capybara is hanging off the condor. The bar is
  // full-scale at the summit of Galeras, so "bar full" reads as "as high as the
  // mountain" without a single number having to be explained.
  const flyEl = sysEl('div', 'capyui-fly');
  flyEl.appendChild(sysEl('div', 'capyui-flyk', 'Altitude'));
  const flyAltEl = sysEl('div', 'capyui-flyv');
  const flyAltN = sysEl('span', null, '0');
  flyAltEl.appendChild(flyAltN);
  flyAltEl.appendChild(sysEl('small', null, 'm'));
  flyEl.appendChild(flyAltEl);
  const flyBarEl = sysEl('div', 'capyui-flybar');
  const flyBarFill = sysEl('i');
  flyBarEl.appendChild(flyBarFill);
  flyEl.appendChild(flyBarEl);
  flyEl.appendChild(sysEl('div', 'capyui-flyk', 'Airspeed'));
  const flyAirEl = sysEl('div', 'capyui-flyv');
  const flyAirN = sysEl('span', null, '0.0');
  flyAirEl.appendChild(flyAirN);
  flyAirEl.appendChild(sysEl('small', null, 'm/s'));
  flyEl.appendChild(flyAirEl);
  const flyThermEl = sysEl('div', 'capyui-therm', '▲ thermal');
  flyEl.appendChild(flyThermEl);
  hudRoot.appendChild(flyEl);

  // --- minimap ---
  const mapEl = sysEl('div', 'capyui-map');
  // A canvas chart has no text alternative and cannot be given an honest one:
  // what it says is "the shape of this place and where you are in it", which is
  // a picture. Everything ACTIONABLE on it — what to do next and where — is
  // already on the to-do card as a sentence, so the chart is decoration for
  // assistive tech and says so, rather than announcing a bare letter 'N'.
  mapEl.setAttribute('aria-hidden', 'true');
  const mapCv = document.createElement('canvas');
  mapEl.appendChild(mapCv);
  mapEl.appendChild(sysEl('div', 'capyui-mapv'));
  mapEl.appendChild(sysEl('div', 'capyui-mapn', 'N'));
  const mapDistEl = sysEl('div', 'capyui-mapdist');
  mapDistEl.appendChild(sysEl('i'));
  const mapDistN = sysEl('span', null, '');
  mapDistEl.appendChild(mapDistN);
  mapEl.appendChild(mapDistEl);
  let mapDistLast = '', mapDistOn = false;
  hudRoot.appendChild(mapEl);
  const mapCtx = mapCv.getContext('2d');
  const mapBase = document.createElement('canvas');
  mapBase.width = sysMAP_PX; mapBase.height = sysMAP_PX;
  const mapBaseCtx = mapBase.getContext('2d');
  let mapBakedFor = null;            // biome name the base layer belongs to
  let mapBakedTide = -1;             // and, in Venice, WHICH TIDE it belongs to
  let mapSpec = null;                // the sysMAP_WORLDS entry in force
  let mapT = 0, mapShown = false, mapCssW = 0;
  // ---- WHERE YOU HAVE BEEN -------------------------------------------------
  // A chart tells you where things are. The one thing it could not tell you was
  // where YOU have been, which in a world you are exploring on foot is at least
  // as useful — and in the two chapters that are mostly empty (the Drift, the
  // Erg) it is the difference between a map and a piece of paper. A flat ring
  // of world coordinates, sampled on distance rather than on time so that
  // standing still does not spend it, and cleared with the bake so it can never
  // draw Sydney's walk across Venice.
  const mapTrail = new Float32Array(sysMAP_TRAIL * 2);
  let mapTrailN = 0, mapTrailHead = 0;
  function mapTrailClear() { mapTrailN = 0; mapTrailHead = 0; }
  function mapTrailPush(x, z) {
    if (mapTrailN > 0) {
      const li = ((mapTrailHead - 1 + sysMAP_TRAIL) % sysMAP_TRAIL) * 2;
      const dx = x - mapTrail[li], dz = z - mapTrail[li + 1];
      if (dx * dx + dz * dz < sysMAP_TRAIL_D * sysMAP_TRAIL_D) return;
    }
    mapTrail[mapTrailHead * 2] = x;
    mapTrail[mapTrailHead * 2 + 1] = z;
    mapTrailHead = (mapTrailHead + 1) % sysMAP_TRAIL;
    if (mapTrailN < sysMAP_TRAIL) mapTrailN++;
  }
  const mapGoal = { x: 0, z: 0, ok: false };   // scratch — no per-frame allocation
  // THE CSS BLANKET CANNOT REACH THE CANVAS. The reduce-motion rule at the top
  // of the sheet flattens every transition and keyframe in the HUD, and the
  // marker that says where to go next is neither: it is a radius computed from
  // game.state.time inside mapDraw. A player who has asked for less motion was
  // still getting a ring throbbing at four hertz in the corner of the screen.
  // Read once — this is a preference, not a per-frame question — and the pulse
  // becomes a steady ring that says exactly the same thing.
  const mapCalm = !!(window.matchMedia &&
                     window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function mapPulse(amp) { return mapCalm ? 0 : Math.sin(game.state.time * 4) * amp; }
  const mapC = {                     // colours, resolved once
    water: sysHex(PALETTE.water), deep: sysHex(PALETTE.seaMid),
    lowLand: sysHex(PALETTE.sand), midLand: sysHex(PALETTE.leafC),
    high: sysHex(PALETTE.stoneDark), ink: sysHex(PALETTE.ibisHead),
    soft: sysRgba(PALETTE.ibisHead, 0.5), faint: sysRgba(PALETTE.ibisHead, 0.22),
    you: sysHex(PALETTE.capy), goal: sysHex(PALETTE.cloth1),
    cone: sysRgba(PALETTE.sail, 0.34),
  };

  // World -> baked-pixel, and world -> displayed-canvas. Uniform scale on both
  // axes: a map that stretches one axis to fill a square lies about bearings.
  function mapFit(spec, w) {
    const sx = (spec.x1 - spec.x0), sz = (spec.z1 - spec.z0);
    const span = (sx > sz ? sx : sz) + spec.pad * 2;
    return { cx: (spec.x0 + spec.x1) / 2, cz: (spec.z0 + spec.z1) / 2, k: w / span };
  }

  // Bake water/land/relief for the live biome. One pass, on entry, never in a
  // frame that also has to do anything else.
  function mapBake(name) {
    const spec = sysMAP_WORLDS[name];
    mapSpec = spec || null;
    mapBakedFor = name;
    mapBaseCtx.clearRect(0, 0, sysMAP_PX, sysMAP_PX);
    if (!spec) return;
    const api = game[name] || null;
    const water = api && typeof api.isOverWater === 'function' ? api.isOverWater.bind(api)
                : (name === 'sydney' && game.env && typeof game.env.isOverWater === 'function'
                   ? game.env.isOverWater.bind(game.env) : null);
    const terr = api && typeof api.terrainHeight === 'function' ? api.terrainHeight.bind(api) : null;
    const f = mapFit(spec, sysMAP_PX);
    const img = mapBaseCtx.createImageData(sysMAP_PX, sysMAP_PX);
    const d = img.data;
    // A WORLD MAY BRING ITS OWN RAMP. The default is sand -> green -> stone,
    // which is right for fifteen places and paints the inside of a mountain
    // BRIGHT GREEN. A row in sysMAP_WORLDS may carry `pal`, and a world that
    // does not costs one property miss.
    const P = spec.pal || null;
    const lo = sysHexRGB(P ? P.lo : PALETTE.sand), mid = sysHexRGB(P ? P.mid : PALETTE.leafC);
    const hi = sysHexRGB(P ? P.hi : PALETTE.sandstoneDark), wat = sysHexRGB(P ? P.wat : PALETTE.water);
    const dp = sysHexRGB(P ? P.dp : PALETTE.seaMid);
    // one probe pass for the height range, so every world shades edge to edge
    let hMax = 1;
    if (terr) {
      for (let j = 0; j < sysMAP_PX; j += 4) for (let i = 0; i < sysMAP_PX; i += 4) {
        const x = f.cx + (i - sysMAP_PX / 2) / f.k, z = f.cz + (j - sysMAP_PX / 2) / f.k;
        const h = terr(x, z);
        if (h === h && h > hMax) hMax = h;
      }
    }
    for (let j = 0; j < sysMAP_PX; j++) {
      const z = f.cz + (j - sysMAP_PX / 2 + 0.5) / f.k;
      for (let i = 0; i < sysMAP_PX; i++) {
        const x = f.cx + (i - sysMAP_PX / 2 + 0.5) / f.k;
        const o = (j * sysMAP_PX + i) * 4;
        let r, g, b;
        if (water && water(x, z)) {
          // shade the water by distance from land so a harbour reads as a shape
          const t = clamp((terr ? (0 - terr(x, z)) : 1) / 6, 0, 1);
          r = lerp(wat[0], dp[0], t); g = lerp(wat[1], dp[1], t); b = lerp(wat[2], dp[2], t);
        } else {
          const h = terr ? terr(x, z) : 0;
          const t = clamp((h === h ? h : 0) / hMax, 0, 1);
          // two-stop ramp: sand -> green -> stone, then a cheap hillshade
          let c0, c1, u;
          if (t < 0.34) { c0 = lo; c1 = mid; u = t / 0.34; }
          else { c0 = mid; c1 = hi; u = (t - 0.34) / 0.66; }
          r = lerp(c0[0], c1[0], u); g = lerp(c0[1], c1[1], u); b = lerp(c0[2], c1[2], u);
          if (terr) {
            // Light from the north-west. THE SHADE TERM MUST BE A GRADIENT, not a
            // raw height difference: on Galeras a neighbouring sample is sixty
            // metres away in height, and multiplying that by any constant pins
            // every slope to the clamp and paints the whole volcano black. A
            // rise-over-run is dimensionless and behaves the same in a valley as
            // it does on a mountain.
            const e = 2 / f.k;
            const slope = (h - terr(x - e, z - e)) / (e * 1.414);
            const sh = clamp(1 + slope * 0.40, 0.86, 1.13);
            r *= sh; g *= sh; b *= sh;
          }
        }
        d[o] = r < 0 ? 0 : r > 255 ? 255 : r;
        d[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        d[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
        d[o + 3] = 255;
      }
    }
    // ---- THE COASTLINE ----------------------------------------------------
    // Every chart ever drawn has a line where the water stops, and this one did
    // not: it had a colour ramp that went blue, and at a hundred pixels across a
    // ramp is a smudge. Sydney's harbour, the Grand Canal, the drop-off at El
    // Nido and the whole of the Quay's seven hundred metres of open water were
    // all reading as "somewhere it gets darker".
    //
    // Done here on the finished pixels rather than as a second terrain pass:
    // isOverWater() has already been asked sixteen thousand times and asking it
    // again is the one thing this bake cannot afford. A pixel whose four
    // neighbours are not all on the same side of the shore gets the ink laid
    // over it, at a weight that leaves the ramp underneath visible.
    {
      const wet = new Uint8Array(sysMAP_PX * sysMAP_PX);
      if (water) {
        for (let j = 0; j < sysMAP_PX; j++) {
          const z = f.cz + (j - sysMAP_PX / 2 + 0.5) / f.k;
          for (let i = 0; i < sysMAP_PX; i++) {
            const x = f.cx + (i - sysMAP_PX / 2 + 0.5) / f.k;
            wet[j * sysMAP_PX + i] = water(x, z) ? 1 : 0;
          }
        }
        const ink = sysHexRGB(PALETTE.ibisHead);
        for (let j = 1; j < sysMAP_PX - 1; j++) {
          for (let i = 1; i < sysMAP_PX - 1; i++) {
            const o = j * sysMAP_PX + i;
            const c = wet[o];
            if (c === wet[o - 1] && c === wet[o + 1] &&
                c === wet[o - sysMAP_PX] && c === wet[o + sysMAP_PX]) continue;
            const q = o * 4;
            // Heavier on the wet side than the dry: a coast reads as the sea's
            // edge, not as an outline drawn around the land. Measured from the
            // rendered chart rather than guessed — at 0.42/0.30 the Grand Canal
            // read cleanly but Sydney's harbour, which is one straight edge
            // between two saturated flats, did not show a line at all.
            const a = c ? 0.55 : 0.38;
            d[q] = d[q] * (1 - a) + ink[0] * a;
            d[q + 1] = d[q + 1] * (1 - a) + ink[1] * a;
            d[q + 2] = d[q + 2] * (1 - a) + ink[2] * a;
          }
        }
      }
    }
    mapBaseCtx.putImageData(img, 0, 0);
    if ('filter' in mapBaseCtx) {
      mapBaseCtx.filter = 'blur(0.8px)';
      mapBaseCtx.drawImage(mapBase, 0, 0);
      mapBaseCtx.filter = 'none';
    }
    // A new world is a new walk. Never carried across — see mapTrailPush.
    mapTrailClear();
  }

  // A LANDMARK THAT MOVES IS PUBLISHED AS A FUNCTION, AND THIS NEVER CALLED ONE.
  //
  // The biome api contract is 'a fixture is an object, a thing that moves is a
  // method - ask, never cache', and every biome honours it. This reader knew
  // about objects and about {position} and about nothing else, so a mark whose
  // getter was a method resolved to a function, failed `typeof v.x === number`,
  // and was DROPPED WITHOUT A WORD. Measured with mapMarkAudit across all
  // sixteen charts, that silently deleted:
  //
  //   Venice     the Rialto, the gondola
  //   Hong Kong  the Star Ferry
  //   Manly      the flags, the surfboat
  //   Pantanal   the others
  //
  // which is not a random six. They are the moving things - which is to say
  // the six landmarks on these charts that a player most needs a chart for,
  // and in Manly's case the chapter's own way out. The call is wrapped because
  // a getter runs arbitrary biome code twelve times a second and a chart that
  // can take the frame down with it is worse than a chart missing a dot.
  function mapMarkPos(m) {
    if (!m.get) return m;
    const api = game[mapBakedFor];
    let v = api && api[m.get];
    if (!v) return null;
    if (typeof v === 'function') {
      try { v = v.call(api); } catch (e) { return null; }
      if (!v) return null;
    }
    if (typeof v.x === 'number') return v;
    if (v.position && typeof v.position.x === 'number') return v.position;
    return null;
  }

  function mapDraw(p, yaw, camYawNow, goal) {
    const cssW = mapEl.clientWidth;
    if (!cssW) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cssW * dpr);
    if (w !== mapCssW) { mapCssW = w; mapCv.width = w; mapCv.height = w; }
    const g2 = mapCtx;
    g2.clearRect(0, 0, w, w);
    if (!mapSpec) return;
    g2.imageSmoothingEnabled = true;
    g2.drawImage(mapBase, 0, 0, sysMAP_PX, sysMAP_PX, 0, 0, w, w);
    const f = mapFit(mapSpec, w);
    const PX = (x) => (x - f.cx) * f.k + w / 2;
    const PZ = (z) => (z - f.cz) * f.k + w / 2;
    const u = w / 128;                          // one unit of "map pixel"

    // ---- where you have been ---------------------------------------------
    // Under the cone and under the landmarks, because it is the oldest
    // information on the chart and it should read as something the paper has
    // absorbed rather than as something drawn on top of it. One stroked path,
    // fading toward the far end: a track that is uniformly dark says every part
    // of it is equally recent, which is the one thing it must not say.
    // THREE PATHS, NOT SIXTY-FOUR SEGMENTS. The first cut stroked every pair on
    // its own so the alpha could ramp per segment, and at this scale a stroked
    // two-point path with round caps is a DASH: the track came out as a dotted
    // line with the gaps in it that a separate stroke leaves behind. A polyline
    // is one path. The fade survives as three bands — old, middle, recent —
    // which is as much gradient as a hundred-pixel chart can show anyway, and
    // each band starts on the last point of the one before it so the joins
    // close.
    if (mapTrailN > 1) {
      g2.lineCap = 'round';
      g2.lineJoin = 'round';
      const at = function (i) {
        return (mapTrailHead - mapTrailN + i + sysMAP_TRAIL * 2) % sysMAP_TRAIL;
      };
      for (let band = 0; band < sysMAP_TRAIL_BANDS; band++) {
        const i0 = Math.floor(mapTrailN * band / sysMAP_TRAIL_BANDS);
        const i1 = Math.floor(mapTrailN * (band + 1) / sysMAP_TRAIL_BANDS);
        if (i1 - i0 < 2) continue;
        const age = (band + 1) / sysMAP_TRAIL_BANDS;      // 0 oldest .. 1 newest
        g2.strokeStyle = sysRgba(PALETTE.ibisHead, 0.05 + age * 0.22);
        g2.lineWidth = (0.6 + age * 0.8) * u;
        g2.beginPath();
        for (let i = i0; i < i1; i++) {
          const k = at(i) * 2;
          const x = PX(mapTrail[k]), y = PZ(mapTrail[k + 1]);
          if (i === i0) g2.moveTo(x, y); else g2.lineTo(x, y);
        }
        g2.stroke();
      }
    }

    // ---- the camera's cone, so "which way am I looking" is answerable ----
    const px = PX(p.x), pz = PZ(p.z);
    const vx = -Math.sin(camYawNow), vz = -Math.cos(camYawNow);
    const half = 0.42, reach = 26 * u;
    g2.fillStyle = mapC.cone;
    g2.beginPath();
    g2.moveTo(px, pz);
    g2.lineTo(px + (vx * Math.cos(half) - vz * Math.sin(half)) * reach,
              pz + (vx * Math.sin(half) + vz * Math.cos(half)) * reach);
    g2.lineTo(px + (vx * Math.cos(-half) - vz * Math.sin(-half)) * reach,
              pz + (vx * Math.sin(-half) + vz * Math.cos(-half)) * reach);
    g2.closePath(); g2.fill();

    // ---- landmarks ----
    const marks = mapSpec.marks;
    for (let i = 0; i < marks.length; i++) {
      const m = marks[i];
      const q = mapMarkPos(m);
      if (!q) continue;
      const mx = PX(q.x), mz = PZ(q.z);
      g2.lineWidth = 1.2 * u;
      if (m.k === 'star' || m.k === 'peak') {
        g2.fillStyle = m.k === 'peak' ? mapC.high : mapC.ink;
        g2.beginPath();
        const r = 3.1 * u;
        g2.moveTo(mx, mz - r); g2.lineTo(mx + r * 0.92, mz + r * 0.72); g2.lineTo(mx - r * 0.92, mz + r * 0.72);
        g2.closePath(); g2.fill();
      } else if (m.k === 'boat') {
        g2.fillStyle = mapC.ink;
        g2.fillRect(mx - 2.2 * u, mz - 1.3 * u, 4.4 * u, 2.6 * u);
      } else {
        g2.fillStyle = m.k === 'faint' ? mapC.faint : m.k === 'leaf' ? sysHex(PALETTE.leafB)
                     : m.k === 'water' ? mapC.deep : mapC.soft;
        g2.beginPath(); g2.arc(mx, mz, (m.k === 'faint' ? 1.7 : 2.1) * u, 0, 6.284); g2.fill();
      }
    }

    // ---- what the to-do list is pointing at ----
    // Two cases, and the second one was missing. Most of the time the thing you
    // are being sent to is inside the rectangle and gets a pulsing ring. But the
    // rectangle is the WORLD, not a window on it, and several of these worlds
    // are long: the Quay is seven hundred metres of open water inside a box that
    // also has to hold Manly, and the Erg is forty minutes east of the medina.
    // Whenever the hint sits outside the drawn square — or a biome has moved a
    // fixture past its own bounds — the ring was simply drawn off the edge of
    // the canvas and the player was told nothing at all.
    //
    // So a goal that is off the chart becomes an ARROW pinned to the rim,
    // pointing the way, in the same colour as the ring it stands in for.
    // A RING IS NOT ENOUGH WHEN THERE ARE EIGHT DOTS AROUND IT.
    //
    // The two marks on this chart that are ALIVE - where you are and where you
    // are being sent - were drawn at the same weight as the eight or nine fixed
    // landmarks around them, in a picture a hundred pixels across. So the one
    // question the map exists to answer, 'which way now', took a deliberate
    // hunt every single time. Three things fix it and none of them adds a
    // pixel of furniture:
    //
    //   a LEADER LINE from the animal to the goal, so the answer is a
    //     direction rather than two positions the player has to subtract;
    //   a PIN rather than a ring, filled and haloed, so it survives being drawn
    //     over dark water, pale sand or a green hillside;
    //   and both of them ON TOP of the landmarks rather than among them.
    //
    // The line is dashed because a solid one reads as a road, and it stops
    // short of both ends so it never hides the two things it joins.
    if (goal) {
      const gx = PX(goal.x), gz = PZ(goal.z);
      const m = 5.0 * u;
      const inside = gx > m && gx < w - m && gz > m && gz < w - m;
      {
        const ex = inside ? gx : clamp(gx, m, w - m);
        const ez = inside ? gz : clamp(gz, m, w - m);
        let lx = ex - px, lz = ez - pz;
        const len = Math.hypot(lx, lz);
        if (len > 9 * u) {
          lx /= len; lz /= len;
          const t0 = 6.2 * u, t1 = len - 6.2 * u;
          g2.save();
          g2.setLineDash([2.6 * u, 2.4 * u]);
          g2.strokeStyle = sysRgba(PALETTE.cloth1, 0.72);
          g2.lineWidth = 1.5 * u;
          g2.lineCap = 'butt';
          g2.beginPath();
          g2.moveTo(px + lx * t0, pz + lz * t0);
          g2.lineTo(px + lx * t1, pz + lz * t1);
          g2.stroke();
          g2.restore();
        }
      }
      if (inside) {
        // the pin: a pale halo, a filled centre, and a ring that breathes
        const rr = (4.6 + mapPulse(0.8)) * u;
        g2.fillStyle = sysRgba(PALETTE.sail, 0.85);
        g2.beginPath(); g2.arc(gx, gz, rr + 1.6 * u, 0, 6.284); g2.fill();
        g2.fillStyle = mapC.goal;
        g2.beginPath(); g2.arc(gx, gz, 2.2 * u, 0, 6.284); g2.fill();
        g2.strokeStyle = mapC.goal;
        g2.lineWidth = 1.7 * u;
        g2.beginPath(); g2.arc(gx, gz, rr, 0, 6.284); g2.stroke();
      } else {
        // Cast from the middle of the chart toward the goal and stop at the rim.
        const c = w / 2;
        let dx = gx - c, dz = gz - c;
        const len = Math.hypot(dx, dz) || 1;
        dx /= len; dz /= len;
        // the largest t that keeps both axes inside the inset square
        const lim = c - m;
        const t = Math.min(Math.abs(dx) > 1e-4 ? lim / Math.abs(dx) : 1e9,
                           Math.abs(dz) > 1e-4 ? lim / Math.abs(dz) : 1e9);
        const ax = c + dx * t, az = c + dz * t;
        const r = (4.6 + mapPulse(0.7)) * u;
        g2.fillStyle = sysRgba(PALETTE.sail, 0.85);
        g2.beginPath(); g2.arc(ax, az, r + 1.4 * u, 0, 6.284); g2.fill();
        g2.fillStyle = mapC.goal;
        g2.beginPath();
        g2.moveTo(ax + dx * r, az + dz * r);
        g2.lineTo(ax - dz * r * 0.72 - dx * r * 0.5, az + dx * r * 0.72 - dz * r * 0.5);
        g2.lineTo(ax + dz * r * 0.72 - dx * r * 0.5, az - dx * r * 0.72 - dz * r * 0.5);
        g2.closePath(); g2.fill();
      }
    }

    // ---- you ----
    // THE ONE MARK ON HERE THAT MUST BE FINDABLE WITHOUT LOOKING FOR IT.
    // It was a capy-coloured arrowhead on a pale disc, which is a brown thing
    // on a cream thing - and the chart it sits on is, in eleven of the sixteen
    // chapters, largely brown and cream. A white disc with a dark rim under it
    // is the oldest trick in cartography and it works on every ground this game
    // has: the eye finds the RIM, which is the only hard black circle in the
    // picture, and the arrowhead inside it says which way the animal is facing.
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const r = 6.2 * u;
    g2.fillStyle = sysRgba(PALETTE.sail, 0.96);
    g2.beginPath(); g2.arc(px, pz, r * 1.02, 0, 6.284); g2.fill();
    g2.strokeStyle = sysRgba(PALETTE.ibisHead, 0.85);
    g2.lineWidth = 1.3 * u;
    g2.beginPath(); g2.arc(px, pz, r * 1.02, 0, 6.284); g2.stroke();
    g2.fillStyle = mapC.you;
    g2.strokeStyle = sysRgba(PALETTE.ibisHead, 0.7);
    g2.lineWidth = 0.9 * u;
    g2.beginPath();
    g2.moveTo(px + fx * r * 0.92, pz + fz * r * 0.92);
    g2.lineTo(px - fz * r * 0.62 - fx * r * 0.46, pz + fx * r * 0.62 - fz * r * 0.46);
    g2.lineTo(px + fz * r * 0.62 - fx * r * 0.46, pz - fx * r * 0.62 - fz * r * 0.46);
    g2.closePath(); g2.fill(); g2.stroke();

    // ---- the rose --------------------------------------------------------
    // North is up and the chart never rotates, which is the whole design — but
    // a single 'N' floating over the top edge is a label, not an orientation.
    // Four ticks at the cardinals turn the same information into a frame the
    // eye reads without stopping, and the north one is longer and inked darker
    // so the picture is still unambiguous at a glance.
    // Drawn last, over everything: it is the one mark on here that is about the
    // paper rather than about the world.
    for (let i = 0; i < sysMAP_ROSE; i++) {
      const a = i * Math.PI / 2;               // 0 = north (up), then E S W
      const north = i === 0;
      const dx = Math.sin(a), dz = -Math.cos(a);
      const c = w / 2, r0 = c - 1.5 * u, r1 = c - (north ? 6.0 : 3.6) * u;
      g2.strokeStyle = sysRgba(PALETTE.ibisHead, north ? 0.70 : 0.40);
      g2.lineWidth = (north ? 1.7 : 1.2) * u;
      g2.lineCap = 'butt';
      g2.beginPath();
      g2.moveTo(c + dx * r0, c + dz * r0);
      g2.lineTo(c + dx * r1, c + dz * r1);
      g2.stroke();
    }
  }

  // --- stamina ---
  const stamEl = sysEl('div', 'capyui-stam');
  const stamFill = sysEl('i');
  stamEl.appendChild(stamFill);
  hudRoot.appendChild(stamEl);
  let stamShown = false, stamLow = false, stamBlownCls = false, stamFullT = 0;

  // --- the way home: three whistles, stood in the crater ---
  const homeEl = sysEl('div', 'capyui-home');
  homeEl.appendChild(sysEl('span', null, 'wheek three times to go home'));
  const homeDotsEl = sysEl('span', 'capyui-dots');
  const homeDots = [];
  for (let i = 0; i < 3; i++) {
    const d = sysEl('i');
    homeDotsEl.appendChild(d);
    homeDots.push(d);
  }
  homeEl.appendChild(homeDotsEl);
  hudRoot.appendChild(homeEl);

  // --- end overlay ---
  const endEl = sysEl('div', 'capyui-end');
  endEl.appendChild(sysEl('h2', null, 'MISCHIEF COMPLETE'));
  const endTimeEl = sysEl('div', 'capyui-time', '');
  endEl.appendChild(endTimeEl);
  endEl.appendChild(sysEl('div', 'capyui-hint', 'tap or press Enter to cause it all again'));
  hudRoot.appendChild(endEl);

  // --- biome transition: white-out + place card ---
  const fadeEl = sysEl('div', 'capyui-fade');
  hudRoot.appendChild(fadeEl);
  const placeEl = sysEl('div', 'capyui-place');
  const placeH = sysEl('h2', null, '');
  const placeRule = sysEl('div', 'capyui-placerule');
  const placeSub = sysEl('div', 'capyui-placesub', '');
  placeEl.appendChild(placeH);
  placeEl.appendChild(placeRule);
  placeEl.appendChild(placeSub);
  hudRoot.appendChild(placeEl);
  let placeTimer = 0;
  function showPlace(title, sub) {
    placeH.textContent = title;
    placeSub.textContent = sub;
    placeEl.classList.add('show');
    if (placeTimer) clearTimeout(placeTimer);
    placeTimer = setTimeout(function () { placeEl.classList.remove('show'); }, sysFADE_CARD);
  }

  // --- the moment card: the payoff for a `mini` task ---------------------
  // See TASKS' `mini` note in shared.js. Built once and reused, like the place
  // card, because a moment that allocates three elements is a moment that can
  // stutter on the frame it is supposed to be the best one.
  const momentEl = sysEl('div', 'capyui-moment');
  const momentKick = sysEl('div', 'capyui-momentkick', '');
  const momentText = sysEl('div', 'capyui-momenttext', '');
  momentEl.appendChild(momentKick);
  momentEl.appendChild(sysEl('div', 'capyui-momentrule'));
  momentEl.appendChild(momentText);
  hudRoot.appendChild(momentEl);
  let momentTimer = 0;
  function showMoment(kicker, text) {
    momentKick.textContent = kicker || '';
    momentText.textContent = text || '';
    momentEl.classList.add('show');
    if (momentTimer) clearTimeout(momentTimer);
    momentTimer = setTimeout(function () { momentEl.classList.remove('show'); }, sysMOMENT_CARD);
  }

  function toast(text) {
    if (text == null) return;
    const el = sysEl('div', 'capyui-toast', String(text));
    toastWrap.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('in'); });
    setTimeout(function () {
      el.classList.remove('in');
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
    }, 2200);
    while (toastWrap.children.length > 4) toastWrap.removeChild(toastWrap.firstChild);
  }

  let doneCount = 0;
  let taskStreak = 0, taskStreakAt = -1e9;
  let stageT = 0;
  let ended = false;
  let startMs = 0;

  function showEnd() {
    if (ended) return;
    ended = true;
    // Elapsed is measured from the click-to-begin, never from page load.
    const elapsed = startMs > 0 ? performance.now() - startMs : 0;
    endTimeEl.textContent = 'all ' + TASKS.length + ' in ' + sysFmtTime(elapsed);
    endEl.classList.add('show');
    endEl.style.pointerEvents = 'auto';
    endEl.addEventListener('pointerdown', function () { location.reload(); });
    sfx('whistle');
    setTimeout(function () { sfx('wheek', { pitch: 1.12 }); }, 420);
    shake(0.3);
  }

  // =========================================================================
  // TASK HINTS — where the next thing actually is
  // =========================================================================
  // ---- the journal's rows, now that the chapters exist --------------------
  for (let n = 1; n <= chapMax; n++) {
    const def = chapterDef(n);
    // A <button>, not a div with a role on it: it gets the keyboard, the focus
    // ring and the accessibility tree for free, and the CSS above resets it back
    // to looking like a row.
    const row = sysEl('button', 'capyui-jrrow');
    row.type = 'button';
    // The badge is the KEY THAT TRAVELS THERE, not the chapter number — the
    // same label the title card's picker prints, off the same table. They are
    // identical for the first nine and they are not for the last four, and the
    // footer of this card says "press its number".
    // THE SAME PICTURE THE TITLE CARD USES, twenty-eight pixels wide.
    //
    // The board is the other half of the same decision — "which of these
    // places do I want to be in" — and until now the two surfaces answered it
    // in completely different languages: a shelf of postcards on one and
    // sixteen lines of text on the other. Sixteen lines of text is a timetable.
    // One mark per row costs nothing (the marks already exist, they are a
    // dozen polygons each) and it makes the board scannable by COLOUR, which
    // at sixteen rows is the only way anybody scans anything.
    const nEl = sysEl('div', 'capyui-jrn');
    const badge = sysEl('span', 'capyui-jrkey', sysPickLabel(n - 1));
    const thumb = sysEl('span', 'capyui-jrmark');
    thumb.style.background = sysMarkTint(def.biome, 0.42);
    const tmark = sysBuildMark(def.biome);
    if (tmark) thumb.appendChild(tmark);
    nEl.appendChild(thumb);
    nEl.appendChild(badge);
    const nameEl = sysEl('div', 'capyui-jrname', def.name);
    const tally = sysEl('div', 'capyui-jrtally', '');
    const rec = sysEl('div', 'capyui-jrrec', '');
    const bar = sysEl('div', 'capyui-jrbar');
    const barFill = sysEl('i');
    bar.appendChild(barFill);
    row.appendChild(nEl); row.appendChild(nameEl); row.appendChild(tally);
    row.appendChild(rec); row.appendChild(bar);
    const go = function (e) {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      jrTravel(n);
    };
    // A real button already answers Enter and Space with a click event, so this
    // is one listener rather than three, and it cannot get out of step with them.
    row.addEventListener('click', go);
    jrCard.appendChild(row);
    jrRows.push({ n: n, row: row, tally: tally, rec: rec, bar: barFill, def: def });
  }
  jrCard.appendChild(jrKeys);
  jrCard.appendChild(jrFoot);

  /**
   * Chapter n is somewhere you may travel to directly.
   *
   * Three ways in, and the third is the only subtle one:
   *   - Sydney, always. It is home; you can always go home.
   *   - anywhere you have already stood, so nothing is ever a one-way trip and
   *     a chapter you left two tasks short is two minutes away rather than
   *     twenty;
   *   - and the next place you have not finished, counting FROM TWO — which is
   *     exactly what the overseas terminal at Manly has always offered.
   *
   * That last clause has to skip chapter one or it never offers anything at
   * all: Sydney is eighteen tasks and is almost never the first chapter
   * finished, so "the lowest incomplete chapter" is Sydney for most of the game
   * and the board showed a single unlocked line reading 'Sydney' for two hours.
   * Measured on the first build of it, and it made the board useless.
   */
  function jrOpen(n) {
    if (n === 1) return true;
    if (jrSeen[n]) return true;
    for (let k = 2; k <= chapMax; k++) {
      if (!chapComplete(k)) return k === n;
    }
    return false;
  }

  function jrRefresh() {
    let done = 0;
    for (const k in taskRec) if (taskRec[k].done) done++;
    let places = 0;
    for (let k = 1; k <= chapMax; k++) if (chapComplete(k)) places++;
    const total = jrCarriedMs + (startMs > 0 ? performance.now() - startMs : 0);
    jrCount.textContent = done + ' of ' + TASKS.length + '  ·  ' + places + ' of ' + chapMax +
      ' places  ·  ' + sysFmtTime(total);
    const here = game.biome ? chapterOf(game.biome.current) : 1;
    for (let i = 0; i < jrRows.length; i++) {
      const r = jrRows[i];
      const rec = chapRec[r.n];
      let d = 0;
      for (let k = 0; k < rec.ids.length; k++) if (taskRec[rec.ids[k]].done) d++;
      const full = d >= rec.ids.length;
      r.tally.textContent = full ? 'all ' + d : d + ' / ' + rec.ids.length;
      r.tally.classList.toggle('full', full);
      r.bar.style.width = (rec.ids.length ? (d / rec.ids.length) * 100 : 0).toFixed(0) + '%';
      // the best numbers this chapter has produced, if any
      const bits = [];
      for (let k = 0; k < rec.ids.length; k++) {
        const t = recText(rec.ids[k]);
        if (t) bits.push(t);
      }
      // ---- AND WHERE THE DOOR IS, FOR THE PLACE YOU ARE STANDING IN --------
      // Every chapter has exactly ONE way out and CHAPTERS has carried the
      // sentence describing it since the board was built — but it was only ever
      // printed once the chapter was FINISHED, on the to-do card's record
      // board. That is precisely the wrong moment: the player who needs it is
      // the one who has had enough of Marrakech at four tasks out of nine and
      // wants to go and do something else, and for them the only card in the
      // game that answers "how do I leave" said nothing at all. It is one line,
      // it is already written, and it goes on the row for the place you are in.
      if (r.n === here && !full && r.def.way) bits.unshift('the way on: ' + r.def.way);
      r.rec.textContent = bits.length ? bits.join('  ·  ') : (full ? '' : r.def.sub);
      const open = jrOpen(r.n);
      r.row.classList.toggle('locked', !open);
      r.row.classList.toggle('go', open && jrDepart);
      r.row.classList.toggle('here', r.n === here);
      // A row you cannot travel to is not a button at the moment: disabling it
      // takes it out of the tab order as well as greying it, so tabbing round
      // the board only ever lands on places you can actually go.
      // Disabled means LOCKED, not merely "you are only reading". A place you
      // could travel to stays focusable in read-only mode too, so a keyboard
      // player can tab down the board and hear where they can go.
      const live = open;
      r.row.disabled = !live;
      r.row.setAttribute('aria-disabled', live ? 'false' : 'true');
      r.row.setAttribute('aria-current', r.n === here ? 'true' : 'false');
    }
    jrFoot.textContent = jrDepart
      ? 'pick a place, or press the key beside it  ·  ESC to stay'
      : 'ESC to close  ·  three wheeks at the way out of a chapter to travel';
  }

  let jrReturnFocus = null;
  function jrShow(depart) {
    jrDepart = !!depart;
    jrShown = true;
    jrRefresh();
    // `inert` rather than pointer-events alone. A hidden overlay whose buttons
    // are still in the tab order means pressing Tab mid-game silently focuses
    // an invisible row eight items down, and the next Space press activates it.
    jrEl.inert = false;
    jrEl.classList.add('show');
    game.state.paused = true;
    jrReturnFocus = document.activeElement;
    jrCard.focus();
    // THIRTEEN ROWS AND A 720p LAPTOP. The card scrolls, but it opens at the
    // top — so on a short window the last chapters are below the fold and the
    // player has to discover that a card with no scrollbar on it can be
    // scrolled at all. Bring the place you are standing in into view, which is
    // both the row that answers "where am I" and the anchor for the rows either
    // side of it. Nearest, so a row already on screen does not jump.
    const hereN = game.biome ? chapterOf(game.biome.current) : 1;
    const hereRow = jrRows[hereN - 1];
    if (hereRow && hereRow.row.scrollIntoView) {
      try { hereRow.row.scrollIntoView({ block: 'nearest' }); } catch (e) { /* old engine */ }
    }
  }
  function jrHide() {
    if (!jrShown) return;
    jrShown = false;
    jrEl.classList.remove('show');
    jrEl.inert = true;
    if (jrReturnFocus && jrReturnFocus.focus) { try { jrReturnFocus.focus(); } catch (e) {} }
    jrReturnFocus = null;
    if (!document.hidden) game.state.paused = false;
  }
  function jrToggle() { if (jrShown) jrHide(); else jrShow(false); }

  /**
   * THE DEPARTURES BOARD.
   *
   * Every chapter's exit used to lead to exactly one place: Sydney, from
   * abroad, and the next unfinished chapter, from Manly. That is a fine rule
   * for two chapters and a toll booth for eight — the trip abroad costs a ferry,
   * a boat, seven hundred metres of open water and a walk up the Corso, and it
   * was going to be paid seven times.
   *
   * The rule that made the game legible is untouched: every place still has
   * exactly ONE way out of it, standing somewhere obvious, using a verb the
   * player already has. What has changed is that the way out now asks where to.
   */
  function jrTravel(n) {
    if (!jrShown || !jrDepart) return;
    if (!jrOpen(n)) return;
    const def = chapterDef(n);
    if (game.biome && game.biome.isActive(def.biome)) { jrHide(); return; }
    jrHide();
    homeSet(0); homeT = 0;
    homeEl.classList.remove('show');
    homeShown = false;
    homeHinted = false;
    sfx('horn');
    biomeFadeTo(def.biome, def.name.toUpperCase(), def.sub, function () {
      if (def.arrive) completeTask(def.arrive);
    });
  }

  // HEIGHT IS A THIRD OF THE ANSWER IN FOUR CHAPTERS AND IT WAS NEVER CARRIED.
  // A hint is a point, and a point was two numbers — which is exactly right in
  // the flat nine and useless in the Drift (decks thirty to a hundred metres
  // up), Hong Kong (the whole chapter is "up is a direction here"), Palawan
  // (the interesting half is underneath) and Cappadocia. "84 m" over an arrow
  // pointing north is a lie in those: the thing is eleven metres away and forty
  // metres over your head, and the player walks into a cliff looking for it.
  // The third number is optional and is NaN wherever nobody knows one.
  const hintOut = { x: 0, z: 0, y: NaN, ok: false };
  function hintAt(x, z, y) {
    if (typeof x !== 'number' || x !== x || typeof z !== 'number' || z !== z) return null;
    hintOut.x = x; hintOut.z = z; hintOut.ok = true;
    hintOut.y = (typeof y === 'number' && y === y) ? y : NaN;
    return hintOut;
  }
  function hintXZ(x, z) { return hintAt(x, z); }
  /** The nearest stone lantern still standing. */
  function hintKyoLantern() {
    const ky = game.kyoto;
    const l = ky && ky.lanterns;
    const capy = game.capy;
    if (!l || !capy) return null;
    let bx = 0, bz = 0, bd = Infinity;
    for (let i = 0; i < l.length; i += 3) {
      const dx = l[i] - capy.position.x, dz = l[i + 1] - capy.position.z;
      const d = dx * dx + dz * dz;
      if (d < bd) { bd = d; bx = l[i]; bz = l[i + 1]; }
    }
    return bd < Infinity ? hintAt(bx, bz) : null;
  }
  function hintObj(o) {
    if (!o) return null;
    const p = (o.position && typeof o.position.x === 'number') ? o.position
            : (o.group && o.group.position) ? o.group.position
            : (typeof o.x === 'number' ? o : null);
    return p ? hintAt(p.x, p.z, p.y) : null;
  }
  /** Nearest live prop of a type, optionally filtered. Gameplay reads body.position. */
  function hintProp(type, filter) {
    const arr = game.props;
    if (!arr) return null;
    const p = game.capy && game.capy.position;
    let best = null, bestD = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i];
      if (!q || q.type !== type || q.removed || q.hidden || q.held) continue;
      if (!q.body) continue;
      if (filter && !filter(q)) continue;
      const b = q.owner && q.mesh ? q.mesh.getWorldPosition(sysV3) : q.body.position;
      const d = p ? (b.x - p.x) * (b.x - p.x) + (b.z - p.z) * (b.z - p.z) : 0;
      if (d < bestD) { bestD = d; best = { x: b.x, y: b.y, z: b.z }; }
    }
    return best ? hintAt(best.x, best.z, best.y) : null;
  }
  /** Nearest NPC matching a predicate. */
  function hintNpc(pred) {
    const arr = game.npcs;
    if (!arr) return null;
    const p = game.capy && game.capy.position;
    let best = null, bestD = Infinity;
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i];
      if (!r || !r.group || !pred(r)) continue;
      const g2 = r.group.position;
      const d = p ? (g2.x - p.x) * (g2.x - p.x) + (g2.z - p.z) * (g2.z - p.z) : 0;
      if (d < bestD) { bestD = d; best = g2; }
    }
    return best ? hintAt(best.x, best.z, best.y) : null;
  }
  function hintZone(name) {
    const z = game.env && game.env.zones && game.env.zones[name];
    if (!z || typeof z.x0 !== 'number') return null;
    return hintAt((z.x0 + z.x1) * 0.5, (z.z0 + z.z1) * 0.5);
  }
  function hintHolding(type) {
    const c = game.capy;
    return !!(c && c.heldProp && c.heldProp.type === type && !c.heldProp.spilled);
  }
  // A point out in the harbour, straight off the nearest quay edge.
  function hintWater() {
    const p = game.capy && game.capy.position;
    return hintAt(p ? clamp(p.x, -44, 20) : 0, -14);
  }
  function hintStall() {
    const pa = game.pasto;
    const list = pa && pa.stalls;
    if (!list || !list.length) return null;
    const p = game.capy && game.capy.position;
    let best = null, bestD = Infinity;
    for (let i = 0; i < list.length; i++) {
      const s = list[i];
      if (!s || s.collapsed) continue;
      const sx = typeof s.x === 'number' ? s.x : (s.position ? s.position.x : NaN);
      const sz = typeof s.z === 'number' ? s.z : (s.position ? s.position.z : NaN);
      if (sx !== sx || sz !== sz) continue;
      const d = p ? (sx - p.x) * (sx - p.x) + (sz - p.z) * (sz - p.z) : 0;
      if (d < bestD) { bestD = d; best = { x: sx, z: sz }; }
    }
    return best ? hintAt(best.x, best.z) : null;
  }

  // id -> { where(): point|null, clue: one short line }
  // `clue` is the sentence the player reads while the arrow points; it names the
  // VERB, because the row already names the noun.
  const sysHINTS = {
    // ---- Sydney -----------------------------------------------------------
    wheek:        { clue: 'press Q, anywhere', where: function () { return null; } },
    'steal-hat':  { clue: 'grab it off their head with E',
                    where: function () { return hintNpc(function (r) { return r.heldProp && r.heldProp.type === 'hat'; }) || hintProp('hat'); } },
    'coffee-spill': { clue: 'barge them at a run',
                    where: function () { return hintNpc(function (r) { return r.heldProp && r.heldProp.type === 'coffee'; }) || hintProp('coffee'); } },
    'picnic-thief': { clue: 'grab it with E', where: function () { return hintProp('sandwich'); } },
    'bin-chicken':  { clue: 'charge it at a run', where: function () { return hintProp('bin'); } },
    'dig-flower':   { clue: 'hold E on the soil to dig',
                    where: function () { return hintProp('flower', function (q) { return q.planted; }) || hintZone('flowerbed'); } },
    chased:         { clue: 'wreck the beds where he can see you',
                    where: function () { return hintNpc(function (r) { return r.kind === 'gardener'; }); } },
    'photo-op':     { clue: 'stand still and face them',
                    where: function () { return hintNpc(function (r) { return r.hasCamera; }); } },
    'opera-stage':  { clue: 'get up on the podium', where: function () { return hintZone('operaStage'); } },
    'ball-harbour': { clue: hintHoldingBall, where: function () { return hintHolding('ball') ? hintWater() : hintProp('ball'); } },
    swim:           { clue: 'walk in and keep going', where: hintWater },
    'hat-harbour':  { clue: 'carry a stolen hat to the water',
                    where: function () { return hintHolding('hat') ? hintWater() : hintProp('hat', function (q) { return q.wasStolen; }) || hintProp('hat'); } },
    'cafe-table':   { clue: 'climb up onto the tabletop',
                    where: function () { return hintObj(game.env && game.env.cafeTables && game.env.cafeTables[0]); } },
    'busker-hat':   { clue: 'take the hat while he plays',
                    where: function () { return hintObj(game.quay && game.quay.busker) || hintObj(game.env && game.env.buskerSpot); } },
    'dog-loose':    { clue: 'press E next to the lead',
                    where: function () { return (game.quay && game.quay.onLead && game.quay.onLead()) ? hintObj(game.quay.dog) : null; } },
    'seagull-chips': { clue: 'drag the chips out into the open',
                    where: function () { return hintProp('chips'); } },
    sprinkler:      { clue: 'stand on the valve, then wait for a tourist',
                    where: function () { return hintObj(game.env && game.env.sprinklers && game.env.sprinklers[0]); } },
    'whippy-run':   { clue: 'up the open hatch, then onto the roof, and stay there',
                    where: function () { return hintObj(game.env && game.env.van && game.env.van()); } },
    'ferry-ride':   { clue: 'get aboard before she sails',
                    where: function () { return hintObj(game.env && game.env.ferry); } },
    // ---- Sydney Harbour ----------------------------------------------------
    'to-quay':        { clue: 'take her out past the wharf',
                    where: function () { return hintObj(game.quay && game.quay.boat && game.quay.boat.position); } },
    'take-helm':      { clue: 'stand at the wheel and press E',
                    where: function () { return hintObj(game.quay && game.quay.boat && game.quay.boat.helm); } },
    'under-bridge':   { clue: 'steer under the arch, then press Q',
                    where: function () { return hintXZ(12, -58); } },
    'yacht-race':     { clue: 'thread the fleet without slowing down',
                    where: function () { return hintXZ(70, -330); } },
    'dolphin-escort': { clue: 'hold her flat out for a while',
                    where: function () { return null; } },
    'manly-voyage':   { clue: 'north, then ease off alongside',
                    where: function () { return hintXZ(118, -544); } },
    'ferry-salute': { clue: 'get inside eighty metres of her, then blow the horn',
                    where: function () { return hintObj(game.quay && game.quay.freshwater && game.quay.freshwater()); } },
    'manly-pine':     { clue: 'ashore, up the Corso, red awning',
                    where: function () { return hintXZ(118, -586); } },
    // ---- Kyoto & Uji -------------------------------------------------------
    'to-kyoto':       { clue: 'the terminal at Manly goes further than you think',
                    where: function () { return null; } },
    'torii-run':      { clue: 'through every gate, in order, all the way up',
                    where: function () {
                      const ky = game.kyoto;
                      return hintObj((ky && ky.toriiNext && ky.toriiNext()) ||
                                     (ky && ky.toriiStart));
                    } },
    'lantern-topple': { clue: 'hit one at a run',
                    where: function () { return hintKyoLantern(); } },
    'zen-ruin':       { clue: 'walk all over it',
                    where: function () { return hintObj(game.kyoto && game.kyoto.zen); } },
    'dry-crossing':   { clue: 'six granite stones out to the island, and they are a hop apart',
                    where: function () { return hintObj(game.kyoto && game.kyoto.stones); } },
    'golden-swim':    { clue: 'in you get',
                    where: function () { return hintObj(game.kyoto && game.kyoto.pond); } },
    'bamboo-dash':    { clue: 'straight through, at a run, end to end',
                    where: function () { return hintObj(game.kyoto && game.kyoto.bamboo); } },
    'uji-run':        { clue: function () {
                      const k = game.kyoto;
                      if (!k) return 'in at the bridge, out at the mill';
                      if (!k.inRiver()) return 'off the shrine bay, into the water';
                      const t = k.runTime();
                      return (t >= 0 ? t.toFixed(1) + ' s  ·  ' : '')
                             + (k.riverMid() > 0.55 ? 'you are in the thread' : 'get off the bank');
                    },
                    where: function () {
                      const k = game.kyoto;
                      if (!k) return null;
                      return hintObj(k.inRiver() ? k.mill : k.bridge);
                    } },
    'matcha-raid':    { clue: 'the heap by the mill at Uji',
                    where: function () { return hintObj(game.kyoto && game.kyoto.matchaHeap); } },
    'the-bell': { clue: 'pull the rope with E, then run — you have four seconds',
                    where: function () { return hintObj(game.kyoto && game.kyoto.bellRinging && game.kyoto.bellRinging() ? game.kyoto.bell : (game.kyoto && game.kyoto.bellRope && game.kyoto.bellRope())); } },
    'whisk-spin':     { clue: 'run laps of the rim until it froths',
                    where: function () { return hintObj(game.kyoto && game.kyoto.bowl); } },
    // ---- Pasto ------------------------------------------------------------
    'to-pasto':       { clue: 'sail to Manly, then wheek three times',
                    where: function () { return null; } },
    'steal-empanada': { clue: 'grab one off a stall with E', where: function () { return hintProp('empanada'); } },
    'market-chaos':   { clue: 'run straight through the frame', where: hintStall },
    'whistle-condor': { clue: 'wheek out in the open — press Q', where: function () { return null; } },
    'condor-ride':    { clue: 'wheek again, then press E under it',
                    where: function () { return (game.condor && game.condor.active) ? hintObj(game.condor.group) : null; } },
    'thermal-peak':   { clue: 'steer into the rising air off the volcano',
                    where: function () { return hintObj(game.pasto && game.pasto.craterCentre); } },
    'crater-drop':    { clue: 'bring something with you and drop it down the vent',
                    where: function () { return hintObj(game.pasto && game.pasto.craterCentre); } },
    'ruana-thief':    { clue: 'grab it with E', where: function () { return hintProp('ruana'); } },
    'church-bell':    { clue: 'run at the rope',
                    where: function () { const b = game.pasto && game.pasto.bell; return hintObj(b && (b.ropePosition || b.position)); } },
    'carroza': { clue: 'up the tow hitch at the back, then stay on the deck',
                    where: function () { return hintObj(game.pasto && game.pasto.carroza && game.pasto.carroza()); } },
    'coffee-scatter': { clue: 'throw a sack down hard',
                    where: function () { return hintProp('coffeesack') || hintObj(game.pasto && game.pasto.coffeePatio); } },
    // ---- Cali --------------------------------------------------------------
    'to-cali':        { clue: 'the crossing is somebody else’s problem',
                    where: function () { return null; } },
    'gato-sit':       { clue: 'get up on top of him',
                    where: function () { return hintObj(game.cali && game.cali.gato); } },
    'puente-ortiz':   { clue: 'two arches under it. all the way through, not halfway.',
                    where: function () { return hintObj(game.cali && game.cali.bridge); } },
    'lulada':         { clue: 'the cart on the riverbank',
                    where: function () { return hintObj(game.cali && game.cali.lulada); } },
    'chiva-ride':     { clue: 'up the ladder, onto the roof',
                    where: function () { return hintObj(game.cali && game.cali.chivaAt()); } },
    'chiva-mirador':  { clue: function () {
                      const c = game.cali;
                      if (!c) return 'stay on the roof';
                      if (c.chivaState() === 'parked') return 'get on the roof and she will go';
                      if (c.onChiva()) return 'hop the wires — the band ducks first';
                      return 'catch her up — the ladder is at the back';
                    },
                    where: function () {
                      const c = game.cali;
                      if (!c) return null;
                      // The bus while she is still going, the terrace once she is
                      // there: if you were swept off in the barrio the thing you
                      // are chasing is a bus, and if she has already parked the
                      // thing you want is the lookout.
                      return hintObj(c.chivaState() === 'arrived' ? c.mirador : c.chivaAt());
                    } },
    'cane-run':       { clue: 'in one side and keep going',
                    where: function () { return hintObj(game.cali && game.cali.cane); } },
    'salsa-dance':    { clue: function () {
                      const c = game.cali;
                      if (!c || !c.onFloor()) return 'get on the floor';
                      return 'turn, hop or wheek ON the beat  ·  ' + c.combo() + ' / ' + c.comboTarget;
                    },
                    where: function () { return hintObj(game.cali && game.cali.floor); } },
    'cart-run': { clue: 'kick the chock out with E, then get in with the mangoes',
                    where: function () { return hintObj(game.cali && game.cali.cart && game.cali.cart()); } },
    'cristo-rey':     { clue: 'up the ridge, west — you can see him from here',
                    where: function () { return hintObj(game.cali && game.cali.cristo); } },
    // ---- Rio ---------------------------------------------------------------
    'to-rio':         { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'globo-biscuit':  { clue: 'he is right there. press E.',
                    where: function () { return hintObj(game.rio && game.rio.globo); } },
    'calcadao':       { clue: 'the black-and-white wave. end to end, without stepping off it.',
                    where: function () { return hintObj(game.rio && game.rio.calcadao); } },
    'kiosk':          { clue: 'the crate is the way up, the counter is the shelf, and then E',
                    where: function () { return hintObj(game.rio && game.rio.kiosk); } },
    'futevolei':      { clue: 'barge the ball down the sand and into the water',
                    where: function () { return hintObj(game.rio && game.rio.volei); } },
    'selaron-steps':  { clue: 'from the bottom step to the top one, without stopping',
                    where: function () { return hintObj(game.rio && game.rio.selaron); } },
    'bateria':        { clue: 'get in among the drums — they are coming down the avenue',
                    where: function () { return hintObj(game.rio && game.rio.column()); } },
    // The only moving beacon in the game, and it has to be: the column walks,
    // so an arrow pointing at a fixed patch of road would be a lie within
    // fifteen seconds of the player reading it.
    'samba-parade':   { clue: function () {
                      const r = game.rio;
                      if (!r || !r.inColumn()) return 'keep up with the bateria';
                      return 'turn, hop or wheek on the TWO  ·  ' + r.combo() + ' / ' + r.comboTarget;
                    },
                    where: function () { return hintObj(game.rio && game.rio.column()); } },
    'bondinho':       { clue: 'get on the car at the bottom station and stay on it',
                    where: function () {
                      const r = game.rio;
                      if (!r) return null;
                      const c = r.cabin();
                      return hintObj(c || r.station);
                    } },
    'take-a-wave': { clue: 'swim out past the break and wait for the set',
                    where: function () { return hintObj(game.rio && game.rio.waveAt && game.rio.waveAt()); } },
    'arpoador':       { clue: 'the rock at the far end of the sand, at sunset',
                    where: function () { return hintObj(game.rio && game.rio.arpoadorRock); } },
    // ---- Iceland -----------------------------------------------------------
    'to-iceland':     { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'pylsa':          { clue: 'four steps. press E.',
                    where: function () { return hintObj(game.iceland && game.iceland.pylsa); } },
    'organ':          { clue: 'up the hill, in at the front, press E',
                    where: function () { return hintObj(game.iceland && game.iceland.organ); } },
    'geysir':         { clue: function () {
                      const i = game.iceland;
                      if (i && i.geyserSwelling()) return 'IT IS GOING. stand on it.';
                      return 'stand on it and wait. the water domes up first.';
                    },
                    where: function () { return hintObj(game.iceland && game.iceland.strokkur); } },
    'puffins':        { clue: 'get on top of the cliff and WHEEK',
                    where: function () { return hintObj(game.iceland && game.iceland.cliff); } },
    // The beacon points at the CAIRN at the top of the moraine, not at the ice.
    // Sending somebody straight up a frictionless twenty-degree slope is a joke
    // that stops being funny the second time.
    'snowcat':        { clue: 'it patrols the moraine all night. get on the back of it and stay on.',
                    where: function () { return hintObj(game.iceland && game.iceland.snowcat && game.iceland.snowcat()); } },
    'glacier-run':    { clue: function () {
                      const i = game.iceland;
                      if (i && i.sliding()) return 'do not stop. do not stop.';
                      return 'up the rock on the right, then take the ice';
                    },
                    where: function () { return hintObj(game.iceland && game.iceland.glacierTop); } },
    'the-whale': { clue: 'a fin, then a blow, then four seconds of nothing',
                    where: function () { return hintObj(game.iceland && game.iceland.whale && game.iceland.whale()); } },
    'hot-spring':     { clue: function () {
                      const i = game.iceland;
                      if (!i) return 'get in the hot water';
                      const t = i.soak();
                      if (t <= 0.001) return 'get in the hot water';
                      return 'do nothing  ·  ' + (i.soakSeconds * (1 - t)).toFixed(1) + ' s';
                    },
                    where: function () { return hintObj(game.iceland && game.iceland.spring); } },
    'aurora':         { clue: 'sit still long enough and it turns up on its own',
                    where: function () { return hintObj(game.iceland && game.iceland.spring); } },
    // ---- Marrakech ---------------------------------------------------------
    'to-sahara':      { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'orange-cart':    { clue: 'he is right there. press E.',
                    where: function () { return hintObj(game.sahara && game.sahara.cart); } },
    'snake-basket':   { clue: 'just get in it',
                    where: function () { return hintObj(game.sahara && game.sahara.basket); } },
    'date-palm':      { clue: 'the one palm with notches cut up it. press E at the foot.',
                    where: function () { return hintObj(game.sahara && game.sahara.datePalm); } },
    'souk-escape':    { clue: function () {
                      const sa = game.sahara;
                      if (!sa) return 'rob the cart, then run';
                      if (sa.chasing()) {
                        const d = sa.chaseNear();
                        return d < 6 ? 'RUN — he is right behind you'
                             : 'lose them under the roofs  ·  nearest ' + d.toFixed(0) + ' m';
                      }
                      return 'rob the cart again and go north';
                    },
                    where: function () { return hintObj(game.sahara && game.sahara.souk); } },
    'caravan':        { clue: 'get up on the lead camel and stay there',
                    where: function () { return hintObj(game.sahara && game.sahara.caravan()); } },
    'dune-surf':      { clue: function () {
                      const sa = game.sahara;
                      if (sa && sa.surfing()) return 'keep going. do not turn across it.';
                      return 'up the staked track on the shoulder, then straight back down the middle';
                    },
                    where: function () { return hintObj(game.sahara && game.sahara.duneTop); } },
    'sandstorm':      { clue: function () {
                      const sa = game.sahara;
                      if (sa && sa.storm() > 0.2) return 'do not run. just stay out here.';
                      return 'go east and wait. it will find you.';
                    },
                    where: function () { return hintObj(game.sahara && game.sahara.duneTop); } },
    'acrobats': { clue: 'stand on the mat and press E — then wait for the crouch',
                    where: function () { return hintObj(game.sahara && game.sahara.acrobatMat && game.sahara.acrobatMat()); } },
    'fire-circle':    { clue: 'press E at the fire',
                    where: function () { return hintObj(game.sahara && game.sahara.camp); } },
    // ---- the Drift ---------------------------------------------------------
    'to-drift':       { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'puff-up':        { clue: 'hop, and press Q before you land',
                    where: function () { return null; } },
    'cloud-dive':     { clue: 'walk off the end. the cloud has you.',
                    where: function () { return hintObj(game.drift && game.drift.jetty); } },
    'lampfly':        { clue: 'get near one and WHEEK at it',
                    where: function () { return hintObj(game.drift && game.drift.lamp); } },
    'weathervane':    { clue: 'stand by it until it comes right round. it takes half a breath.',
                    where: function () { return hintObj(game.drift && game.drift.vane); } },
    'handed-back':    { clue: 'go all the way into the cloud, and then wait in it',
                    where: function () { return null; } },
    'updraft':        { clue: 'the spiral of light is rising air. jump into it.',
                    where: function () { return hintObj(game.drift && game.drift.column); } },
    'wander-isle':    { clue: 'the one that is moving. get on and stay on.',
                    where: function () { return hintObj(game.drift && game.drift.wanderer()); } },
    'long-gap':       { clue: function () {
                      const d = game.drift;
                      if (!d) return 'run, hop, and wheek at the top';
                      const w = d.windSpeed();
                      if (w < 1.0) return 'dead calm. wait for the air to come back.';
                      return 'run, hop, WHEEK at the top  ·  wind ' + w.toFixed(1) + ' m/s';
                    },
                    where: function () { return hintObj(game.drift && game.drift.arch); } },
    'driftseed': { clue: 'press E on one in mid-air, and then do not let go',
                    where: function () { return hintObj(game.drift && game.drift.seed && game.drift.seed()); } },
    'lantern':        { clue: function () {
                      const d = game.drift;
                      if (!d) return 'take some light up there with you';
                      const n = d.lampflies();
                      if (n < d.lampfliesNeeded) return 'it needs light  ·  ' + n + ' of ' + d.lampfliesNeeded + ' following';
                      return 'press E at the lantern';
                    },
                    where: function () { return hintObj(game.drift && game.drift.crown); } },
    // ---- Venice. Every clue that can be is written against the TIDE, because
    // that is the one thing in this chapter a player has to learn to read.
    'to-venice':      { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'spritz-theft':   { clue: 'the orange one, on the table, under the arcade',
                    where: function () { return hintObj(game.venice && game.venice.cafe); } },
    'pigeon-storm':   { clue: function () {
                      const v = game.venice;
                      if (!v) return 'run at them. all of them.';
                      if (v.tide() > 0.5) return 'they are all up already. wait for the water to go.';
                      return 'RUN at them  ·  ' + v.pigeonsUp() + ' up';
                    },
                    where: function () { return hintObj(game.venice && game.venice.piazza); } },
    'the-well':       { clue: 'the stone drum in the middle of the campo. get on top of it, then E.',
                    where: function () { return hintObj(game.venice && game.venice.campo); } },
    'the-calli':      { clue: 'in one side and out the other. there are two bridges over that rio.',
                    where: function () { return hintObj(game.venice && game.venice.calli); } },
    'passerelle':     { clue: function () {
                      const v = game.venice;
                      if (!v) return 'the raised walkways, end to end';
                      if (v.boardsOut() < 0.6) return 'they are not out yet. wait for the siren.';
                      return 'end to end, without stepping off';
                    },
                    where: function () { return hintObj(game.venice && game.venice.boards()); } },
    'gondola-ride':   { clue: 'get on the front and stay there',
                    where: function () { return hintObj(game.venice && game.venice.gondola()); } },
    'rialto':         { clue: 'over the top and down the far side, without stopping',
                    where: function () { return hintObj(game.venice && game.venice.rialto()); } },
    'acqua-alta':     { clue: function () {
                      const v = game.venice;
                      if (!v) return 'be in the square when the water arrives';
                      if (v.rising()) return 'it is coming in NOW. get in the square.';
                      if (v.tide() > 0.8) return 'you missed it. it comes back.';
                      return 'wait for the siren, then stand in the middle of it';
                    },
                    where: function () { return hintObj(game.venice && game.venice.piazza); } },
    'traghetto': { clue: 'get on at a pontoon and stay on your feet the whole way over',
                    where: function () { return hintObj(game.venice && game.venice.traghetto && game.venice.traghetto()); } },
    'mirror-swim':    { clue: function () {
                      const v = game.venice;
                      if (!v) return 'swim it, corner to corner';
                      if (v.tide() < 0.75) return 'not deep enough yet. wait for the top of the tide.';
                      return 'end to end. it is deep enough now.';
                    },
                    where: function () { return hintObj(game.venice && game.venice.piazza); } },
    // ---- Hong Kong. The first two clues teach the verb, because a verb
    // nobody has ever pressed before does not teach itself.
    'to-kowloon':     { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'egg-tart':       { clue: 'press E at the tray',
                    where: function () { return hintObj(game.kowloon && game.kowloon.bakery); } },
    'bamboo-climb':   { clue: function () {
                      const k = game.kowloon;
                      if (k && game.capy && game.capy.climbing) return 'push the stick INTO the wall to go up';
                      return 'hold E against the bamboo';
                    },
                    where: function () { return hintObj(game.kowloon && game.kowloon.scaffold); } },
    'laundry-pole':   { clue: 'from one side of the street to the other, eleven metres up',
                    where: function () { return hintObj(game.kowloon && game.kowloon.poles); } },
    'wet-market':     { clue: 'press E at a tank. any tank.',
                    where: function () { return hintObj(game.kowloon && game.kowloon.market); } },
    'neon-sign':      { clue: 'drop onto it from the poles, and stay on it',
                    where: function () { return hintObj(game.kowloon && game.kowloon.sign); } },
    'symphony':       { clue: function () {
                      const k = game.kowloon;
                      if (!k) return 'be somewhere high when it starts';
                      if (k.showing()) return 'IT IS ON. get up there.';
                      return 'be on a roof at eight. up the bamboo.';
                    },
                    where: function () { return hintObj(game.kowloon && game.kowloon.roof); } },
    'bus-top': { clue: 'one hop to the rear platform, then up the stair',
                    where: function () { return hintObj(game.kowloon && game.kowloon.bus && game.kowloon.bus()); } },
    'ferry-horn':     { clue: 'aboard, under way, and then make a noise',
                    where: function () { return hintObj(game.kowloon && game.kowloon.ferry()); } },
    'harbour-swim':   { clue: 'off the end of the pontoon. it is not clean.',
                    where: function () { return hintObj(game.kowloon && game.kowloon.pier); } },
    'star-ferry':     { clue: 'get aboard, and stay aboard the whole way across',
                    where: function () { return hintObj(game.kowloon && game.kowloon.ferry()); } },

    'o-bonde':        { clue: function () {
                      const r = game.rio;
                      if (r && game.capy && game.capy.position.y > 12) return 'stay on it, and look down';
                      return 'the terminus is at the foot of the ramp. the step is the seat.';
                    },
                    where: function () { return hintObj(game.rio && game.rio.bonde()); } },

    'volo':           { clue: function () {
                      const v = game.venice;
                      if (v && v.volo().y > 6) return 'you are not in it. it comes back down.';
                      return 'the gilded stage at the far end. stand in the cradle.';
                    },
                    where: function () { return hintObj(game.venice && game.venice.volo()); } },

    'choi-cheng':     { clue: function () {
                      const k = game.kowloon;
                      if (!k) return 'get on the lion before it goes up the poles';
                      const p = k.lion();
                      if (p && p.y < 0.4) return 'it is resting. walk up its head — that is the ramp.';
                      return 'too late for this one. it comes back down and does it again.';
                    },
                    where: function () { return hintObj(game.kowloon && game.kowloon.lion()); } },

    // ---- Palawan. The first two teach the verb, for the same reason Hong
    // Kong's first two did: nobody has ever pressed this key in this context.
    'to-palawan':     { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'jetty-jump':     { clue: 'to the end of it, and then keep going',
                    where: function () { return hintObj(game.palawan && game.palawan.jetty); } },
    'beach-fire':     { clue: function () {
                      const c = game.capy;
                      if (c && (c.wet || 0) > 0.55) return 'now go and sit on it';
                      return 'you will have to be a great deal wetter than that first';
                    },
                    where: function () { return hintObj(game.palawan && game.palawan.fire); } },
    'outrigger':      { clue: 'down the jetty. it waits at both ends.',
                    where: function () { return hintObj(game.palawan && game.palawan.bangka()); } },
    'first-dive':     { clue: function () {
                      const p = game.palawan;
                      if (game.capy && game.capy.diving) return 'that is it. the bar is your breath.';
                      if (game.capy && (game.capy.depth || 0) > 0.05) return 'now HOLD E.';
                      return 'get in the water, then hold E';
                    },
                    where: function () { return hintObj(game.palawan && game.palawan.reef); } },
    'the-crack':      { clue: function () {
                      const p = game.palawan;
                      if (p && game.capy && p.inZone('crack', game.capy.position.x, game.capy.position.z)) {
                        return 'the roof of it is under the water. so go under it.';
                      }
                      return 'there is one gap in that cliff and it is not above the water';
                    },
                    where: function () { return hintObj(game.palawan && game.palawan.crack); } },
    'sea-turtle':     { clue: 'alongside, and under. you cannot do this from the top.',
                    where: function () { return hintObj(game.palawan && game.palawan.turtle()); } },
    'giant-clam':     { clue: 'get down to it, wait for it to open, then tap E',
                    where: function () { return hintObj(game.palawan && game.palawan.clam); } },
    'cathedral':      { clue: 'past the lagoon, and the tunnel is longer than the crack',
                    where: function () { return hintObj(game.palawan && game.palawan.cathedral); } },
    'bait-ball': { clue: 'over the drop-off. it opens if you go straight at it',
                    where: function () { return hintObj(game.palawan && game.palawan.baitBall && game.palawan.baitBall()); } },
    'the-manta':      { clue: function () {
                      if (game.capy && game.capy.carriedBy) return 'do not let go. it is not finished.';
                      if (game.capy && (game.capy.depth || 0) > 0.65) return 'get alongside the front edge and tap E';
                      return 'it is four metres down. you cannot reach it from up here.';
                    },
                    where: function () { return hintObj(game.palawan && game.palawan.manta && game.palawan.manta()); } },
    'the-bloom':      { clue: function () {
                      const p = game.palawan;
                      if (!p) return 'be under the water when it happens';
                      if (p.bloom() > 0.4) return 'IT IS HAPPENING. get under.';
                      return 'the water goes cloudy first. then get under it.';
                    },
                    where: function () { return hintObj(game.palawan && game.palawan.lagoon); } },

    // ---- Cappadocia. Three of these are the same sentence said three ways,
    // because the mechanic is one sentence and it is not an obvious one.
    'to-cappadocia':  { clue: 'somebody else is steering',
                    where: function () { return null; } },
    'chimney-top':    { clue: function () {
                      if (game.capy && game.capy.climbing) return 'push the stick INTO the rock to go up';
                      return 'hold E against one of the big ones. you have done this before.';
                    },
                    where: function () { return hintObj(game.goreme && game.goreme.chimney); } },
    'dovecote':       { clue: 'press E at the foot of the holes',
                    where: function () { return hintObj(game.goreme && game.goreme.cliff); } },
    'the-envelope':   { clue: 'the flat one, on the dirt. walk its whole length.',
                    where: function () { return hintObj(game.goreme && game.goreme.envelope()); } },
    'the-mouth':      { clue: 'the one with the fan running. in at the throat end.',
                    where: function () { return hintObj(game.goreme && game.goreme.mouth()); } },
    'the-tether':     { clue: 'press E at the rope. it is not your rope.',
                    where: function () { return hintObj(game.goreme && game.goreme.tether); } },
    'aboard':         { clue: 'walk into the basket. then hold E.',
                    where: function () { return hintObj(game.goreme && game.goreme.balloon()); } },
    'three-winds':    { clue: function () {
                      const g = game.goreme;
                      if (!g) return 'the wind goes a different way at every height';
                      if (!g.aboard()) return 'you cannot do this from the ground';
                      const a = g.altitude();
                      return 'you are in "' + g.layers[g.layerOf(a)].name +
                             '". burn to find another one.';
                    },
                    where: function () { return hintObj(game.goreme && game.goreme.field); } },
    'sunrise':        { clue: function () {
                      const g = game.goreme;
                      if (!g) return 'be high up when it comes over the ridge';
                      if (g.sunUp() > 0.05 && g.sunUp() < 0.95) return 'IT IS COMING UP. get higher.';
                      return 'be more than fifty metres up when it clears the ridge';
                    },
                    where: function () { return hintObj(game.goreme && game.goreme.valley); } },
    'the-herd': { clue: 'the one with the blanket. get on while they are standing',
                    where: function () { return hintObj(game.goreme && game.goreme.mare && game.goreme.mare()); } },
    'on-the-trailer': { clue: 'the truck is following you. come down where it can be.',
                    where: function () { return hintObj(game.goreme && game.goreme.truck()); } },

    // ---- Manly. Half of these are the same sentence — WHERE IS THE WHITE —
    // said from four different distances, because that is the whole chapter.
    'to-manly':       { clue: 'over the hill from the harbour',
                    where: function () { return null; } },
    'pine-cone':      { clue: 'press E at the foot of one of the big dark ones',
                    where: function () { return hintObj(game.manly && game.manly.pines); } },
    'move-flags':     { clue: function () {
                      const m = game.manly;
                      if (!m) return 'grab a flagpole with E, walk, press E again';
                      if (game.capy && game.capy.position.y > 60) return 'on the sand';
                      return 'E to pull one out. E again to plant it. they will follow.';
                    },
                    where: function () { return hintObj(game.manly && game.manly.flags()); } },
    'sandcastle':     { clue: 'run at it. do not be polite about it.',
                    where: function () { return hintObj(game.manly && game.manly.castle); } },
    'duck-dive':      { clue: function () {
                      const c = game.capy;
                      if (c && c.swimming) return 'HOLD E as the white bit reaches you';
                      return 'get in the water first, out where it is breaking';
                    },
                    where: function () { return hintObj(game.manly && game.manly.bank()); } },
    'the-rip':        { clue: 'the calm-looking lane with no white in it. get in it.',
                    where: function () { return hintObj(game.manly && game.manly.rip); } },
    'take-off':       { clue: function () {
                      const m = game.manly;
                      if (!m) return 'be in front of a wave when it breaks';
                      if (m.riding()) return 'HOLD IT';
                      return 'be just in FRONT of the white bit, not behind it';
                    },
                    where: function () { return hintObj(game.manly && game.manly.bank()); } },
    'all-the-way':    { clue: function () {
                      const m = game.manly;
                      if (!m) return 'take the biggest one of the set all the way in';
                      if (m.riding()) return 'do not let it go — ' + m.rideDist().toFixed(0) + ' m';
                      if (m.setNear() > 0.4) return 'THAT ONE. get in front of it.';
                      return 'the big one comes round about every minute';
                    },
                    where: function () { return hintObj(game.manly && game.manly.bank()); } },
    'the-bommie':     { clue: 'the rock out the back that stands the swell up',
                    where: function () { return hintObj(game.manly && game.manly.bommie); } },
    'bower-pool':     { clue: 'end to end. it is the only flat water here.',
                    where: function () { return hintObj(game.manly && game.manly.pool); } },
    'blue-groper':    { clue: 'round the point, in the calm. he will come to you.',
                    where: function () { return hintObj(game.manly && game.manly.shelly); } },
    'the-surfboat':   { clue: 'get in the hull before it goes, and stay in it',
                    where: function () { return hintObj(game.manly && game.manly.boat()); } },

    // ---- The Pantanal. Nothing here is startled by you, so none of these
    // clues is about sneaking. They are all about being ALLOWED.
    'to-pantanal':    { clue: 'somewhere you will not be the strangest thing',
                    where: function () { return null; } },
    'the-locals':     { clue: 'walk up to one. wheek. they have seen it all before.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.herd()); } },
    'gather':         { clue: function () {
                      const g = game.pantanal;
                      if (!g) return 'wheek near them and keep moving';
                      const n = g.following();
                      return n > 0 ? n + ' of them. wheek again, get the rest.'
                                   : 'wheek where they can hear it';
                    },
                    where: function () { return hintObj(game.pantanal && game.pantanal.herd()); } },
    'camalote':       { clue: 'the green mats float. they do NOT float for long.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.matStart()); } },
    'caiman-nap':     { clue: 'sit on one. they genuinely do not mind.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.caiman()); } },
    'jabiru-nest':    { clue: 'up the dead tree. the mounds are the way up.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.nest); } },
    'cowbird':        { clue: 'stand still near one and it will get on',
                    where: function () { return hintObj(game.pantanal && game.pantanal.cowbird()); } },
    'the-otters':     { clue: 'swim into their bit of river and wait for it',
                    where: function () { return hintObj(game.pantanal && game.pantanal.otters); } },
    'missing-plank':  { clue: 'the gap is wider than a step and narrower than a hop',
                    where: function () { return hintObj(game.pantanal && game.pantanal.bridge); } },
    'macaw-nut':      { clue: 'the blue ones, in the palm. E when you are under it.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.palm); } },
    'tamandua':       { clue: 'walk into it and press E. it will not notice.',
                    where: function () { return hintObj(game.pantanal && game.pantanal.anteater()); } },
    'the-crossing':   { clue: function () {
                      const g = game.pantanal;
                      if (!g) return 'take them over the river';
                      const n = g.following();
                      if (n < 4) return 'not enough of them yet — ' + n + ' behind you';
                      return 'go in. they will come. do not look round.';
                    },
                    where: function () { return hintObj(game.pantanal && game.pantanal.bank); } },

    // ---- Sơn Đoòng. The first four are one lesson and it is the only lesson
    // in the chapter: THE NOISE IS THE TORCH.
    'to-cave':        { clue: 'in through the hole the river goes in',
                    where: function () { return null; } },
    'first-echo':     { clue: 'Q. in the dark. that is it.',
                    where: function () { return hintObj(game.cave && game.cave.mouth); } },
    'glow-trail':     { clue: 'the green ones on the roof are pointing somewhere',
                    where: function () { return hintObj(game.cave && game.cave.river); } },
    'cave-river':     { clue: 'it is going the same way you are',
                    where: function () { return hintObj(game.cave && game.cave.river); } },
    'hand-of-dog':    { clue: 'the tall one in the middle of the passage. hop up it.',
                    where: function () { return hintObj(game.cave && game.cave.hand); } },
    'swiftlets':      { clue: 'wheek under the roost. they steer on sound as well.',
                    where: function () { return hintObj(game.cave && game.cave.roost); } },
    'cave-pearl':     { clue: 'in the shallow pools. E.',
                    where: function () { return hintObj(game.cave && game.cave.pearls); } },
    'blind-fish':     { clue: 'in the river, and it has no idea you are there',
                    where: function () { return hintObj(game.cave && game.cave.fish()); } },
    'great-wall':     { clue: function () {
                      if (game.capy && game.capy.climbing) return 'push the stick INTO it';
                      return 'hold E against the calcite. you have done this before.';
                    },
                    where: function () { return hintObj(game.cave && game.cave.wall); } },
    'the-doline':     { clue: function () {
                      const c = game.cave;
                      if (!c) return 'stand in the light';
                      if (c.daylight() > 0.3) return 'you are in it. stay there.';
                      return 'the roof has fallen in somewhere. go and stand under it.';
                    },
                    where: function () { return hintObj(game.cave && game.cave.doline); } },
    'phytokarst':     { clue: 'everything green in here is leaning the same way',
                    where: function () { return hintObj(game.cave && game.cave.phyto); } },
    'the-log':        { clue: 'something came down the river. get on it.',
                    where: function () { return hintObj(game.cave && game.cave.log()); } },

    // ---- chapter 17 ----
    'to-antarctic':   { clue: 'somewhere with nothing in it at all',
                    where: function () { return null; } },
    // Almost every arrow in this chapter points at something a very long way
    // off, which is honest: the place is eleven hundred metres from end to
    // end and nearly all of it is water. The clues are therefore about the
    // BOAT more often than about the destination, because the boat is the
    // answer to nine of these thirteen questions.
    'take-tiller':    { clue: 'stand at the back of the orange boat and press E',
                    where: function () { return hintObj(game.antarctic && game.antarctic.boat); } },
    'the-lead':       { clue: 'the open water is DARK. find it and hold full ahead.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.gate); } },
    'station-mug':    { clue: 'the big red hut is the bar. it is on the counter.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.mug()); } },
    'haul-out':       { clue: 'take her alongside a pan of ice and step off',
                    where: function () { return hintObj(game.antarctic && game.antarctic.nearestFloe()); } },
    'leopard-seal':   { clue: 'the long one on the big floe. do not get out.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.seal()); } },
    'berg-arch':      { clue: 'the flat-topped berg has a hole in it. steer through.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.berg); } },
    'whale-bones':    { clue: 'get inside the ribs and sit still',
                    where: function () { return hintObj(game.antarctic && game.antarctic.bones); } },
    'spy-hop':        { clue: 'call them, then STOP the boat and wait',
                    where: function () { return hintObj(game.antarctic && game.antarctic.pod()); } },
    'colony-chorus':  { clue: 'stand in the rookery and wheek. all of them.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.colony); } },
    'penguin-highway': { clue: 'start at the top of the worn track and let go',
                    where: function () { return hintObj(game.antarctic && game.antarctic.highTop); } },
    'blue-ice':       { clue: 'climb the snow beside it, then come down the blue',
                    where: function () { return hintObj(game.antarctic && game.antarctic.blueIce); } },
    'floe-drift':     { clue: 'get on one and stay on it. they all go north.',
                    where: function () { return hintObj(game.antarctic && game.antarctic.nearestFloe()); } },
    'orca-ride':      { clue: 'wheek from the tiller, then hold your speed',
                    where: function () { return hintObj(game.antarctic && game.antarctic.pod()); } },
  };
  function hintHoldingBall() { return hintHolding('ball') ? 'carry it into the harbour' : 'grab the ball with E'; }

  let hintT = 0, hintHas = false, hintX = 0, hintZ = 0, hintY = NaN;
  let todoTopId = '';

  // --- the rolling window --------------------------------------------------
  function chapComplete(n) {
    const rec = chapRec[n];
    if (!rec) return false;
    for (let i = 0; i < rec.ids.length; i++) {
      const r = taskRec[rec.ids[i]];
      if (!r || !r.done) return false;
    }
    return true;
  }

  /**
   * Which chapter the paper is showing. It follows the BIOME, not progress:
   * the list is meant to answer "what am I doing here", and a Pasto task on the
   * page while you are stood in the Botanic Gardens is noise you cannot act on.
   * Once the chapter you are standing in is finished, it points at whatever is
   * still open so the last stretch of the game still has a list.
   */
  function todoChapter() {
    let n = 1;
    const bio = game.biome;
    if (bio && typeof bio.isActive === 'function') {
      try { n = chapterOf(bio.current); } catch (e) { n = 1; }
    }
    if (n > chapMax) n = chapMax;
    // THE PAPER SHOWS THE PLACE YOU ARE STANDING IN, FINISHED OR NOT.
    // This used to fall through to the lowest incomplete chapter the moment the
    // live one was done, which is wrong twice over: it puts tasks on the paper
    // that cannot be attempted from here — the one rule the todo window has
    // always had is that it never shows a task from the hemisphere you are not
    // in — and it meant a finished chapter had no state of its own at all, so
    // there was nothing to say "you have done this place" and nothing to come
    // back for. A complete chapter now hands the card over to its own record
    // board (see todoRefresh), which is the thing you would want to see.
    return n;
  }

  // ids that are ticked but still on the paper, being struck through
  const todoLinger = Object.create(null);
  let todoChapShown = 0;
  // ---- THE ARROW POINTS WHERE THE PLAYER WANTS IT TO ------------------------
  // The tracked row — the one that owns the clue, the bearing and the distance —
  // was always the FIRST unticked task in the chapter, in the order they happen
  // to be written down. That is a fine default and a bad rule: a chapter is a
  // place, not a queue, and the one thing every one of these lists has in it is
  // a task you cannot do YET (the bloom is forty seconds away; the tide has not
  // come in; you have not found the scaffold). Until you did that one, the whole
  // of the card's navigation — the arrow, the metres, the sentence telling you
  // the verb — was pointed at the one thing you had already decided not to do,
  // and there was no way to say so.
  //
  // F moves the pin one task down the chapter's open list and wraps, and the
  // window of four follows it, so the card also becomes a way to READ the rest
  // of the place rather than only its next four lines. Clicking a row does the
  // same thing, which is the version that works on a phone.
  let todoPin = '';
  /** Move the pin n places down the live chapter's open list. */
  function todoStep(step) {
    const rec = chapRec[todoChapter()];
    if (!rec) return;
    const open = [];
    for (let i = 0; i < rec.ids.length; i++) {
      const r = taskRec[rec.ids[i]];
      if (r && !r.done) open.push(rec.ids[i]);
    }
    if (open.length < 2) return;              // nothing to choose between
    let i = open.indexOf(todoTopId);
    if (i < 0) i = 0;
    todoPin = open[((i + step) % open.length + open.length) % open.length];
    todoRefresh();
    sfx('pop', { volume: 0.22, pitch: 1.5 });
  }
  function todoPinTo(id) {
    const r = taskRec[id];
    if (!r || r.done || r.chapter !== todoChapter() || id === todoTopId) return;
    todoPin = id;
    todoRefresh();
    sfx('pop', { volume: 0.22, pitch: 1.5 });
  }

  function todoRefresh() {
    const n = todoChapter();
    const rec = chapRec[n];
    if (!rec) return;
    const show = Object.create(null);
    let done = 0;
    // The open list first, so the window can START at the pinned row rather
    // than always at the top of the chapter.
    const openIds = [];
    for (let i = 0; i < rec.ids.length; i++) {
      const r = taskRec[rec.ids[i]];
      if (!r) continue;
      if (r.done) { done++; if (todoLinger[rec.ids[i]]) show[rec.ids[i]] = true; }
      else openIds.push(rec.ids[i]);
    }
    // A pin only survives while it is still open and still in this chapter.
    let pi = todoPin ? openIds.indexOf(todoPin) : -1;
    if (pi < 0) { todoPin = ''; pi = 0; }
    // CLAMPED, NOT WRAPPED. The rows are built once and live in a fixed DOM
    // order, so a window that wrapped past the end would draw its last two
    // entries ABOVE its first two and the clue would sit in the middle of the
    // card. Sliding the window back off the end keeps the paper readable and
    // still shows the pinned row.
    const start = Math.min(pi, Math.max(0, openIds.length - sysTODO_WINDOW));
    const top = openIds.length ? openIds[pi] : '';
    for (let i = start; i < openIds.length && i < start + sysTODO_WINDOW; i++) show[openIds[i]] = true;
    if (top !== todoTopId) {
      // clear the aim off whoever used to be top
      const old = taskRec[todoTopId];
      if (old) { old.aim.classList.remove('on'); old.dist.textContent = ''; }
      todoTopId = top;
      hintHas = false;
      hintT = 0;                                   // resolve on the next frame
      const h = top ? sysHINTS[top] : null;
      const clue = h ? (typeof h.clue === 'function' ? h.clue() : h.clue) : '';
      clueEl.textContent = clue || '';
      clueEl.classList.toggle('off', !clue);
    }
    for (const id in taskRec) {
      const r = taskRec[id];
      const want = !!show[id];
      if (want === r.shown) continue;
      r.shown = want;
      if (want) { r.li.classList.remove('capyui-hidden'); r.li.style.transform = r.tilt; }
      else { r.li.classList.add('capyui-hidden'); r.li.classList.remove('capyui-fold'); }
    }
    // The clue belongs directly under the row it is about, not at the foot of
    // the card with three unrelated rows in between.
    const topRec = taskRec[todoTopId];
    if (topRec && topRec.shown && topRec.li.parentNode === listEl) {
      if (clueEl.previousSibling !== topRec.li) listEl.insertBefore(clueEl, topRec.li.nextSibling);
    } else if (clueEl.parentNode !== todoEl) {
      todoEl.insertBefore(clueEl, countEl);
    }
    countEl.textContent = chapLabel(n) + '  ·  ' + done + ' / ' + rec.ids.length;

    // ---- A FINISHED CHAPTER IS NOT AN EMPTY CARD ---------------------------
    // Tick the last thing in a place and the paper went blank: four hidden rows,
    // a tally reading 18 / 18, and nothing at all to look at. That is the moment
    // a player leaves and does not come back, and it arrives thirteen times.
    // So when the list runs out the card turns into the record board for THIS
    // place — every number you hold here, and now every chapter has at least one
    // (see RECORDS: the harbour passage, the condor's altitude and the gulls
    // were added precisely because the first three chapters had none).
    // It is the same element the clue uses, so nothing new is laid out and
    // nothing moves when the last row folds away.
    if (done >= rec.ids.length && rec.ids.length) {
      let best = '';
      for (let i = 0; i < rec.ids.length; i++) {
        const t = recText(rec.ids[i]);
        if (t) best += (best ? '\n' : '') + t;
      }
      // and where the way on is, in words. A player who has just finished a
      // place is exactly the player who has stopped looking at the map, and
      // every chapter hides its exit somewhere specific on purpose.
      const cd = chapterDef(n);
      if (cd && cd.way) best += (best ? '\n' : '') + 'the way on: ' + cd.way;
      clueEl.textContent = best || 'nothing left undone here';
      clueEl.classList.remove('off');
      if (clueEl.parentNode !== todoEl) todoEl.insertBefore(clueEl, countEl);
      clueEl.classList.add('recs');
      todoHeadEl.textContent = 'Done here';
    } else {
      clueEl.classList.remove('recs');
      todoHeadEl.textContent = 'To do';
    }


    if (todoChapShown !== n) {
      todoChapShown = n;
      todoEl.classList.add('grow');
      setTimeout(function () { todoEl.classList.remove('grow'); }, 760);
    }
  }

  /** A ticked row is read, then rolled up, then replaced by the next one. */
  function todoRetire(id) {
    const r = taskRec[id];
    if (!r) return;
    r.li.classList.add('capyui-fold');
    setTimeout(function () {
      delete todoLinger[id];
      r.li.classList.remove('capyui-fold');
      todoRefresh();
    }, sysTODO_ROLL);
  }

  // =========================================================================
  // THE SAVE FILE
  //
  // One key, one object, written on a debounce so a four-tick streak is one
  // write rather than four. Every read and every write is wrapped: a browser
  // with storage disabled, a private window, a full quota — none of those may
  // ever be the reason a capybara game stops working, so all of it degrades to
  // "no save" in silence.
  // =========================================================================
  const jrSeen = Object.create(null);          // chapters the player has stood in
  const jrRecs = Object.create(null);          // task id -> best value
  let jrCarriedMs = 0;                         // elapsed time from earlier sessions
  let saveT = 0, savePending = false;
  // Has this machine ever been told the game keeps a file? Set from the file
  // itself, so it is said once per journey and not once per session.
  let saveTold = false;

  function saveRead() {
    try {
      const raw = localStorage.getItem(sysSAVE_KEY);
      if (!raw) return null;
      const o = JSON.parse(raw);
      return (o && o.v === 1) ? o : null;
    } catch (e) { return null; }
  }
  function saveWrite() {
    savePending = false;
    try {
      const tasks = [];
      for (const k in taskRec) if (taskRec[k].done) tasks.push(k);
      const seen = [];
      for (const k in jrSeen) seen.push(+k);
      localStorage.setItem(sysSAVE_KEY, JSON.stringify({
        v: 1, tasks: tasks, seen: seen, recs: jrRecs, told: 1,
        ms: jrCarriedMs + (startMs > 0 ? performance.now() - startMs : 0),
        biome: (game.biome && game.biome.current) || 'sydney',
      }));
      // ---- SAY IT ONCE ----------------------------------------------------
      // This game is three and a quarter hours long and it has kept a save file
      // for a while now, and it has never once told anybody. A player who
      // assumes a browser toy is a browser toy will not close the tab — they
      // will sit through a chapter they wanted to leave, or they will close it
      // and never find out that it was all still there. One sentence, on the
      // first write of a new journey, then never again on any machine that has
      // the flag on file. It is deliberately AFTER the write: a private window
      // with storage off throws above this line, and telling somebody their
      // progress is safe when it demonstrably is not is the worst of both.
      if (!saveTold) {
        saveTold = true;
        toast('saved — you can close this and come back');
      }
    } catch (e) { /* storage off, quota full — the game does not care */ }
  }
  function saveSoon() { savePending = true; saveT = 0; }
  function saveClear() { try { localStorage.removeItem(sysSAVE_KEY); } catch (e) {} }

  /**
   * A NUMBER WORTH BEATING.
   *
   * Called by the biomes when a measured task lands. Never gates anything: it
   * records, it says so if it is a best, and that is the whole contract. A
   * record that blocked progress would turn a game about being a nuisance into
   * an exam, which is the one thing this must not become.
   */
  function recordValue(id, value) {
    const def = RECORDS[id];
    if (!def || typeof value !== 'number' || value !== value) return false;
    const prev = jrRecs[id];
    const better = prev === undefined ||
      (def.better === 'lower' ? value < prev : value > prev);
    if (!better) return false;
    jrRecs[id] = value;
    saveSoon();
    // Only shout about it if it BEAT something. The first time you do a thing,
    // the tick is the news and a personal best on a first attempt is noise.
    if (prev !== undefined) {
      toast('personal best  ·  ' + def.label + ' ' + value.toFixed(def.dp) + def.unit);
      sfx('chime', { volume: 0.55, pitch: 1.45 });
    }
    return true;
  }
  function recText(id) {
    const def = RECORDS[id];
    if (!def || jrRecs[id] === undefined) return '';
    return def.label + ' ' + jrRecs[id].toFixed(def.dp) + def.unit;
  }

  function completeTask(id, silent) {
    const r = taskRec[id];
    if (!r || r.done) return false;
    r.done = true;
    r.li.classList.add('done');
    doneCount++;
    game.state.score = doneCount;
    musProg = doneCount / TASKS.length;
    // ---- restoring a save is not the same act as doing the thing ----------
    // Reloading into a half-finished journey must not fire forty toasts, forty
    // ticks, forty confetti bursts and six chapter ceremonies in the first
    // second of the session. Everything below this line is CELEBRATION; the
    // three lines above it are the state.
    if (silent) {
      // Visibility is todoRefresh's call alone: un-hiding here without setting
      // r.shown left every restored row struck-through on the card forever.
      return true;
    }

    // ---- the payoff -------------------------------------------------------
    // Three channels at once, because one of them alone reads as a UI event
    // rather than as an achievement: a rising in-key figure, a burst of torn
    // paper off the animal itself, and the card taking the hit.
    const now = game.state.time;
    taskStreak = (now - taskStreakAt < sysTASK_STREAK) ? taskStreak + 1 : 0;
    taskStreakAt = now;
    // ---- and once a chapter, all of that, but meant ----------------------
    // See TASKS' `wow` note in shared.js. Eleven rows in ninety-one carry it and
    // the scarcity is the point, so everything here is deliberately a DIFFERENT
    // channel rather than a louder one: the banner instead of the toast, the
    // lift instead of the tick, paper enough to fill the frame.
    // ---- and once or twice more, a good one ------------------------------
    // `mini` is the middle rung: a set piece worth twenty-five seconds but not
    // worth the chapter's one banner. It gets HALF the lift (the same figure,
    // the same key, quieter and shorter), the moment card, and a burst between
    // the two. Nothing here is a smaller `wow` — it is a bigger tick, which is
    // the only way both can keep meaning what they mean.
    const wow = r.def && r.def.wow;
    const mini = !wow && r.def && r.def.mini;
    sfx('tick', { streak: taskStreak });
    const cp = game.capy && game.capy.position;
    if (wow) {
      musSwell(1);
      sfx('cheer', { volume: 0.7, pitch: 1.15, force: true });
      // The ring holds 26 scraps, so this is very nearly all of it — which is
      // right: the small ticks should never be able to look like this one.
      if (cp) confettiBurst(cp.x, cp.y + 0.55, cp.z, 24);
      // The place card, borrowed: the caption goes in the big slot and the task
      // underneath it, which is the composition arrivals already use and the one
      // the type is sized for. The task text is a sentence and would be 60 px of
      // wrapped headline in the other order.
      showPlace(wow, r.def ? r.def.text : id);
      punch(0.14);
      // THE ONE MOMENT THE CHAPTER IS FOR gets the fourth channel. The banner,
      // the lift, the crowd and the paper all say "that was the big one" AFTER
      // the fact — the beat is the only one of the five that says it while it
      // is still happening. Seventeen of ninety-odd rows carry `wow` and no
      // other caller in the game may ask for this: the scarcity is the whole
      // mechanism, exactly as it is for the banner itself.
      if (game.slowmo) game.slowmo(sysWOW_SLOW, sysWOW_SLOW_T);
    } else if (mini) {
      musSwell(sysMINI_SWELL);
      // 'chime' and not 'cheer': the crowd noise belongs to the banner alone,
      // and a chime under a half-lift is the sound of something small going
      // right rather than of a room standing up.
      sfx('chime', { volume: 0.5, pitch: 1.18, force: true });
      if (cp) confettiBurst(cp.x, cp.y + 0.5, cp.z, 18);
      showMoment(mini, r.def ? r.def.text : id);
      punch(0.09);
    } else {
      if (cp) confettiBurst(cp.x, cp.y + 0.45, cp.z, taskStreak > 0 ? 16 : 12);
      toast('✔  ' + (r.def ? r.def.text : id));
      punch(0.06);
    }
    todoEl.classList.remove('stamp');
    void todoEl.offsetWidth;                 // restart the animation, not queue it
    todoEl.classList.add('stamp');
    game.events.emit('task:complete', { id: id });
    // Hold it on the paper long enough to be struck through, then let the next
    // one take its place. Refresh first so the tally moves on the same beat.
    // Only ever ONE row lingers: two ticks inside the linger window (a thrown
    // hat that lands in the harbour, say) would otherwise put six rows on a card
    // sized for five, so the older one gives up its place immediately.
    for (const k in todoLinger) { delete todoLinger[k]; taskRec[k].li.classList.remove('capyui-fold'); }
    todoLinger[id] = true;
    todoRefresh();
    setTimeout(function () { todoRetire(id); }, sysTODO_LINGER);
    saveSoon();
    // ---- the chapter is finished -----------------------------------------
    // The eighth tick in a place used to look exactly like the third, and then
    // the paper quietly changed country. A chapter is the unit this game is
    // actually built out of; finishing one has to be a moment.
    const cn = r.chapter;
    if (chapComplete(cn) && !jrChapDone[cn]) {
      jrChapDone[cn] = true;
      setTimeout(function () { chapterCeremony(cn); }, 1100);
    }
    if (doneCount >= TASKS.length) setTimeout(showEnd, 900);
    return true;
  }

  const jrChapDone = Object.create(null);
  const jrChapAt = Object.create(null);       // ms at which each chapter finished

  /**
   * The end of a place. Deliberately built out of the pieces that already exist
   * — the place card, the confetti, the tick chime — rather than a new screen,
   * because a full-screen interruption every twenty minutes is a worse reward
   * than a good ten seconds that lets you keep playing.
   */
  function chapterCeremony(n) {
    const def = chapterDef(n);
    const rec = chapRec[n];
    const total = jrCarriedMs + (startMs > 0 ? performance.now() - startMs : 0);
    const prev = jrChapAt.lastTotal || 0;
    jrChapAt[n] = total;
    jrChapAt.lastTotal = total;
    let doneChaps = 0;
    for (let k = 1; k <= chapMax; k++) if (chapComplete(k)) doneChaps++;
    showPlace(def.name.toUpperCase() + '  ·  DONE',
      rec.ids.length + ' of ' + rec.ids.length + '  ·  ' + sysFmtTime(total - prev) +
      '  ·  ' + doneChaps + ' of ' + chapMax + ' places');
    sfx('chime', { volume: 1.0, pitch: 1.2 });
    setTimeout(function () { sfx('cheer', { volume: 0.8 }); }, 520);
    const cp = game.capy && game.capy.position;
    if (cp) { confettiBurst(cp.x, cp.y + 0.6, cp.z, 34); }
    punch(0.18);
    saveSoon();
    // ---- AND THEN WHAT ----------------------------------------------------
    // The ceremony was a full stop. It said what you had done, how long it took
    // and how many places were left, and then the game went quiet and left a
    // player who had just finished a place stood in a finished place. The one
    // sentence they need next is where the door is, and it is already written
    // down in CHAPTERS — so it arrives after the card, in the game's own voice,
    // as the last thing said about the chapter rather than the first thing said
    // about the next one.
    if (def.way && n !== chapMax) {
      setTimeout(function () {
        if (chapterOf(game.biome.current) === n) toast('the way on: ' + def.way);
      }, 4200);
    }
  }

  // =========================================================================
  // 2/3. CAMERA + INPUT
  // =========================================================================
  const input = game.input;
  // main.js builds game.input without the chapter-2 fields; publish them before
  // any reader can see the object in a half-defined state.
  input.whistle = false;
  input.whistlePressed = false;
  const keys = Object.create(null);
  let honkPend = false, actionPend = false, whistlePend = false, jumpPend = false;
  let touchJump = false, touchJumpPend = false;
  let mouseAction = false;
  let touchHonk = false, touchHonkPend = false, touchAction = false, touchActionPend = false;
  let touchWhistlePend = false;
  let stickX = 0, stickZ = 0, stickActive = false;
  let camYaw = 0, camYawTarget = 0, camHandT = 0, camIdleT = 0;
  let camDist = sysCAM_DEF, camDistTarget = sysCAM_DEF;
  let camDolly = 0;
  let shakeAmt = 0;
  let camInit = false;
  // flight rig: blend 0..1, the heading the rig is chasing, and its damped follow
  let flyT = 0, flyYaw = 0, flyYawT = 0, flyWas = false;
  let sailT = 0, sailWas = false;      // helm rig blend, and its rising edge
  let rigT = 0;                        // 0..1, how far a biome's own lens is in
  let altOpen = 0;                       // damped 0..1 climb, opens the fog
  let flyHudT = 0, flyHudOn = false, flyThermOn = false;
  // last values actually written to the DOM — the readout only touches the document
  // when a displayed digit changes, so a steady climb costs nothing at all
  let flyAltLast = -1, flyAirLast = -1, flyBarLast = -1;
  // the way home
  let homeCount = 0, homeT = 0, homeShown = false, homeHinted = false;
  // put me back — a short trail of places the animal was demonstrably able to
  // walk out of, and the hold that returns it to the oldest of them
  const backRing = [];
  let backT = 0, backHold = 0, backBusy = 0;
  let dragId = -1;
  // ---- THE PAD ------------------------------------------------------------
  // See sysPAD_* and padPoll(). Held state is recomputed every frame from the
  // poll; the four edges are queued here and published at the very END of
  // update(), because that is the only place they can be published from.
  let padOn = false, padIdx = -1, padSeen = false;
  let padX = 0, padZ = 0, padRun = false;
  let padHonk = false, padAction = false, padJump = false;
  let padWasHonk = false, padWasAction = false, padWasJump = false;
  let padWasStart = false, padWasBack = false, padWasSnap = false;
  let padEdgeHonk = false, padEdgeAction = false, padEdgeJump = false;
  let padRumbleT = 0;
  let perfOn = false;
  let hudBare = false;                 // P — the furniture is off the window
  let started = false;

  // ---- THE LENS: SPEED, PUNCH AND THE LEAN-IN ----------------------------
  // See the sysFOV_* block. All three terms are presentation; none of them is
  // read by anything that decides where the animal is.
  let fovSpeed = 0;              // damped, 0..1 of the live rig's reference speed
  let fovKick = 0, fovKickV = 0; // the punch spring, in degrees
  let fovLast = sysFOV_BASE;

  function shake(a) {
    if (!(a > sysSHAKE_MIN)) return;
    // A player who asked the operating system for less motion asked for this
    // one before anything else in the file. sysCalmMotion was already honoured
    // by the minimap sweep and the glitter on eight seas and was never wired to
    // the one effect that actually moves the whole frame.
    if (sysCalmMotion) return;
    shakeAmt = clamp(shakeAmt + a, 0, sysSHAKE_MAX);
  }

  /**
   * THE ONE CALL FOR "THAT LANDED".
   *
   * Shake, the lens punch and a freeze are three views of the same event and
   * were three unrelated call sites, of which two did not exist. `a` is the
   * SAME 0..1 magnitude shake() already takes, so every existing shake(0.14)
   * in the game means exactly what it meant — this is the one that also gets
   * the other two channels, and callers move over to it as they are touched.
   *
   * The freeze is deliberately tiny and deliberately not linear in `a`: below
   * sysPUNCH_MIN there is no freeze at all, because a hitch on a medium event
   * is not emphasis, it is a dropped frame. Only the genuinely big ones stop
   * the world, and then only for a few dozen milliseconds.
   */
  function punch(a, freeze) {
    if (!(a > 0)) return;
    shake(a);
    const m = clamp(a / sysSHAKE_MAX, 0, 1);
    if (!sysCalmMotion) fovKickV += sysFOV_KICK_D * m * 12;
    // The fourth channel, and the only one the player feels in their hands.
    padRumble(a);
    if (freeze !== false && m > sysPUNCH_MIN && game.time) {
      game.time.hitstop(sysPUNCH_HOLD * (m - sysPUNCH_MIN) / (1 - sysPUNCH_MIN), sysPUNCH_SCALE);
    }
  }

  /** `where` is 'sydney' (default) or 'pasto' — whichever the player picked. */
  function startGame(where, restore) {
    if (started) return;
    // ---- put the file back, before a single frame is drawn ----------------
    // Silently: see completeTask's `silent` branch. The order matters — tasks
    // first so the tallies and the chapter gates are right, then the records
    // and the clock, then the biome, which startGame is about to switch to
    // anyway.
    if (restore && jrFile) {
      const t = jrFile.tasks || [];
      for (let i = 0; i < t.length; i++) completeTask(t[i], true);
      const sn = jrFile.seen || [];
      for (let i = 0; i < sn.length; i++) jrSeen[sn[i]] = 1;
      const rc = jrFile.recs || {};
      for (const k in rc) if (typeof rc[k] === 'number') jrRecs[k] = rc[k];
      jrCarriedMs = typeof jrFile.ms === 'number' ? jrFile.ms : 0;
      // Carrying on IS the proof that the file works, so the line about it has
      // been earned and must not be said again.
      saveTold = true;
      // a chapter already finished on the file must not throw its party again
      for (let n = 1; n <= chapMax; n++) if (chapComplete(n)) jrChapDone[n] = true;
    } else if (!restore) {
      // Starting fresh is a deliberate act and it is allowed to overwrite —
      // but only once the player has actually chosen a place, never on boot.
      saveClear();
    }
    started = true;
    game.state.started = true;
    startMs = performance.now();
    titleEl.classList.add('gone');
    todoEl.classList.add('show');

    // ---- LAND SOMEWHERE ---------------------------------------------------
    // Starting abroad is the departures board's own path minus the ceremony:
    // the same biomeGo(), taken before the first frame the player sees, behind
    // the title card's own 0.75 s fade. Done BEFORE musicStart so the score is
    // born in the right palette rather than drifting into it over six seconds.
    //
    // This was nine `const toPasto = ...` flags, nine `else if` rungs, nine
    // `if (atX) showPlace(...)` lines and a nine-armed conditional for the
    // opening toast — four parallel ladders that had to agree, in a function
    // that is run exactly once. It is one row of CHAPTERS now.
    const cdef = chapterDef(chapterOf(where));
    const landed = cdef.biome !== 'sydney' ? biomeGo(cdef.biome) : false;
    // The atmosphere blend is a ~1 s damp and there is nothing to cross-fade
    // FROM on frame one: land on the chapter's own light rather than open the
    // game with a second of a Sydney afternoon over a volcano.
    if (landed) atmosPrime(cdef.biome);

    // The paper follows the biome, so it is already showing the right chapter —
    // it only has to be drawn for the first time.
    todoRefresh();

    audioUnlock();
    // Music is born only from the real gesture that starts the game, and only once.
    if (ac) musicStart();

    if (landed) {
      // You did emigrate. Somehow.
      if (cdef.arrive) completeTask(cdef.arrive);
      showPlace(cdef.name.toUpperCase(), cdef.sub);
    }

    setTimeout(function () { if (titleEl.parentNode) titleEl.parentNode.removeChild(titleEl); }, 900);
    setTimeout(function () {
      toast((landed && cdef.open) || 'be a menace.');
    }, 700);
    honkPend = false; actionPend = false; whistlePend = false; jumpPend = false;
    input.honkPressed = false; input.actionPressed = false; input.whistlePressed = false;
    input.jumpPressed = false;
  }
  // Catch-all: anywhere on the card that is not a ticket. With a journey on
  // file this must CARRY ON, not start fresh — startGame's non-restore path
  // clears the save, and a stray click to focus the window must never cost a
  // sixty-task file. Starting fresh stays a deliberate act: a ticket, or 1-8.
  // ...AND ONLY FROM PAGE ONE. Page two is a CHOICE, and the backdrop around
  // a grid of sixteen places is exactly where a mis-aimed click at a tile
  // lands. Starting Sydney because somebody missed Reykjavik by four pixels
  // is the worst thing this card could do; on page two a stray click does
  // nothing at all, which is the correct amount.
  titleEl.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (titlePageN !== 1) return;
    if (jrFileCount > 0) startGame(jrFile.biome || 'sydney', true);
    else startGame('sydney');
  });

  // --- keyboard ---
  addEventListener('keydown', function (e) {
    audioUnlock();
    const c = e.code;
    if (c === 'Space' || c === 'ArrowUp' || c === 'ArrowDown' || c === 'ArrowLeft' || c === 'ArrowRight') e.preventDefault();
    if (!started) {
      // ENTER AND SPACE BELONG TO WHATEVER IS FOCUSED, IF ANYTHING IS.
      // The chapter buttons are real buttons, so the browser turns Enter and
      // Space on a focused one into a click — and the two reflex shortcuts
      // below would otherwise fire FIRST and start Sydney, which made tabbing
      // to a chapter and pressing Enter do the one thing it did not say.
      // Measured: Tab x9 to "The Drift", Enter, and the game opened in Sydney.
      const focus = document.activeElement;
      const onPick = !!(focus && focus.classList && focus.classList.contains('capyui-pick'));
      if (onPick && (c === 'Enter' || c === 'NumpadEnter' || c === 'Space')) return;
      // 1-9 pick a chapter and 0 is the tenth; everything past that comes off
      // sysPICK_EXTRA, because a keyboard has ten digits and this game has
      // thirteen places. The card says which; nothing here is guessable and
      // nothing here needs to be.
      const pick = sysPickFromKey(c);
      if (pick > 0) { startGame(CHAPTERS[pick - 1].biome); return; }
      // THE PAGE TURNS BOTH WAYS FROM THE KEYBOARD. Escape is the one key
      // every player already tries when a screen has gone somewhere they did
      // not mean, and it did nothing at all on this card until now.
      if (c === 'Escape') {
        if (titlePageN === 2) { e.preventDefault(); titlePage(1); }
        return;
      }
      if (titlePageN === 1 && (c === 'ArrowRight' || c === 'ArrowDown')) {
        e.preventDefault(); titlePage(2); return;
      }
      if (titlePageN === 2 && c === 'ArrowLeft' && !onPick) {
        e.preventDefault(); titlePage(1); return;
      }
      if (c === 'Enter' || c === 'NumpadEnter') {
        if (jrFileCount > 0) startGame(jrFile.biome || 'sydney', true);
        else startGame('sydney');
        return;
      }
      if (c === 'Space') {
        // Space is a reflex key, not a choice: with a journey on file it must
        // carry on like Enter, never silently wipe the save for fresh Sydney.
        // On page two it turns back instead, because a reflex key that starts
        // a chapter you did not point at is the same bug as the backdrop one.
        if (titlePageN === 2) { titlePage(1); return; }
        if (jrFileCount > 0) startGame(jrFile.biome || 'sydney', true);
        else startGame('sydney');
        return;
      }
    }
    // TAB OPENS IT AND THEN GETS OUT OF THE WAY.
    // Tab was the toggle in both directions, which meant that once the board was
    // open the one key a keyboard player needs to move between the destinations
    // closed it instead. It now opens the card and is then handed straight back
    // to the browser; Escape (or J) closes.
    if (started && c === 'KeyJ') { e.preventDefault(); jrToggle(); return; }
    if (started && c === 'Tab' && !jrShown) { e.preventDefault(); jrShow(false); return; }
    // H (and ?, which is Shift+/ and therefore still 'Slash') is the key every
    // player tries first when they cannot remember a control. It opens the same
    // card Tab does, with the fold already open.
    if (started && (c === 'KeyH' || c === 'Slash') && !jrShown) {
      e.preventDefault();
      jrKeys.open = true;
      jrShow(false);
      return;
    }
    if (jrShown && c === 'Escape') { jrHide(); return; }
    // ESCAPE IS THE PAUSE KEY IN EVERY GAME EVER MADE, and here it did nothing
    // at all unless the board was already open — so the one key a player reaches
    // for when the doorbell goes left the capybara stood in traffic. It opens
    // the same card, which already pauses, and Escape then closes it again.
    if (started && c === 'Escape') { e.preventDefault(); jrShow(false); return; }
    // THE BOARD RUNS OUT OF DIGITS AT NINE AND THE GAME DOES NOT.
    // This was `c >= 'Digit1' && c <= 'Digit9'`, which is exactly the rung the
    // title card's picker already had to fix: a keyboard has ten digits and
    // this game has thirteen places, so Venice, Hong Kong, Palawan and
    // Cappadocia could not be travelled to by keyboard at all — while the
    // board's own footer said "pick a place, or press its number". The board is
    // the ONLY way out of a chapter, so that was the last place in the game
    // that could afford to lie about it. One table, shared with the picker.
    if (jrShown) {
      const n = sysPickFromKey(c);
      if (n > 0) { jrTravel(n); return; }
    }
    if (ended && (c === 'Enter' || c === 'NumpadEnter')) { location.reload(); return; }
    if (e.repeat) return;
    if (keys[c]) return;
    keys[c] = true;
    // Edge flags are latched at the event source: systems runs LAST in the frame
    // order, so latching them in update() would cost readers a whole extra frame.
    // The HELD flags must be latched here too, not only in update(). Readers such as
    // capybara.js run BEFORE systems, so on the press frame they would otherwise see
    // actionPressed === true while action was still false — which cancelled the grab
    // wind-up on the very frame it started and made pickups impossible.
    // ONE VOICE, NOT TWO. The wheek and the whistle were two keys for the same
    // act — a capybara opening its mouth — and that split was the most confusing
    // thing in the scheme. They are now one button and the CONTEXT decides what
    // the noise means: it startles whoever is nearby, it brings the condor down
    // if one is up there, and three of them at a departure point is the ticket
    // out. whistle* stays as an alias so every reader keeps working unchanged.
    // Q, because it is the one key the left hand reaches without leaving WASD.
    if (c === 'KeyQ' && started) {
      honkPend = true; input.honkPressed = true; input.honk = true;
      whistlePend = true; input.whistlePressed = true; input.whistle = true;
    }
    // GRAB on E: the interact key in every third-person game of the last twenty
    // years, and the capybara's grab is exactly that verb.
    if (c === 'KeyE' && started) { actionPend = true; input.actionPressed = true; input.action = true; }
    // HOP on Space — the universal jump key, and the thumb never has to leave it.
    // Same latch-at-source rule: the capybara runs BEFORE systems and must see
    // the press on its own frame.
    if (c === 'Space' && started) {
      jumpPend = true; input.jumpPressed = true; input.jump = true;
    }
    // Snap the rig behind the capybara, right now. The only loop-free way to get
    // "put the camera behind me" WHILE moving (see the idle tidy-up in update),
    // and the one thing a player reaches for most often.
    if (c === 'KeyC' && started) {
      const cg = game.capy && game.capy.group;
      if (cg) { camYawTarget = cg.rotation.y; camHandT = 0; camIdleT = 0; }
    }
    // Move the arrow to the next thing you have not done. See todoStep.
    if (c === 'KeyF' && started) todoStep(e.shiftKey ? -1 : 1);
    if (c === 'ShiftLeft' || c === 'ShiftRight') input.run = true;
    if (c === 'KeyM') setMuted(!muted);
    if (c === 'KeyN') setMusicMuted(!musMuted);
    if (c === 'BracketLeft') setMusicVolume(musLevel - 0.2);
    if (c === 'BracketRight') setMusicVolume(musLevel + 0.2);
    if (c === 'Backquote') { perfOn = !perfOn; perfEl.classList.toggle('show', perfOn); }
    // ---- TAKE THE PAPER OFF THE WINDOW --------------------------------------
    // Thirteen places built to be looked at, and there has never been a way to
    // look at one of them: a checklist, a map, a stamina bar and a hint sit over
    // the top of every frame this game has ever drawn. P puts them away — for a
    // dawn over Cappadocia, for a screenshot, or simply because the list is not
    // what the player came for right now. It hides ONLY the furniture: a place
    // card, a moment card and the white of a crossing are the game speaking and
    // still get through, so nothing can be missed by having it on.
    if (c === 'KeyP' && started) {
      hudBare = !hudBare;
      hudRoot.classList.toggle('bare', hudBare);
      if (hudBare) toast('P again for the paper');
    }
    // QA hotkey: hard-cut between biomes, no fade, no ceremony, no task ticks.
    if (c === 'Backslash' && !transBusy) {
      const to = (game.biome && game.biome.isActive('pasto')) ? 'sydney' : 'pasto';
      if (biomeGo(to)) toast(to);
    }
  });
  addEventListener('keyup', function (e) { keys[e.code] = false; });
  addEventListener('blur', function () {
    for (const k in keys) keys[k] = false;
    mouseAction = false; dragId = -1;
  });

  // --- mouse / pointer on the canvas ---
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('pointerdown', function (e) {
    audioUnlock();
    if (!started) { startGame(); return; }
    if (e.pointerType === 'mouse') {
      if (e.button === 0) { mouseAction = true; actionPend = true; input.actionPressed = true; input.action = true; }
      else if (e.button === 2) { dragId = e.pointerId; try { canvas.setPointerCapture(e.pointerId); } catch (err) {} }
    } else {
      dragId = e.pointerId;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  canvas.addEventListener('pointermove', function (e) {
    if (e.pointerId !== dragId) return;
    const dx = e.movementX !== undefined ? e.movementX : 0;
    if (dx) { camYawTarget -= dx * 0.005; camHandT = sysCAM_HAND_T; }
  });
  function endPointer(e) {
    if (e.pointerType === 'mouse' && e.button === 0) mouseAction = false;
    if (e.pointerId === dragId) dragId = -1;
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);
  addEventListener('pointerup', function (e) { if (e.pointerType === 'mouse' && e.button === 0) mouseAction = false; });
  canvas.addEventListener('wheel', function (e) {
    e.preventDefault();
    camDistTarget = clamp(camDistTarget + e.deltaY * 0.012, sysCAM_MIN, sysCAM_MAX);
  }, { passive: false });

  // --- touch layer ---
  const touchLayer = sysEl('div', 'capyui-touch');
  const zoneEl = sysEl('div', 'capyui-zone');
  const baseEl = sysEl('div', 'capyui-base');
  const knobEl = sysEl('div', 'capyui-knob');
  baseEl.appendChild(knobEl);
  zoneEl.appendChild(baseEl);
  touchLayer.appendChild(zoneEl);
  const wheekBtn = sysEl('div', 'capyui-btn capyui-wheek', 'WHEEK');
  const grabBtn = sysEl('div', 'capyui-btn capyui-grab', 'GRAB');
  const hopBtn = sysEl('div', 'capyui-btn capyui-hop', 'HOP');
  touchLayer.appendChild(wheekBtn);
  touchLayer.appendChild(grabBtn);
  touchLayer.appendChild(hopBtn);
  hudRoot.appendChild(touchLayer);

  // Touchscreen laptops driven by mouse+keyboard must NOT get the stick zone —
  // it would swallow canvas pointer events over the bottom-left of the viewport.
  const isTouch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  if (isTouch) touchLayer.classList.add('on');
  addEventListener('keydown', function () { touchLayer.classList.remove('on'); }, { once: true });
  // pointermove filtered to a real mouse: touch taps synthesize compatibility
  // mousemove events, which would otherwise tear the pad off a phone on tap one.
  function sysSawMouse(e) {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    touchLayer.classList.remove('on');
    removeEventListener('pointermove', sysSawMouse);
  }
  addEventListener('pointermove', sysSawMouse);

  const STICK_R = 52;
  let stickId = -1, stickOx = 0, stickOy = 0;
  zoneEl.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    audioUnlock();
    if (!started) { startGame(); return; }
    stickId = e.pointerId;
    const r = zoneEl.getBoundingClientRect();
    stickOx = e.clientX - r.left; stickOy = e.clientY - r.top;
    baseEl.style.left = stickOx + 'px';
    baseEl.style.top = stickOy + 'px';
    baseEl.classList.add('on');
    stickActive = true;
    knobEl.style.transform = 'translate(0px,0px)';
    try { zoneEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  zoneEl.addEventListener('pointermove', function (e) {
    if (e.pointerId !== stickId) return;
    const r = zoneEl.getBoundingClientRect();
    let dx = (e.clientX - r.left) - stickOx;
    let dy = (e.clientY - r.top) - stickOy;
    const d = Math.hypot(dx, dy);
    if (d > STICK_R) { dx = dx / d * STICK_R; dy = dy / d * STICK_R; }
    knobEl.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    stickX = clamp(dx / STICK_R, -1, 1);
    stickZ = clamp(dy / STICK_R, -1, 1);
  });
  function stickEnd(e) {
    if (e.pointerId !== stickId) return;
    stickId = -1; stickActive = false; stickX = 0; stickZ = 0;
    baseEl.classList.remove('on');
    knobEl.style.transform = 'translate(0px,0px)';
  }
  zoneEl.addEventListener('pointerup', stickEnd);
  zoneEl.addEventListener('pointercancel', stickEnd);

  function bindBtn(el, down, up) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      audioUnlock();
      if (!started) { startGame(); return; }
      el.classList.add('press');
      down();
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    const off = function () { el.classList.remove('press'); up(); };
    el.addEventListener('pointerup', off);
    el.addEventListener('pointercancel', off);
    el.addEventListener('pointerleave', off);
  }
  bindBtn(wheekBtn, function () {
    touchHonk = true; touchHonkPend = true; input.honkPressed = true; input.honk = true;
    touchWhistlePend = true; input.whistlePressed = true; input.whistle = true;
  }, function () { touchHonk = false; });
  bindBtn(grabBtn, function () {
    touchAction = true; touchActionPend = true; input.actionPressed = true; input.action = true;
  }, function () { touchAction = false; });
  bindBtn(hopBtn, function () {
    touchJump = true; touchJumpPend = true; input.jumpPressed = true; input.jump = true;
  }, function () { touchJump = false; });

  // ---- THE PAD, POLLED ----------------------------------------------------
  // See the sysPAD_* block. Called once at the top of update(). Writes the held
  // state directly and QUEUES the three edges; publishing them is the last
  // thing update() does.
  addEventListener('gamepadconnected', function (e) {
    padIdx = e.gamepad ? e.gamepad.index : 0;
    // A pad is a pointing device as much as the mouse is: the moment one is in
    // use the thumb-stick overlay is in the way rather than in the game.
    touchLayer.classList.remove('on');
    audioUnlock();
    // The one moment the scheme is actually wanted. The journal's fold has it
    // too, but a player who has just picked a pad up is not going to go and
    // open a card to find out which button wheeks.
    toast('pad:  A hop  ·  X grab  ·  B WHEEK');
  });
  addEventListener('gamepaddisconnected', function () { padIdx = -1; padOn = false; });

  /** Radial deadzone, rescaled so the first millimetre of travel is not a jump. */
  function padAxis2(ax, ay, dead, out) {
    const m = Math.hypot(ax, ay);
    if (m <= dead) { out.x = 0; out.y = 0; return 0; }
    const s = (m - dead) / (1 - dead) / m;
    out.x = ax * s; out.y = ay * s;
    return (m - dead) / (1 - dead);
  }
  const padL = { x: 0, y: 0 }, padR = { x: 0, y: 0 };
  function padBtn(g, i) {
    const b = g.buttons[i];
    if (!b) return false;
    // Analogue triggers report `value`; everything else reports `pressed`.
    return typeof b === 'object' ? (b.pressed || b.value > sysPAD_TRIG) : b > sysPAD_TRIG;
  }

  function padPoll(dt) {
    let pads = null;
    try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (e) { pads = null; }
    let g = null;
    if (pads) {
      if (padIdx >= 0 && pads[padIdx] && pads[padIdx].connected) g = pads[padIdx];
      else for (let i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { g = pads[i]; padIdx = i; break; }
    }
    if (!g || !g.axes || !g.buttons) {
      padOn = false; padX = 0; padZ = 0; padRun = false;
      padHonk = padAction = padJump = false;
      padWasHonk = padWasAction = padWasJump = false;
      return;
    }
    padOn = true;
    const a = g.axes;

    // ---- move: left stick, and the d-pad, which must work identically -----
    const mag = padAxis2(a[0] || 0, a[1] || 0, sysPAD_DEAD, padL);
    padX = padL.x; padZ = padL.y;
    if (padBtn(g, 14)) padX -= 1;                 // d-pad left
    if (padBtn(g, 15)) padX += 1;                 // d-pad right
    if (padBtn(g, 12)) padZ -= 1;                 // d-pad up
    if (padBtn(g, 13)) padZ += 1;                 // d-pad down
    const pm = Math.hypot(padX, padZ);
    if (pm > 1) { padX /= pm; padZ /= pm; }

    // ---- run: the right trigger, the left stick click, or simply leaning ---
    // on it. Three ways, because a sprint that only one of them reaches is a
    // sprint half the people holding a pad never find.
    padRun = padBtn(g, 7) || padBtn(g, 10) || mag > sysPAD_RUN;

    // ---- the verbs --------------------------------------------------------
    // ONE VOICE is on two buttons and grab is on two: B and Y both wheek, X and
    // the left trigger both grab. Nothing else is competing for them and a
    // player who guesses wrong should still get the thing they meant.
    const wantJump   = padBtn(g, 0);
    const wantHonk   = padBtn(g, 1) || padBtn(g, 3);
    const wantAction = padBtn(g, 2) || padBtn(g, 6);
    if (started) {
      if (wantJump   && !padWasJump)   padEdgeJump = true;
      if (wantHonk   && !padWasHonk)   padEdgeHonk = true;
      if (wantAction && !padWasAction) padEdgeAction = true;
    }
    padWasJump = wantJump; padWasHonk = wantHonk; padWasAction = wantAction;
    padJump = started && wantJump;
    padHonk = started && wantHonk;
    padAction = started && wantAction;

    // ---- the camera, which is the real reason to hold one of these --------
    // Z and X are a 2.4 rad/s ramp with no middle. A stick has a middle.
    padAxis2(a[2] || 0, a[3] || 0, sysPAD_LOOKD, padR);
    if (padR.x || padR.y) {
      if (padR.x) { camYawTarget -= padR.x * sysPAD_YAW * dt; camHandT = sysCAM_HAND_T; }
      if (padR.y) camDistTarget = clamp(camDistTarget + padR.y * sysPAD_ZOOM * dt, sysCAM_MIN, sysCAM_MAX);
    }
    // The shoulders nudge the rig too — the same job the keyboard's Z and X do.
    if (padBtn(g, 4)) { camYawTarget += dt * sysCAM_KEY_RATE; camHandT = sysCAM_HAND_T; }
    if (padBtn(g, 5)) { camYawTarget -= dt * sysCAM_KEY_RATE; camHandT = sysCAM_HAND_T; }
    // Right stick click: put the rig behind me, exactly as C does.
    const snap = padBtn(g, 11);
    if (snap && !padWasSnap && started) {
      const cg = game.capy && game.capy.group;
      if (cg) { camYawTarget = cg.rotation.y; camHandT = 0; camIdleT = 0; }
    }
    padWasSnap = snap;

    // ---- and the two cards ------------------------------------------------
    const start = padBtn(g, 9), back = padBtn(g, 8);
    if (start && !padWasStart) {
      if (!started) { if (jrFileCount > 0) startGame(jrFile.biome || 'sydney', true); else startGame('sydney'); }
      else jrToggle();
    }
    if (back && !padWasBack && started) {
      hudBare = !hudBare;
      hudRoot.classList.toggle('bare', hudBare);
    }
    padWasStart = start; padWasBack = back;

    if (!padSeen && padOn) { padSeen = true; touchLayer.classList.remove('on'); }
  }

  /**
   * THE PAD FEELS THE PUNCH. Same 0..1 magnitude everything else takes, and
   * gated well above the floor for the same reason the freeze is: a pad that
   * buzzes on every prop impact in a market is a pad the player puts down.
   * Guarded end to end — vibrationActuator is absent on Safari, present and
   * throwing on some Linux builds, and unavailable in an insecure context.
   */
  function padRumble(a) {
    if (!padOn || padIdx < 0 || a < sysPAD_RUM_MIN) return;
    if (padRumbleT > 0) return;                    // never queue them up
    padRumbleT = 0.22;
    try {
      const pads = navigator.getGamepads ? navigator.getGamepads() : null;
      const g = pads && pads[padIdx];
      const act = g && (g.vibrationActuator || (g.hapticActuators && g.hapticActuators[0]));
      if (!act || !act.playEffect) return;
      const m = clamp(a / sysSHAKE_MAX, 0, 1);
      const p = act.playEffect('dual-rumble', {
        duration: Math.round(sysPAD_RUMBLE * 1000 * (0.5 + m * 0.5)),
        strongMagnitude: m * 0.75,
        weakMagnitude: 0.15 + m * 0.5,
      });
      if (p && p.catch) p.catch(function () {});
    } catch (e) { /* no actuator on this pad, or this browser */ }
  }

  // =========================================================================
  // 5c. BIOME TRANSITION
  // =========================================================================
  let bioT = 0, bioTarget = 0;    // 0 = Sydney, 1 = Pasto; damped over ~1 s
  let seaT = 0;                   // 0 = ashore, 1 = the open harbour
  let kyoT = 0;                   // 0 = anywhere else, 1 = the Kyoto valley
  let caliT = 0;                  // 0 = anywhere else, 1 = the Cauca valley
  let rioT = 0;                   // 0 = anywhere else, 1 = Guanabara sea air
  let iceT = 0;                   // 0 = anywhere else, 1 = an Icelandic night
  let sahT = 0;                   // 0 = anywhere else, 1 = the medina at noon
  let driT = 0;                   // 0 = anywhere else, 1 = a violet night with no floor
  let venT = 0;                   // 0 = anywhere else, 1 = a wet gold afternoon on the lagoon
  let hkT = 0;                    // 0 = anywhere else, 1 = a city that lights itself
  let palT = 0;                   // 0 = anywhere else, 1 = a bleached tropical noon
  let subT = 0;                   // 0 = above the water, 1 = under it. THE SECOND SKY.
  let gorT = 0;                   // 0 = anywhere else, 1 = twenty minutes before sunrise

  /**
   * OPEN ON THE RIGHT LIGHT.
   *
   * Every one of these is damped over about a second in update(), which is
   * correct for walking onto a ferry and wrong for the very first frame of a
   * session: with nothing to cross-fade from, the game opens with a second of
   * Sydney's afternoon spread over a volcano, a glacier or a night market.
   * startGame() slams the right one to 1 before anything is drawn.
   */

  /**
   * THE DOME, THE FILL AND THE LENS — one function, run last in the atmosphere
   * section, and it invents nothing.
   *
   * The horizon colour of the sky is `scene.background`, exactly as the frame
   * left it. The fill light's colour and level are the hemisphere's, exactly as
   * the frame left them. Every event that already moves the atmosphere — the
   * aurora, the tide, the storm, the Symphony of Lights, the sun clearing the
   * ridge over Goreme, going under the water in Palawan — therefore moves the
   * sky and the fill with it and nobody has to remember a second table.
   *
   * Only two things here are their own numbers: the ZENITH of the dome (a haze
   * colour is not a sky colour, and the difference between them is what makes a
   * sky read as depth rather than as a wall) and the GRADE, which is the one
   * place a chapter gets to say how it wants to be LOOKED at.
   */
  function sysDressFrame(dt) {
    // ONE float, and every water surface in the game moves. See grain() in
    // shared.js: the sparkle uniform object is shared by every grained
    // material, so this is the entire per-frame cost of glitter on eight seas.
    // FROZEN UNDER prefers-reduced-motion, like the minimap already is. The
    // sparkle is a decorative loop that never stops and never asks; the specks
    // stay where they are and the water still reads as water.
    grainTick(sysCalmMotion ? 12.5 : game.state.time);
    const B = game.biome;
    const name = (B && B.current) || 'sydney';

    // ---- the fill ---------------------------------------------------------
    // atmosApply already set this once from the base hemisphere; it is set
    // again here because half the chapters move the hemisphere AFTER that, and
    // a fill that is a frame behind the sky it is standing in is a fill that
    // goes green a second late over a glacier.
    fill.color.copy(hemi.color);
    fill.intensity = Math.max(0, hemi.intensity) * sysFILL_K;

    // ---- the dome ---------------------------------------------------------
    if (sysSkyMesh && sysSkyMesh.visible) {
      // it rides the lens, so it is a background and not a piece of the world
      sysSkyMesh.position.copy(camera.position);

      const kk = 1 - Math.exp(-sysSKY_LAMBDA2 * dt);
      sysSkyTopC.lerp(sysSkyTopWant, kk);
      sysColA.copy(sysSkyTopC);

      // The two chapters whose sky changes DURING them rather than between
      // them. Both are read from the live biome, never from a resident one.
      if (caliT > 0.002 && B.isActive('cali') && game.cali && game.cali.night) {
        sysColA.lerp(sysCALI_N_BG_C, clamp(game.cali.night(), 0, 1) * caliT * 0.95);
      }
      if (sahT > 0.002) sysColA.lerp(sysSAH_NIGHT_C, duskT * sahT * 0.92);
      // THREE, NOW. The Pantanal's sundown is a state the chapter enters and
      // does not leave, exactly like Marrakech's, and until this line the only
      // sky in the game that changed during its own chapter and was not drawn
      // doing it was this one.
      if (sysAirT.pantanal > 0.002 && B.isActive('pantanal') && game.pantanal && game.pantanal.dusk) {
        sysColA.lerp(sysPAN_DUSK_C, clamp(game.pantanal.dusk(), 0, 1) * sysAirT.pantanal * 0.80);
      }
      // and the one whose sky becomes a light
      if (iceT > 0.002 && auroraT > 0.01) sysColA.lerp(sysAURORA_C, auroraT * iceT * 0.30);

      // FLATTEN — the states in which there is no gradient to draw, because
      // there is no sky: under the water in Palawan, and inside the sand.
      let flat = 0;
      if (palT > 0.002) flat = Math.max(flat, subT * palT);
      if (sahT > 0.002) flat = Math.max(flat, stormT * sahT * 0.88);

      const hz = (scene.background && scene.background.isColor) ? scene.background : sysColA;
      if (flat > 0.002) sysColA.lerp(hz, flat);

      // Repaint only on a visible change. The atmosphere damps, so during a
      // transition this runs every frame and once it has settled it runs never.
      const d1 = Math.abs(hz.r - sysSkyLastA.r) + Math.abs(hz.g - sysSkyLastA.g) + Math.abs(hz.b - sysSkyLastA.b);
      const d2 = Math.abs(sysColA.r - sysSkyLastB.r) + Math.abs(sysColA.g - sysSkyLastB.g) + Math.abs(sysColA.b - sysSkyLastB.b);
      if (d1 + d2 > 0.0025) sysSkyPaint(hz, sysColA);
    }

    // ---- the grade --------------------------------------------------------
    const post = game.post;
    if (!post || !post.enabled) return;

    const w = sysGradeWant, cur = sysGradeCur;
    const k = 1 - Math.exp(-sysGRADE_LAMBDA * dt);
    for (let i = 0; i < sysGRADE_KEYS.length; i++) {
      const key = sysGRADE_KEYS[i];
      cur[key] += (w[key] - cur[key]) * k;
    }

    // The event layer, applied on top of the damped chapter grade rather than
    // baked into it — the same shape as the lighting blocks above, and for the
    // same reason: an event is a thing that happens to a chapter, not a
    // different chapter.
    let bloom = cur.bloom, thr = cur.threshold, rad = cur.radius;
    let sat = cur.saturation, vig = cur.vignette;

    if (iceT > 0.002 && auroraT > 0.01) bloom += auroraT * iceT * 0.30;
    if (hkT > 0.002 && B.isActive('kowloon') && game.kowloon) {
      const show = clamp(game.kowloon.show(), 0, 1) * hkT;
      bloom += show * 0.30; rad += show * 0.30;
    }
    if (driT > 0.002 && B.isActive('drift') && game.drift) {
      const glow = clamp(game.drift.glow(), 0, 1) * driT;
      bloom += glow * 0.22; thr -= glow * 0.06;
    }
    if (palT > 0.002) {
      if (B.isActive('palawan') && game.palawan) {
        bloom += clamp(game.palawan.bloom(), 0, 1) * palT * 0.35;
      }
      // Under the water the light is coming through eleven metres of it: less
      // of it, less colour in it, and the corners close right down.
      const sk = subT * palT;
      vig += sk * 0.18; sat -= sk * 0.10; thr -= sk * 0.34;
    }
    if (gorT > 0.002 && B.isActive('goreme') && game.goreme) {
      // Before the ridge lets go, every bulb in the town is a light. After it,
      // the sun is, and a threshold that still thought a bulb was worth
      // blooming would smear the whole valley.
      const up = clamp(game.goreme.sunUp(), 0, 1) * gorT;
      thr += up * 0.48; bloom -= up * 0.24;
    }
    if (caliT > 0.002 && B.isActive('cali') && game.cali && game.cali.night) {
      const nite = clamp(game.cali.night(), 0, 1) * caliT;
      thr -= nite * 0.52; bloom += nite * 0.34; vig += nite * 0.10;
    }
    if (sahT > 0.002) {
      thr -= duskT * sahT * 0.50; bloom += duskT * sahT * 0.26;
      sat -= stormT * sahT * 0.22; vig += stormT * sahT * 0.16;
    }
    if (venT > 0.002 && B.isActive('venice') && game.venice) {
      // a flooded piazza is a mirror, and a mirror is a light
      bloom += clamp(game.venice.tide(), 0, 1) * venT * 0.12;
    }
    // The wave of the set, standing up on the bank. It is the one moment in
    // that chapter with more white in the frame than anything else, and the
    // grade is allowed to notice.
    if (sysAirT.manly > 0.002 && B.isActive('manly') && game.manly) {
      const s = clamp(game.manly.setNear(), 0, 1) * sysAirT.manly;
      bloom += s * 0.16; rad += s * 0.20;
    }
    // And the two lights in a place with none. An echo blooms because it is a
    // light going off; the shaft raises the THRESHOLD instead, because under
    // it there is real daylight and a threshold tuned for a glow-worm would
    // smear the whole doline into one white sheet — the Cappadocia rule.
    if (sysAirT.cave > 0.002 && B.isActive('cave') && game.cave) {
      const e = clamp(game.cave.echo ? game.cave.echo() : 0, 0, 1) * sysAirT.cave;
      const day = clamp(game.cave.daylight ? game.cave.daylight() : 0, 0, 1) * sysAirT.cave;
      bloom += e * 0.28;
      thr += day * 0.62; vig -= day * 0.26; bloom -= day * 0.30;
    }
    // The Pantanal's sundown. A hundred thousand square kilometres of standing
    // water with a low sun on it is the highest-contrast thing in this game
    // and the only one where a LOW threshold is right: every wet patch on the
    // campo becomes a light, which is the whole picture of the place.
    if (sysAirT.pantanal > 0.002 && B.isActive('pantanal') && game.pantanal && game.pantanal.dusk) {
      const dk = clamp(game.pantanal.dusk(), 0, 1) * sysAirT.pantanal;
      thr -= dk * 0.40; bloom += dk * 0.28; vig += dk * 0.10; sat += dk * 0.06;
    }
    // And the pack, which is the other extreme: an overcast day over sea ice
    // is the flattest light on earth and the grade should not pretend it is
    // not. More of it in the frame, less contrast, and the corners open.
    if (sysAirT.antarctic > 0.002 && B.isActive('antarctic') && game.antarctic) {
      const pk = clamp(game.antarctic.pack(), 0, 1) * sysAirT.antarctic;
      bloom += pk * 0.12; thr += pk * 0.16; vig -= pk * 0.06;
    }

    // ---- AND THE WET STREET, WHICH IS A GRADE AND NOT A LIGHT --------------
    //
    // The one thing in the micro-environment that belongs HERE rather than in
    // the lighting section, because a wet road is not a brighter road — it is
    // the same road with a mirror on it. What actually changes when it rains
    // on Nathan Road is that every sign in Mong Kok acquires a second copy of
    // itself lying on the ground, and the lens is the only part of this engine
    // that can express that: more bloom, a threshold low enough for a
    // reflection (which is always dimmer than the thing it reflects) to clear
    // it, and a little more colour and contrast, which is what a specular
    // sheet does to everything underneath it.
    //
    // It reads `shine()` and NOT `wetness()`. Venice's paving and Son Doong's
    // floor are wet at their baseline and both chapters were graded that way
    // on purpose; keying off the absolute would re-grade two finished chapters
    // the moment this module was switched on. Only the water that was not
    // there before is allowed to change the picture.
    let cont = cur.contrast;
    if (game.weather) {
      const wl = game.weather.light();
      if (wl.bloom > 0.001) {
        bloom += wl.bloom; thr += wl.threshold;
        sat += wl.saturation; cont += wl.contrast;
      }
    }

    const pp = post.params;
    pp.bloom = bloom < 0 ? 0 : bloom;
    pp.threshold = thr < 0.02 ? 0.02 : thr;
    pp.knee = cur.knee;
    pp.radius = rad;
    pp.contrast = cont;
    pp.saturation = sat;
    pp.vignette = vig;
    pp.vigStart = cur.vigStart;
    pp.tintR = cur.tintR; pp.tintG = cur.tintG; pp.tintB = cur.tintB;
    pp.liftR = cur.liftR; pp.liftG = cur.liftG; pp.liftB = cur.liftB;
  }

  /**
   * THE SKY AND THE LENS ARE BIOME STATE, so they are slammed on the first
   * frame for exactly the reason atmosPrime exists: with nothing to cross-fade
   * from, a damped grade opens a night chapter on a second of Sydney's
   * afternoon, and a damped dome opens it on a second of Sydney's blue.
   */
  function sysDressPrime(name) {
    sysGradeWant = sysGRADES[name] || sysGRADES.sydney;
    for (let i = 0; i < sysGRADE_KEYS.length; i++) {
      const key = sysGRADE_KEYS[i];
      sysGradeCur[key] = sysGradeWant[key];
    }
    sysSkyTopWant.set(sysSKY_TOP[name] || PALETTE.skyTop);
    sysSkyTopC.copy(sysSkyTopWant);
    if (sysSkyMesh) {
      sysSkyMesh.visible = !sysSKY_OWN[name];
      // force a repaint next frame whatever the deltas say
      sysSkyLastA.setRGB(-1, -1, -1);
      sysSkyLastB.setRGB(-1, -1, -1);
    }
  }

  function atmosPrime(name) {
    sysDressPrime(name);
    if (name === 'pasto') bioT = 1;
    else if (name === 'quay') seaT = 1;
    else if (name === 'kyoto') kyoT = 1;
    else if (name === 'cali') caliT = 1;
    else if (name === 'rio') rioT = 1;
    else if (name === 'iceland') iceT = 1;
    else if (name === 'sahara') sahT = 1;
    else if (name === 'drift') driT = 1;
    else if (name === 'venice') venT = 1;
    else if (name === 'kowloon') hkT = 1;
    else if (name === 'palawan') palT = 1;
    else if (name === 'goreme') gorT = 1;
    // ...and the table-driven ones, which need no rung of their own here and
    // will still be primed correctly when the twentieth chapter arrives.
    if (sysAirT[name] !== undefined) sysAirT[name] = 1;
  }
  let stormT = 0;                 // 0..1, mirrors game.sahara.storm()
  let duskT = 0;                  // 0..1, and it never comes back down
  let auroraT = 0;                // 0..1, mirrors game.iceland.aurora()
  let skyT = 0;                   // 0..1, how far the rig has craned up
  let dayT = 0;                   // 0..1 completion, heavily damped
  let transBusy = false;

  // Teleporting a cannon body means moving it in FOUR places: the authoritative
  // position, the previous-step position and the interpolated position (or the
  // renderer lerps from wherever it used to be and the capybara smears across the
  // whole map), plus every scrap of accumulated momentum.
  function teleportCapy(sp) {
    const capy = game.capy;
    const b = capy && capy.body;
    if (!b || !sp) return;
    b.position.set(sp.x, sp.y, sp.z);
    if (b.previousPosition) b.previousPosition.copy(b.position);
    if (b.interpolatedPosition) b.interpolatedPosition.copy(b.position);
    if (b.previousQuaternion) b.previousQuaternion.copy(b.quaternion);
    if (b.interpolatedQuaternion) b.interpolatedQuaternion.copy(b.quaternion);
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    if (b.force) b.force.set(0, 0, 0);
    if (b.torque) b.torque.set(0, 0, 0);
    if (b.wakeUp) b.wakeUp();
    if (capy.position) capy.position.set(sp.x, sp.y, sp.z);
    if (capy.velocity) capy.velocity.set(0, 0, 0);
    if (capy.group) capy.group.position.set(sp.x, sp.y, sp.z);

    // The camera rig would otherwise spring across the world for two seconds.
    sysAnchor.set(sp.x, sp.y + 1.0, sp.z);
    sysLook.set(sp.x, sp.y + sysLOOK_RAISE, sp.z);
    const cpp = Math.cos(sysCAM_PITCH), snn = Math.sin(sysCAM_PITCH);
    sysCamPos.set(sysAnchor.x + Math.sin(camYaw) * cpp * camDist,
                  Math.max(sysAnchor.y + snn * camDist, sysCAM_FLOOR),
                  sysAnchor.z + Math.cos(camYaw) * cpp * camDist);
    camera.position.copy(sysCamPos);
    camDolly = 0;
    shakeAmt = 0;
    sunFollow(sp.x, sp.y, sp.z);
  }

  /**
   * A BREADCRUMB, AND WHY IT IS NOT SIMPLY "WHERE I WAS A MOMENT AGO".
   *
   * The obvious implementation — remember the last grounded position — is worth
   * nothing in the case it exists for. A capybara wedged in a gap IS grounded,
   * and it is grounded THERE, so the rescue puts it straight back into the gap
   * it is trying to leave. The evidence that a place is escapable is that the
   * animal was MOVING through it, so a crumb is only dropped above
   * sysBACK_SPEED — and the rescue takes the OLDEST of three, four seconds of
   * walking back up the road rather than one step.
   *
   * Nothing is stored while swimming, diving, climbing, carried or at a wheel:
   * every one of those is a state whose height or heading is solved by
   * something else, and a crumb from inside one is a crumb inside a wall.
   */
  function backCrumb(dt) {
    const capy = game.capy;
    if (!capy || !capy.position || !capy.body) return;
    backT += dt;
    if (backT < sysBACK_EVERY) return;
    backT = 0;
    if (!capy.grounded || capy.climbing || capy.diving || capy.carriedBy || capy.atHelm) return;
    if (capy.depth > 0.2) return;
    const v = capy.body.velocity;
    if (Math.hypot(v.x, v.z) < sysBACK_SPEED) return;
    if (game.condor && game.condor.mounted) return;
    const p = capy.position;
    if (!(p.x === p.x && p.y === p.y && p.z === p.z)) return;
    backRing.push({ x: p.x, y: p.y + 0.25, z: p.z });
    while (backRing.length > sysBACK_KEEP) backRing.shift();
  }

  /**
   * Put the animal back. The oldest crumb, or the chapter's own spawn if there
   * is no trail yet — which is exactly the case of somebody who has walked
   * three steps off the spawn and fallen into something.
   */
  function backRescue() {
    const capy = game.capy;
    if (!capy || !capy.body || transBusy) return false;
    if (game.condor && game.condor.mounted) return false;
    const to = backRing.length ? backRing[0]
             : (game.biome && game.biome.spawnOf ? game.biome.spawnOf(game.biome.current) : null);
    if (!to) return false;
    // Whatever had hold of the animal has to let go, or the frame after the
    // teleport drags it straight back: a held prop crossing the map is the same
    // soft-lock the departures board already has customs for.
    capy.carriedBy = null;
    backRing.length = 0;
    backT = 0;
    teleportCapy(to);
    // A blink rather than the travel fade: this is a stumble being tidied up,
    // not a journey, and 1.3 s of white would make it feel like one.
    fadeEl.classList.add('on');
    setTimeout(function () { fadeEl.classList.remove('on'); }, 120);
    sfx('pop', { volume: 0.5, pitch: 0.8 });
    toast('back you go');
    return true;
  }

  /** Hard cut: swap the world, land the capybara on its spawn. No fade. */
  function biomeGo(name) {
    const bio = game.biome;
    if (!bio || bio.isActive(name)) return false;
    // Anything in the mouth belongs to the biome being left behind: it is about to
    // be pulled out of the physics world and hidden, and the capybara would spend
    // the rest of the game miming a hat it no longer has.
    if (game.capy && game.capy.heldProp && game.physics && game.physics.release) {
      try { game.physics.release(null); } catch (e) {}
    }
    if (!bio.switchTo(name)) return false;
    teleportCapy(typeof bio.spawnOf === 'function' ? bio.spawnOf(name) : bio.SYDNEY_SPAWN);
    return true;
  }

  /** The ceremonial version: white out, swap inside the held white, fade back in. */
  function biomeFadeTo(name, title, sub, onArrive) {
    if (transBusy) return false;
    const bio = game.biome;
    if (!bio || bio.isActive(name)) return false;
    transBusy = true;
    fadeEl.classList.add('on');
    setTimeout(function () {
      biomeGo(name);
      if (title) showPlace(title, sub || '');
      setTimeout(function () {
        fadeEl.classList.remove('on');
        transBusy = false;
        if (onArrive) setTimeout(onArrive, 600);
      }, sysFADE_HOLD);
    }, sysFADE_OUT);
    return true;
  }

  // =========================================================================
  // 5d. PASTO QUERIES — every one of these has to survive pasto.js not having
  // published its half of the API yet, and none of them may allocate.
  // =========================================================================
  function pastoTerrainY(x, z) {
    const pa = game.pasto;
    if (pa && typeof pa.terrainHeight === 'function') {
      const h = pa.terrainHeight(x, z);
      // NaN would silently poison the camera and never come back.
      if (typeof h === 'number' && h === h) return h;
    }
    return 0;
  }
  /**
   * The ground under (x, z) in whichever biome is live, or 0 where the world is
   * flat and does not publish terrainHeight at all.
   *
   * This was an if-ladder with one rung per biome that has relief, which meant
   * a new chapter with hills in it silently got a flat world for the camera
   * clearance, the sun frustum and every task beacon until somebody noticed the
   * arrow pointing into a hillside. There is only one live biome; ask it.
   * Per-frame, so it stays a property lookup and a call.
   */
  function sysGroundY(x, z) {
    const api = sysLiveBiomeApi(game);
    if (!api || typeof api.terrainHeight !== 'function') return 0;
    const h = api.terrainHeight(x, z);
    // NaN would silently poison the camera and never come back.
    return (typeof h === 'number' && h === h) ? h : 0;
  }

  /**
   * DOES THE LIVE WORLD HAVE A FLOOR THAT MOVES?
   *
   * The camera's terrain clearance and the shadow box's altitude were both
   * gated on `inPasto || inKyoto || inCali || inRio` — the four chapters that
   * happened to have relief in them WHEN THOSE LINES WERE WRITTEN. Twelve more
   * arrived afterwards and not one of them added a rung, so:
   *
   *   - the eye was free to travel through the rock in Iceland, the Erg, the
   *     Drift, Kowloon, Palawan, Cappadocia, Manly, the Pantanal, Sơn Đoòng
   *     and Antarctica; and
   *   - `sunFollow` was handed y = 0 in all twelve, so the shadow box sat on
   *     the datum while the animal stood 8.4 m up a Cappadocian hill, 7.1 m up
   *     an Antarctic one or 62 m down a cave.
   *
   * There is nothing to enumerate: a world either answers terrainHeight or it
   * does not, and exactly one of the seventeen does not (Sydney, which is flat
   * at zero by contract and keeps the constant floor it was tuned with).
   */
  function sysHasRelief() {
    const api = sysLiveBiomeApi(game);
    return !!(api && typeof api.terrainHeight === 'function');
  }

  function thermalAt(x, y, z) {
    const pa = game.pasto;
    const list = pa && pa.thermals;
    if (!list || !list.length) return false;
    for (let i = 0; i < list.length; i++) {
      const th = list[i];
      if (!th) continue;
      const dx = x - th.x, dz = z - th.z;
      const r = th.radius || 0;
      if (dx * dx + dz * dz <= r * r && (th.top === undefined || y <= th.top)) return true;
    }
    return false;
  }

  /** Where the way home is offered. The crater once pasto.js has one; until then
   *  the spawn plaza, so the affordance is reachable while the biome is a stub. */
  function homeZone(x, z) {
    const pa = game.pasto;
    if (pa) {
      if (typeof pa.inZone === 'function') {
        let r = false;
        try { r = !!pa.inZone('crater', x, z); } catch (e) { r = false; }
        return r;
      }
      const cc = pa.craterCentre;
      if (cc) {
        const dx = x - cc.x, dz = z - cc.z;
        return dx * dx + dz * dz < sysHOME_R2;
      }
    }
    const sp = game.biome && game.biome.PASTO_SPAWN;
    if (!sp) return false;
    const dx = x - sp.x, dz = z - sp.z;
    return dx * dx + dz * dz < sysHOME_R2;
  }

  function homeSet(n) {
    homeCount = clamp(n, 0, 3);
    for (let i = 0; i < homeDots.length; i++) homeDots[i].classList.toggle('on', i < homeCount);
  }

  // ---- WHERE THE THIRD WHEEK USED TO GO -----------------------------------
  //
  // There were two functions here, goHome() and goOverseas(), and between them
  // they were the entire travel system: from abroad the exit went to Sydney,
  // and from Manly it went down a hard-coded ladder of whichever chapter you
  // had not finished. Both are gone, and the ladder that was inside
  // goOverseas() now lives in jrOpen() as a rule rather than as an if-chain.
  //
  // The reason is the seventh time you pay for it. Getting abroad cost: find
  // the ferry in Sydney, stow away, arrive at Circular Quay, find the wheel,
  // sail seven hundred metres to Manly, walk up the Corso, three wheeks. That
  // is a chapter the first time. With eight chapters it was going to be a
  // three-minute unskippable commute paid SEVEN times, and there is nothing in
  // it after the first — you have already had the joke, you have already
  // driven the boat, and the ferry is not going to surprise you again.
  //
  // The rule that made the geography legible is untouched: every place still
  // has exactly ONE way out of it, standing somewhere obvious, using a verb the
  // player already has. Three wheeks at that one place now opens the board (see
  // jrShow / jrTravel) instead of picking your destination for you.


  // =========================================================================
  // 6. PERF
  // =========================================================================
  let dprScale = 1, dprT = 0;
  function applyDPR() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, sysMaxDPR()) * dprScale);
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  applyDPR();
  addEventListener('resize', applyDPR);
  document.addEventListener('visibilitychange', function () {
    // The journal/departures board paused the game itself — coming back to the
    // tab must not unpause the world behind an open modal.
    game.state.paused = document.hidden || jrShown;
    if (document.hidden) {
      ambientSet(false);
      // Held keys can never produce a keyup while hidden — clear them or the
      // capybara sprints off on its own the moment the tab comes back.
      for (const k in keys) keys[k] = false;
      mouseAction = false; dragId = -1;
      if (ac && ac.suspend && ac.state === 'running') {
        const pz = ac.suspend(); if (pz && pz.catch) pz.catch(function () {});
      }
    } else {
      // Drain the wall-clock time that piled up while the tab was backgrounded
      // so the first live frame gets a normal dt instead of a multi-second jump.
      if (game.clock && game.clock.getDelta) game.clock.getDelta();
      if (started && ac && ac.state === 'suspended' && ac.resume) {
        const pr = ac.resume(); if (pr && pr.catch) pr.catch(function () {});
      }
    }
  });

  let fpsAcc = 0, fpsFrames = 0, fps = 60, perfAcc = 0;
  let ambTimer = rand(5, 12);

  // =========================================================================
  // wiring
  // =========================================================================
  game.completeTask = completeTask;
  /** A measured task hands its number here. See RECORDS in shared.js. */
  game.record = recordValue;
  game.toast = toast;
  game.shake = shake;
  // The three channels at once. Same 0..1 magnitude shake() takes, so a caller
  // moves over by changing four letters and nothing has to be re-tuned.
  game.punch = punch;
  game.sfx = sfx;
  game.registerShadowTarget = registerShadowTarget;
  // The modules that call registerShadowTarget ran before systems existed and hit
  // main.js's no-op stub, so sweep them retroactively.
  if (game.capy && game.capy.group) registerShadowTarget(game.capy.group);
  for (let i = 0; i < game.npcs.length; i++) {
    if (game.npcs[i] && game.npcs[i].group) registerShadowTarget(game.npcs[i].group);
  }
  // ---- the beat, for anything that has to move in time with the band -------
  // `phase` is 0 at the instant of a beat and rises to 1 just before the next
  // one; `off` is the signed distance to the NEAREST beat in beats, so a dance
  // step is judged on |off| and nothing has to know the tempo. Falls back to
  // silence-safe values when there is no audio context (muted, or the player
  // has not clicked yet), so gameplay never depends on sound being audible.
  game.music = {
    get playing() { return !!(ac && musBeatLen > 0 && ac.state === 'running'); },
    get beatLen() { return musBeatLen; },
    /** beats since the anchor, as a float. -1 when there is no pulse. */
    beats() {
      if (!ac || musBeatLen <= 0) return -1;
      return (ac.currentTime - musBarAnchor) / musBeatLen;
    },
    /** Signed offset to the nearest beat, in beats: 0 is dead on, ±0.5 is worst. */
    off() {
      const b = game.music.beats();
      if (b < 0) return 1;
      const f = b - Math.floor(b);
      return f > 0.5 ? f - 1 : f;
    },
    /** Which beat of the 4/4 bar we are in, 0..3. */
    beatInBar() {
      const b = game.music.beats();
      return b < 0 ? -1 : ((Math.floor(b) % 4) + 4) % 4;
    },
    /**
     * LIFT THE SCORE, 0..1. completeTask fires this for every `wow` task, so a
     * biome only needs to call it for the other half of a set piece: the part
     * with a BUILD in it, where the tick lands at the end and the moment itself
     * starts half a minute earlier. The aurora climbing, the far shore lighting
     * up — those want the score already opening as the thing begins.
     *
     * Idempotent-ish and safe to spam: it takes the max of the live envelope, so
     * calling it every frame holds the swell up rather than restarting it.
     */
    swell(k) { try { musSwell(k); } catch (e) {} },
  };

  // WHICH LANDMARKS THIS WORLD ACTUALLY DRAWS. Every mark past the first two
  // in every chapter is a lookup into the live biome's published api by NAME,
  // and a name that has been renamed or never existed does not warn, does not
  // throw and does not draw: the chart simply has one fewer thing on it than
  // its author believed. Sixteen tables of six to eight names each is exactly
  // the kind of list that goes quietly stale, so it is now one call to check.
  function mapMarkAudit() {
    const spec = mapSpec;
    if (!spec) return { biome: mapBakedFor, ok: [], missing: ['NO MAP AT ALL'] };
    const ok = [], missing = [];
    for (let i = 0; i < spec.marks.length; i++) {
      const m = spec.marks[i];
      (mapMarkPos(m) ? ok : missing).push(m.t + (m.get ? ' <' + m.get + '>' : ''));
    }
    return { biome: mapBakedFor, ok: ok, missing: missing };
  }

  game.hud = {
    mapMarkAudit: mapMarkAudit,
    /**
     * What the mix would do with a sound at this point: its gain multiplier and
     * its pan, -1..1. For the same reason mapMarkAudit exists — a law applied
     * to two hundred and ninety call sites is exactly the sort of thing that
     * goes quietly wrong and can never be heard going wrong.
     */
    audioProbe: function (x, y, z, near, far) {
      const g = audioPlace(x, y, z, near, far);
      return { gain: g, pan: g > 0 ? sysSfxPan : 0,
               ear: { x: sysEar.x, y: sysEar.y, z: sysEar.z } };
    },
    root: hudRoot,
    toast: toast,
    completeTask: completeTask,
    isTaskDone: function (id) { return !!(taskRec[id] && taskRec[id].done); },
    tasksDone: function () { return doneCount; },
    setMuted: setMuted,
    setMusicMuted: setMusicMuted,
    setMusicVolume: setMusicVolume,
    musicVolume: function () { return musMuted ? 0 : musLevel; },
  };

  game.events.on('task:complete', function (p) { if (p && p.id) completeTask(p.id); });
  game.events.on('hud:toast', function (p) { toast(p && p.text !== undefined ? p.text : p); });
  // A wheek is not an earthquake: the barest tap, below which shake() ignores it.
  game.events.on('capy:wheek', function () { shake(0.03); sfx('wheek'); });
  game.events.on('capy:grab', function (e) {
    const pr = e && e.prop;
    if (pr && pr.type === 'sandwich') completeTask('picnic-thief');
  });
  // The three payloads that already carry a position get it spatialised here
  // rather than in seventeen biomes: props.js and npc.js are core, so every
  // chapter inherits a bonk that comes from where the bin actually is.
  game.events.on('prop:impact', function (p) {
    // speed 0 is props.js signalling a spill, not a bonk — do not coerce it to 2.
    const s = (p && typeof p.speed === 'number') ? p.speed : 2;
    if (s < 1.5) return;
    // Only a genuinely hard bonk earns a shake — everything softer is sfx only.
    if (s >= sysSHAKE_HIT) punch(clamp((s - sysSHAKE_HIT) * 0.02, 0, 0.16));
    // WHAT IT IS MADE OF, ON TOP OF HOW HARD IT WAS HIT. props.js stamps a
    // voice, a pitch and a gain onto the payload from its material table; the
    // speed-derived figures below are unchanged, so a hard hit is still louder
    // and lower than a soft one — it is just now also a bowl rather than a
    // sandbag. A payload with no voice (anything emitting this by hand) reads
    // as 'thud' at unity, which is exactly what every impact was until now.
    const voice = (p && p.voice) || 'thud';
    const vp = (p && p.vpitch > 0) ? p.vpitch : 1;
    const vg = (p && p.vgain > 0) ? p.vgain : 1;
    sysSpatial.volume = clamp(s * 0.13, 0.25, 1) * vg;
    sysSpatial.pitch = clamp(clamp(1.25 - s * 0.03, 0.7, 1.25) * vp, 0.4, 2.5);
    sysSpatial.at = (p && p.position) || null;
    sfx(voice, sysSpatial);
    sysSpatial.at = null;
    game.state.chaos = clamp(game.state.chaos + clamp(s * 0.012, 0, 0.12), 0, 1);
  });
  game.events.on('prop:water', function (p) {
    sysSpatial.volume = 1; sysSpatial.pitch = 1;
    sysSpatial.at = (p && p.position) || null;
    sfx('splash', sysSpatial);
    sysSpatial.at = null;
  });
  game.events.on('npc:startled', function (p) {
    // A gasp from behind you is one of the funniest things this game does and
    // it has always come out of the middle of the mix.
    const n = p && p.npc;
    const g = n && n.group;
    sysSpatial.volume = 1; sysSpatial.pitch = 1;
    sysSpatial.at = (g && g.position) || null;
    sfx('gasp', sysSpatial);
    sysSpatial.at = null;
    musChaseT = Math.max(musChaseT, 2.5);
    game.state.chaos = clamp(game.state.chaos + 0.06, 0, 1);
  });
  // Music reacts to a chase: the pad ducks and opens up, plucks thicken slightly.
  game.events.on('npc:chase', function () { musChaseT = 7; });
  game.events.on('npc:calm', function () { musChaseT = Math.min(musChaseT, 1.2); });

  // --- the emigration ------------------------------------------------------
  // environment.js emits this the moment the capybara is aboard a departing ferry.
  // Everything after it is systems' problem: tick the stowaway, white out, swap the
  // hemisphere, put it down in the middle of the Plaza de Nariño.
  // Stowing away on the Sydney ferry no longer teleports you across the Pacific
  // in one hop — it takes you where a Sydney ferry actually goes, which is round
  // the corner to Circular Quay, where there is a boat with a wheel on it and
  // Manly seven hundred metres north. Nariño is the leg after that.
  game.events.on('ferry:departed', function () {
    completeTask('ferry-ride');
    sfx('horn');
    biomeFadeTo('quay', 'CIRCULAR QUAY', 'she sails when you say she sails');
  });

  // Sun, sky, fog and the shadow frustum are all biome state. The colours glide
  // (see the atmosphere block in update); the frustum depth is a one-off swap.
  game.events.on('biome:enter', function (p) {
    const name = (p && p.name) || 'sydney';
    jrSeen[chapterOf(name)] = 1;
    saveSoon();
    // Every biome is authored in the SAME coordinates, so a breadcrumb dropped
    // on the Corso is a point inside a basilica once Venice is attached. The
    // trail belongs to the world it was walked in and to no other.
    backRing.length = 0; backT = 0; backHold = 0; backBusy = 0;
    const cdef = chapterDef(chapterOf(name));
    const pasto = name === 'pasto';
    bioTarget = pasto ? 1 : 0;
    // The deep shadow frustum is not about Pasto, it is about RELIEF: a 46 m
    // glacier and a 42 m dune need exactly the same box a 62 m volcano does.
    // RELIEF, not altitude: a 46 m glacier, a 42 m dune, a 62 m volcano and an
    // archipelago whose highest deck is seventy-eight metres over its lowest
    // all want the same deep shadow frustum.
    shadowFitBiome(cdef.tall ? 1 : 0);
    // The dome's zenith and the lens's grade are biome state exactly the way
    // the fog and the shadow frustum are. Both cross-fade; only the dome's
    // OWNERSHIP is a hard swap, because two domes cannot both be the sky.
    sysGradeWant = sysGRADES[name] || sysGRADES.sydney;
    sysSkyTopWant.set(sysSKY_TOP[name] || PALETTE.skyTop);
    if (sysSkyMesh) sysSkyMesh.visible = !sysSKY_OWN[name];
    // The list and the score both belong to the place, not to a progress
    // counter: crossing a hemisphere swaps the paper and the key together.
    todoRefresh();
    musSetPalette(cdef.pal || 0);
    // From the crater rim the whole valley is in frame, and Sydney's 400 m far
    // plane would guillotine the far ridge clean off. Swapped here, never per frame.
    camera.far = sysCamFarFor(name);
    camera.updateProjectionMatrix();
    // Leaving Pasto: drop the flight rig and the readout on the spot rather than
    // let them cross-fade over the harbour.
    if (!pasto) {
      flyT = 0; altOpen = 0; flyWas = false;
      homeSet(0); homeT = 0; homeShown = false;
      homeEl.classList.remove('show');
      flyHudOn = false; flyEl.classList.remove('show');
    }
  });

  // =========================================================================
  // update
  // =========================================================================
  function update(dt) {
    // ---- input ----
    // The pad is polled FIRST so its held state is in this frame's flags. Its
    // three edges are queued and published at the very bottom of update() —
    // see the note by padPoll and the clear at the end of this function.
    padPoll(dt);
    if (padRumbleT > 0) padRumbleT -= dt;
    let ix = 0, iz = 0;
    if (started) {
      if (keys.KeyA || keys.ArrowLeft) ix -= 1;
      if (keys.KeyD || keys.ArrowRight) ix += 1;
      if (keys.KeyW || keys.ArrowUp) iz -= 1;
      if (keys.KeyS || keys.ArrowDown) iz += 1;
      if (stickActive) { ix += stickX; iz += stickZ; }
      if (padX || padZ) { ix += padX; iz += padZ; }
      const m = Math.hypot(ix, iz);
      if (m > 1) { ix /= m; iz /= m; }
    }
    input.x = ix;
    input.z = iz;
    input.run = !!(keys.ShiftLeft || keys.ShiftRight) || padRun ||
                (stickActive && Math.hypot(stickX, stickZ) > 0.86);
    input.honk = started && (!!keys.KeyQ || touchHonk || padHonk);
    input.action = started && (!!keys.KeyE || mouseAction || touchAction || padAction);
    input.whistle = input.honk;          // one mouth, one button — see the keydown note
    input.jump = started && (!!keys.Space || touchJump || padJump);

    // ---- put me back --------------------------------------------------------
    // Sampled every frame, acted on after sysBACK_HOLD of held R. backBusy is a
    // one-shot latch: without it the key repeats the rescue nine times before
    // the player's thumb comes off it.
    if (started) {
      backCrumb(dt);
      if (keys.KeyR && !jrShown && !ended) {
        backHold += dt;
        if (backHold >= sysBACK_HOLD && !backBusy) { backBusy = 1; backRescue(); }
      } else { backHold = 0; backBusy = 0; }
    }

    if (started) {
      // Z/X rather than Q/R: an adjacent pair reads as an axis, the left one
      // turns left, and Q is now the voice. The mouse is still the real camera.
      if (keys.KeyZ) { camYawTarget += dt * sysCAM_KEY_RATE; camHandT = sysCAM_HAND_T; }
      if (keys.KeyX) { camYawTarget -= dt * sysCAM_KEY_RATE; camHandT = sysCAM_HAND_T; }
    }
    if (camHandT > 0) camHandT -= dt;
    camYaw = damp(camYaw, camYawTarget, 9, dt);
    camDist = damp(camDist, camDistTarget, 6, dt);

    // ---- camera ----
    const inPasto = !!(game.biome && game.biome.isActive('pasto'));
    const inQuay = !!(game.biome && game.biome.isActive('quay'));
    const inKyoto = !!(game.biome && game.biome.isActive('kyoto'));
    const inCali = !!(game.biome && game.biome.isActive('cali'));
    const inRio = !!(game.biome && game.biome.isActive('rio'));
    const inIce = !!(game.biome && game.biome.isActive('iceland'));
    const inSah = !!(game.biome && game.biome.isActive('sahara'));
    const inDri = !!(game.biome && game.biome.isActive('drift'));
    const inVen = !!(game.biome && game.biome.isActive('venice'));
    const inHk = !!(game.biome && game.biome.isActive('kowloon'));
    const inPal = !!(game.biome && game.biome.isActive('palawan'));
    const inGor = !!(game.biome && game.biome.isActive('goreme'));
    const capy = game.capy;
    // p = AUTHORITATIVE physics position (gameplay: zone tests, shadow fitting).
    const p = capy && capy.position ? capy.position : sysZERO;
    const v = capy && capy.velocity ? capy.velocity : sysZERO;
    // r = RENDER position for the display time. Following the stepped physics
    // position pins the camera to the 60Hz ladder, which is what "shakes".
    sysCapyR.copy(p);
    if (capy) {
      const cb = capy.body;
      if (cb && cb.interpolatedPosition) {
        sysCapyR.set(cb.interpolatedPosition.x, cb.interpolatedPosition.y, cb.interpolatedPosition.z);
      } else if (capy.group) {
        sysCapyR.copy(capy.group.position);
      }
      // Safety net: if something teleported the body without refreshing the
      // interpolated transform, the render position is stale by metres. Snap to
      // the authoritative one rather than smear the camera across the map.
      const ex = sysCapyR.x - p.x, ey = sysCapyR.y - p.y, ez = sysCapyR.z - p.z;
      if (ex * ex + ey * ey + ez * ez > 2.25) sysCapyR.copy(p);
    }
    const r = sysCapyR;

    // ---- take the stage: stand on the Opera House podium for a beat ----
    // Sydney only: env.inZone answers about the harbour whatever biome is live —
    // every biome shares one coordinate space, so the podium rectangle exists as
    // bare ground in all of them and the check must be gated on Sydney itself.
    const envApi = game.env;
    if (started && game.biome.isActive('sydney') && envApi && typeof envApi.inZone === 'function' && capy && capy.position) {
      if (envApi.inZone('operaStage', p.x, p.z) && p.y > 0.9) {
        stageT += dt;
        if (stageT > 1.5) completeTask('opera-stage');
      } else stageT = 0;
    }

    // ---- ground rig <-> flight rig -----------------------------------------
    // One blend drives everything below: distance, pitch, look lead and which yaw
    // the rig orbits on. Mounting and dropping are the same move played backwards.
    const mounted = !!(inPasto && game.condor && game.condor.mounted);
    flyT = damp(flyT, mounted ? 1 : 0, sysFLY_LAMBDA, dt);
    const sp = Math.hypot(v.x, v.z);

    // ---- the rig tidies itself up, but ONLY WHEN YOU ARE STOOD STILL -------
    // The obvious version of this — swing in behind the direction of travel —
    // is a positive feedback loop, and measurably so. Movement is CAMERA
    // RELATIVE, so turning the rig turns the stick's world direction, which
    // turns the velocity, which the rig then chases further: holding one key
    // ran camYaw away at a constant 1.57 rad/s and walked the capybara in
    // circles for ever. Algebraically it cannot converge — with the stick at a
    // fixed screen angle s the loop reduces to (dc/dt) = lambda*s, which is only
    // stable at s = 0, i.e. dead ahead.
    // Stood still, the loop is cut: no stick means capybara.js is not updating
    // its facing, so the target is a constant and the rig simply settles behind
    // it. That is also exactly when a player wants it — you stop, and the camera
    // quietly puts itself back where you can see what you are doing.
    const camIdle = sp < sysCAM_AUTO_V && Math.abs(ix) + Math.abs(iz) < 0.02;
    if (camIdle) camIdleT += dt; else camIdleT = 0;
    // AT THE WHEEL THE STICK IS NOT A DIRECTION, IT IS A THROTTLE AND A RUDDER,
    // so the loop that makes camera-relative movement dangerous (see the note
    // below) does not exist here — the rig can simply sit behind the ship all
    // the time, which is the only place a helm camera belongs. Dragging still
    // wins, for as long as the drag lasts.
    const sailing = !!game.state.sailing;
    sailT = damp(sailT, sailing ? 1 : 0, sysSAIL_LAMBDA, dt);
    // Riding on the roof of something that is going somewhere is the same case
    // as standing at a wheel — the rig belongs behind the VEHICLE's heading, not
    // behind the animal's — and it needs its own branch because the idle test
    // above measures world speed, which on a moving bus is never idle.
    // camYaw is the bearing FROM the capybara TO the camera, so behind is + PI.
    let rideYaw = NaN;
    if (inCali && game.cali && typeof game.cali.rideYaw === 'function') rideYaw = game.cali.rideYaw();
    if (sailing && camHandT <= 0 && capy && capy.group) {
      // ...AND THIS BRANCH WAS MISSING THE HALF TURN. Exactly the bug the note
      // below describes, in the one place nobody re-checked when it was fixed
      // for walking: at the wheel `capy.group.rotation.y` is the SHIP'S
      // HEADING, and targeting it directly puts the rig at that bearing FROM
      // the boat, which is dead ahead of the bow.
      //
      // Measured, at the helm, holding full ahead: Circular Quay put the camera
      // 20.8 m toward the bow and Antarctica 14.0 m. So both boat chapters were
      // driven looking BACKWARDS down the ship — you could see the water you
      // had already crossed and not the water you were about to, which on a
      // passage whose whole content is a bridge, a regatta and a wall of pack
      // ice is most of the chapter. It has been that way since chapter 3.
      camYawTarget = sysDampAngle(camYawTarget, capy.group.rotation.y + Math.PI, sysSAIL_YAW_L, dt);
    } else if (rideYaw === rideYaw && camHandT <= 0) {
      camYawTarget = sysDampAngle(camYawTarget, rideYaw + Math.PI, sysSAIL_YAW_L, dt);
    } else if (started && !mounted && camHandT <= 0 && camIdleT > sysCAM_IDLE_T && capy && capy.group) {
      // BEHIND THE ANIMAL, WHICH IS HALF A TURN FROM WHERE IT IS LOOKING.
      // camYaw is the direction FROM the capybara TO the camera, and the mesh's
      // nose points along +z at rotation zero — so a capybara that has just
      // walked forward is at rotation camYaw + PI, and targeting that rotation
      // directly swung the rig a full half-turn into its FACE. Measured: stand
      // still for 1.1 s and the camera ends up in front of you and W walks you
      // backwards, because the stick is camera-relative and the camera had
      // moved. It has been that way since the rig was written; it is one term.
      camYawTarget = sysDampAngle(camYawTarget, capy.group.rotation.y + Math.PI, sysCAM_AUTO_L, dt);
    }
    if (mounted !== flyWas) {
      flyWas = mounted;
      // Dropped: adopt the heading you were flying on as the new ground yaw, so the
      // rig does not spend the fade swinging back to wherever Q/R last left it.
      if (!mounted) { camYaw = flyYaw; camYawTarget = flyYaw; }
    }
    if (mounted) {
      // Lead the direction of travel: sit behind the velocity, not behind the player.
      if (sp > sysFLY_YAW_MIN) flyYawT = Math.atan2(-v.x, -v.z);
      flyYaw = sysDampAngle(flyYaw, flyYawT, sysFLY_YAW_L, dt);
    } else if (flyT < 0.002) {
      flyYaw = camYaw; flyYawT = camYaw;
    } else {
      flyYaw = sysDampAngle(flyYaw, camYaw, sysFLY_YAW_L, dt);
    }
    const useYaw = camYaw + sysWrapPi(flyYaw - camYaw) * flyT;
    // Published AFTER the blend: capybara.js turns the stick into camera-relative
    // motion, and during the fade the axes must match what is actually on screen.
    input.camYaw = useYaw;

    // Anchor + look ride the smooth render position. With no ladder underneath
    // them the whole rig can sit on a gentler spring without feeling laggy.
    sysAnchor.x = damp(sysAnchor.x, r.x, 8, dt);
    sysAnchor.y = damp(sysAnchor.y, r.y + 1.0, 4.5, dt);
    sysAnchor.z = damp(sysAnchor.z, r.z, 8, dt);

    // Aim above the capybara and ahead of its travel: this drops the animal to
    // roughly 40% up the frame and fills the top with the world it is entering.
    // In the air the lead runs much further out — at 20 m/s a 2.5 m lead is nothing.
    let lx = r.x, lz = r.z;
    if (sp > 0.15) {
      const la = Math.min(sp * lerp(sysLOOK_LEAD, sysFLY_LEAD, flyT),
                          lerp(sysLOOK_LEADMAX, sysFLY_LEADMAX, flyT));
      lx += v.x / sp * la;
      lz += v.z / sp * la;
    }
    // ---- EYE AND TARGET MOVE TOGETHER --------------------------------
    // The camera's ANGLE is the difference between two independently damped
    // points. Damp them at different rates and the difference wobbles even when
    // both are perfectly smooth — which is why the flight camera reads noisy
    // while the ground camera reads clean: on the ground the rig is 9.5 m back
    // and a 2 cm disagreement is 2 mrad, but in flight it is 24 m back behind a
    // bird doing 20 m/s and the same disagreement is a visible shimmy of the
    // whole horizon. So the look target is damped at the SAME rate the eye is,
    // and only the deliberate lead (below) is allowed to lag.
    const lookL = lerp(5, 7, flyT);
    sysLook.x = damp(sysLook.x, lx, lookL, dt);
    sysLook.y = damp(sysLook.y, r.y + lerp(lerp(lerp(sysLOOK_RAISE, sysSKY_RAISE, skyT),
                                                sysSAIL_RAISE, sailT), sysFLY_RAISE, flyT), 4, dt);
    sysLook.z = damp(sysLook.z, lz, lookL, dt);

    // Speed dolly: in close at a waddle, eased out ~1.2 units at a full run. In
    // flight the dolly is irrelevant — the rig is already 24 m back.
    camDolly = damp(camDolly, clamp(sp / sysRUN_SPEED, 0, 1) * sysCAM_DOLLY, 2.4, dt);
    // ---- the crane-up ----------------------------------------------------
    // Asked for by the live biome and by nobody else. It is deliberately NOT
    // blended against the flight rig or the helm: being on a condor or at a
    // wheel already owns the camera, and two things fighting for the pitch is
    // how you get a rig that swims.
    // Two biomes publish skyward() now, so it is asked of whichever one is
    // live rather than of Iceland by name.
    let skyWant = 0;
    // Ask the LIVE biome, whichever it is. This was a three-armed conditional
    // naming the three chapters that happened to have published skyward() when
    // it was written, so the fourth one to want it (a hundred-metre skyline
    // across a kilometre of water) would silently have got nothing.
    const skyApi = sysLiveBiomeApi(game);
    if (skyApi && typeof skyApi.skyward === 'function') {
      const sw = skyApi.skyward();
      if (typeof sw === 'number' && sw === sw) skyWant = clamp(sw, 0, 1);
    }
    skyT = damp(skyT, (flyT > 0.1 || sailT > 0.1) ? 0 : skyWant, sysSKY_LAMBDA, dt);
    let camReach = lerp(lerp(lerp(camDist + camDolly, sysSKY_DIST, skyT), sysSAIL_DIST, sailT), sysFLY_DIST, flyT);
    let camPitch = lerp(lerp(lerp(sysCAM_PITCH, sysSKY_PITCH, skyT), sysSAIL_PITCH, sailT), sysFLY_PITCH, flyT);

    // ---- A BIOME MAY ASK FOR ITS OWN LENS -------------------------------
    // Four hardcoded rigs (ground, crane, helm, flight) were enough for as long
    // as new rigs arrived one a chapter and each got its own branch. They do not
    // any more, and a fifth and sixth branch in this chain would be six things
    // fighting over one pitch — which the crane's own comment already warns
    // about. So: the live biome may publish rig() -> {w, dist, pitch, raise},
    // and it is applied LAST, on top of whatever the chain above decided.
    //
    // It is deliberately a request and not a command: `w` is the biome's own
    // idea of how much it wants the lens, and it is multiplied down by the rigs
    // that already own the camera outright. Being on a condor beats being in a
    // river, and there is no argument to have.
    let rigWant = 0, rigDist = camReach, rigPitch = camPitch, rigRaise = sysLOOK_RAISE, rigLam = 1.6;
    const rigApi = sysLiveBiomeApi(game);
    if (rigApi && typeof rigApi.rig === 'function') {
      const rq = rigApi.rig();
      if (rq && typeof rq.w === 'number' && rq.w === rq.w) {
        rigWant = clamp(rq.w, 0, 1) * (1 - Math.max(flyT, sailT));
        if (typeof rq.dist === 'number') rigDist = rq.dist;
        if (typeof rq.pitch === 'number') rigPitch = rq.pitch;
        if (typeof rq.raise === 'number') rigRaise = rq.raise;
        if (typeof rq.lambda === 'number') rigLam = rq.lambda;
      }
    }
    rigT = damp(rigT, rigWant, rigLam, dt);
    if (rigT > 0.002) {
      camReach = lerp(camReach, rigDist, rigT);
      camPitch = lerp(camPitch, rigPitch, rigT);
      sysLook.y = lerp(sysLook.y, r.y + rigRaise, rigT);
    }

    const cp = Math.cos(camPitch), sn = Math.sin(camPitch);
    const ox = Math.sin(useYaw) * cp, oz = Math.cos(useYaw) * cp;
    let t = 1;
    // The Opera House keep-out is Sydney geometry. In Pasto those coordinates are
    // open valley and the pull-in would fire for no reason at all.
    if (!inPasto) {
      for (let i = 0; i < 6; i++) {
        const d = camReach * t;
        const x = sysAnchor.x + ox * d;
        const y = Math.max(sysAnchor.y + sn * d, sysCAM_FLOOR);
        const z = sysAnchor.z + oz * d;
        if (!sysInOpera(x, y, z)) break;
        t -= 0.14;
        if (t < 0.34) { t = 0.34; break; }
      }
    }
    const dd = camReach * t;
    sysDesired.set(sysAnchor.x + ox * dd, sysAnchor.y + sn * dd, sysAnchor.z + oz * dd);
    // Asked of the LIVE biome, and of nobody by name — the same property lookup
    // every other optional hook uses, so a chapter that has no opinion costs a
    // failed lookup and gets the constant.
    let camFloorY = sysCAM_FLOOR;
    if (rigApi && typeof rigApi.camFloor === 'function') {
      const cf = rigApi.camFloor(sysDesired.x, sysDesired.z);
      if (typeof cf === 'number' && cf === cf) camFloorY = cf;
    }
    if (sysDesired.y < camFloorY) sysDesired.y = camFloorY;
    // Last resort: the pull-in still lands inside a shell (the vaults are
    // DoubleSide and would fill the screen). Tuck in closer AND rise — but only
    // as far as the vault actually in the way, and never more than
    // sysOPERA_RISE_MAX above the anchor. The old code teleported the eye to a
    // fixed y = 20 whatever was going on below it, which turned the capybara
    // into a speck for as long as the player stayed near the building.
    if (!inPasto) {
      const clear = sysOperaClear(sysDesired.x, sysDesired.y, sysDesired.z);
      if (clear > 0) {
        const rise = Math.min(clear + 1.4, sysAnchor.y + sysOPERA_RISE_MAX);
        sysDesired.set(sysAnchor.x + ox * dd * 0.55,
                       Math.max(sysDesired.y, rise),
                       sysAnchor.z + oz * dd * 0.55);
      }
    }
    // Galeras is 62 m of solid mountain and the rig sits 24 m behind a flying
    // animal: banking round the cone WILL put the eye inside the rock unless the
    // desired position is lifted clear of the terrain under it, every frame.
    // Kyoto's shrine hill is 34 m of exactly the same problem — and so is a
    // glacier, a dune, a karst, a fairy chimney, a headland and an ice shelf.
    // See sysHasRelief: this was four chapters by name and is now every chapter
    // that has a floor worth asking about.
    const relief = sysHasRelief();
    if (relief) {
      const gy = sysGroundY(sysDesired.x, sysDesired.z) + sysFLY_CLEAR;
      if (sysDesired.y < gy) sysDesired.y = gy;
    }
    // The torii tunnel gets a RAIL rather than a boom. Forty-four gates 4 m tall
    // and 1.4 m apart on a curving climb is a corridor, and a straight line back
    // from the animal leaves it sideways into a leg — measured: the capybara was
    // off screen for the whole of the longest task in the chapter. kyoto.js owns
    // the gate polyline so it owns the answer, and it returns null (one polyline
    // walk, no allocation) everywhere except under the gates.
    if (inKyoto && game.kyoto && typeof game.kyoto.toriiCam === 'function') {
      const rail = game.kyoto.toriiCam(sysAnchor.x, sysAnchor.z, sysTORII_BACK);
      if (rail) {
        sysDesired.x = lerp(sysDesired.x, rail.x, rail.w);
        sysDesired.y = lerp(sysDesired.y, rail.y, rail.w);
        sysDesired.z = lerp(sysDesired.z, rail.z, rail.w);
      }
    }

    // The spring is tracked separately from camera.position so the shake offset
    // is never fed back into the smoothing (that is what made shake "swim").
    if (!camInit) { camInit = true; sysCamPos.copy(camera.position); }
    sysCamPos.x = damp(sysCamPos.x, sysDesired.x, 7, dt);
    sysCamPos.y = damp(sysCamPos.y, sysDesired.y, 6.5, dt);
    sysCamPos.z = damp(sysCamPos.z, sysDesired.z, 7, dt);
    if (sysCamPos.y < camFloorY) sysCamPos.y = camFloorY;
    camera.position.copy(sysCamPos);

    // Shake: summed low-frequency sines (continuous, so it can never jump between
    // frames), position only, hard-capped, and gone inside a third of a second.
    if (shakeAmt > 0.0008 && sysSHAKE_SCALE > 0) {
      shakeAmt = damp(shakeAmt, 0, sysSHAKE_DECAY, dt);
      const s = shakeAmt * sysSHAKE_SCALE;
      const tt = game.state.time;
      camera.position.x += (Math.sin(tt * 31.4) * 0.6 + Math.sin(tt * 19.7 + 1.7) * 0.4) * sysSHAKE_AMPXZ * s;
      camera.position.y += (Math.sin(tt * 27.1 + 0.6) * 0.55 + Math.sin(tt * 15.3 + 2.4) * 0.45) * sysSHAKE_AMPY * s;
      camera.position.z += (Math.cos(tt * 35.2 + 1.1) * 0.6 + Math.cos(tt * 23.1 + 0.3) * 0.4) * sysSHAKE_AMPXZ * s;
      if (camera.position.y < sysCAM_FLOOR) camera.position.y = sysCAM_FLOOR;
    } else {
      shakeAmt = 0;
    }
    // Second clearance test, on the position actually being rendered from: the
    // spring lags the desired point by a few metres and a shake can add half of one.
    if (relief) {
      const gy2 = sysGroundY(camera.position.x, camera.position.z) + sysFLY_CLEAR;
      if (camera.position.y < gy2) camera.position.y = gy2;
    }
    // ---- THE LENS BREATHES ------------------------------------------------
    // Three terms onto sysFOV_BASE, all render-only. See the sysFOV_* block.
    // The reference speed follows whichever rig is live, so a full-tilt waddle
    // and a condor on a glide both read as "flat out" rather than the ground
    // rig being permanently pegged the moment a bird is involved.
    {
      const fovRef = lerp(sysFOV_REF, sysFOV_REF_AIR, Math.max(flyT, sailT * 0.5));
      const want = clamp(sp / fovRef, 0, 1.15);
      fovSpeed = damp(fovSpeed, want, sysFOV_LAMBDA, dt);
      // The punch: a critically-damped spring, integrated semi-implicitly so it
      // cannot gain energy on a long frame the way an explicit one does.
      if (fovKick !== 0 || fovKickV !== 0) {
        fovKickV += (-sysFOV_KICK_K * fovKick - sysFOV_KICK_C * fovKickV) * dt;
        fovKick += fovKickV * dt;
        if (Math.abs(fovKick) < 0.004 && Math.abs(fovKickV) < 0.04) { fovKick = 0; fovKickV = 0; }
      }
      // ...and the lean-in, off the SLOW-MOTION component and not off the total
      // scale. A hitstop must hold the lens still, not narrow it — see the note
      // on game.time.slow. This term is exactly zero in all but the few hundred
      // frames a session where a marquee has actually landed.
      const slow = 1 - clamp(game.time ? game.time.slow : 1, 0, 1);
      const breathe = sysCalmMotion ? 0 : 1;
      const fovWant = clamp(sysFOV_BASE + (fovSpeed * sysFOV_SPEED + fovKick - slow * sysFOV_SLOW) * breathe,
                            sysFOV_MIN, sysFOV_MAX);
      // updateProjectionMatrix rebuilds a matrix and dirties the frustum, so it
      // is only called when a viewer could tell.
      if (Math.abs(fovWant - fovLast) > sysFOV_EPS) {
        fovLast = fovWant;
        camera.fov = fovWant;
        camera.updateProjectionMatrix();
      }
    }
    // The look target is never shaken — only the eye moves.
    camera.lookAt(sysLook);
    game.state.chaos = damp(game.state.chaos, 0, 0.3, dt);

    // ---- shadows follow the capybara ----
    // Sydney is flat, so the shadow box can sit on y=0. Pasto is a volcano: the
    // box has to ride the animal's altitude or everything above it goes unlit —
    // and it has to WIDEN with height, or a flight over the valley outruns it and
    // every shadow in frame quietly disappears.
    const groundY = relief ? sysGroundY(p.x, p.z) : 0;
    // In the Drift there is no ground under the animal for most of the chapter,
    // so the shadow box rides the ANIMAL and widens with the drop the way the
    // flight box does in Pasto — otherwise everything below a leap goes unlit
    // the moment you leave a deck.
    //
    // ...AND EVERY OTHER CHAPTER WITH RELIEF HAS THE SAME PROBLEM. Height off
    // the deck is what the box has to widen for, and it is not a Pasto fact: a
    // hop off a fairy chimney, a dive off the bamboo jetty, a drop down the
    // Antarctic hill and a fall into a doline are all the animal a long way
    // above the ground its shadow has to land on. Pasto and the Drift keep
    // their measured curves; everywhere else gets the same 'how far up am I'
    // figure Pasto uses, which is 0 in the sixteen frames a chapter where the
    // animal is stood on something.
    const agl = inPasto ? Math.max(0, p.y - groundY)
              : inDri ? clamp(p.y * 0.35, 0, 26)
              : relief ? clamp(p.y - groundY, 0, 26) : 0;
    // The box rides the ANIMAL's height wherever there is relief. This was the
    // same four-chapter list, so in twelve worlds the shadow frustum sat on the
    // datum: everything the player stood on above y = 0 — a Cappadocian hill at
    // 8.4 m, an Antarctic ridge at 7.1, the whole of Sơn Đoòng — was outside
    // the box and therefore unlit by anything that casts.
    sunFollow(p.x, (relief || inDri) ? p.y : 0, p.z);
    shadowFitAlt(agl);

    // ---- where the next thing is ------------------------------------------
    // Resolved on a timer (targets move; a per-frame search over every prop and
    // NPC would not be free), but the ARROW is written every frame, because it
    // is measured against the camera and the camera is always turning.
    hintT -= dt;
    if (hintT <= 0) {
      hintT = sysHINT_TICK;
      hintHas = false;
      const h = started && todoTopId ? sysHINTS[todoTopId] : null;
      if (h && typeof h.where === 'function') {
        let pt = null;
        try { pt = h.where(); } catch (e) { pt = null; }
        if (pt) { hintHas = true; hintX = pt.x; hintZ = pt.z; hintY = pt.y; }
      }
      // the clue can depend on what is in the mouth, so refresh its wording too
      if (h) {
        const clue = typeof h.clue === 'function' ? h.clue() : h.clue;
        if (clue !== clueEl.textContent) {
          clueEl.textContent = clue || '';
          clueEl.classList.toggle('off', !clue);
        }
      }
    }
    const topRec = taskRec[todoTopId];
    if (topRec && hintHas && !mounted) {
      const hx = hintX - p.x, hz = hintZ - p.z;
      const hd = Math.sqrt(hx * hx + hz * hz);
      // THE ARROW IS A SCREEN-SPACE QUANTITY, so it is measured on the screen.
      // Projecting the horizontal bearing onto the rig's own axes looks right and
      // is not: the rig is pitched 41 degrees, which foreshortens world-forward to
      // cos(41) of world-right, and the damped camera lags `useYaw` during a turn.
      // MEASURED against the true projected direction, that flat version was out
      // by up to 17 degrees. Projecting both points through the actual camera is
      // exact by construction and costs two transforms a frame.
      // Both are taken at the CAPYBARA's height so this stays a ground bearing —
      // a beacon at the foot of the volcano must not point downwards.
      sysAimA.set(p.x, p.y, p.z).project(camera);
      sysAimB.set(hintX, p.y, hintZ).project(camera);
      // NDC y is up, and CSS rotate() is clockwise from up, so this is direct.
      const deg = Math.atan2(sysAimB.x - sysAimA.x, sysAimB.y - sysAimA.y) * 180 / Math.PI;
      const near = hd < sysHINT_NEAR;
      topRec.arrow.style.transform = 'rotate(' + deg.toFixed(0) + 'deg)';
      // THE MARK ON THE GROUND, AND THE GROUND IS NOT ALWAYS AT ZERO.
      // This used to name the seven chapters that had relief in them WHEN IT
      // WAS WRITTEN and fall back to y = 0 for the rest — so the beacon in
      // Venice sat under the paving, in Palawan under the dry sand, and in
      // Cappadocia eight metres beneath the town it was supposed to be marking.
      // Four chapters arrived after that conditional and none of them added a
      // rung to it. sysGroundY already asks the LIVE biome and answers 0 where
      // there is no relief, which is the same answer this list was reaching for
      // and is correct for every chapter including the ones not written yet.
      const bh = sysGroundY(hintX, hintZ);
      // ...and how far UP or DOWN it is, where that is a real part of the
      // answer. The target's own height if the hint carried one, the ground
      // under it otherwise. Six metres is two hops and a step-up: below that
      // the arrow and the metres are the whole story and an extra glyph is
      // noise, so it is deliberately silent in the nine flat chapters.
      const th = (hintY === hintY) ? hintY : bh;
      const dh = th - p.y;
      const tell = dh > sysHINT_RISE ? ' ↑' : dh < -sysHINT_RISE ? ' ↓' : '';
      const txt = near ? 'here' : (hd < 100 ? hd.toFixed(0) + ' m' + tell : '99+ m' + tell);
      if (topRec.dist.textContent !== txt) topRec.dist.textContent = txt;
      if (!topRec.aim.classList.contains('on')) topRec.aim.classList.add('on');
      topRec.arrow.style.opacity = near ? '0' : '1';
      beaconGroup.position.set(hintX, bh + 0.04, hintZ);
      const pulse = 1 + Math.sin(game.state.time * 3.1) * 0.10;
      beaconGroup.scale.set(pulse, 1, pulse);
      beaconGroup.rotation.y = game.state.time * 0.6;
      const want = hd > sysHINT_BEACON_MIN;
      if (want !== beaconGroup.visible) beaconGroup.visible = want;
    } else {
      if (topRec && topRec.aim.classList.contains('on')) {
        topRec.aim.classList.remove('on');
        topRec.dist.textContent = '';
      }
      if (beaconGroup.visible) beaconGroup.visible = false;
    }

    // ---- atmosphere: time of day x biome x altitude ----
    // Climbing opens the view: the fog is pushed back in proportion to height, so
    // the whole valley resolves as you rise and closes in again as you come down.
    dayT = damp(dayT, TASKS.length ? doneCount / TASKS.length : 0, sysDAY_LAMBDA, dt);
    bioT = damp(bioT, bioTarget, sysBIO_LAMBDA, dt);
    // The harbour keeps Sydney's light and Sydney's sky — it IS Sydney — but it
    // is a mile deep instead of a hundred metres, so the haze has to be pushed
    // most of the way out or Manly never resolves out of the murk at all.
    seaT = damp(seaT, game.biome && game.biome.isActive('quay') ? 1 : 0, 2.0, dt);
    kyoT = damp(kyoT, game.biome && game.biome.isActive('kyoto') ? 1 : 0, 2.0, dt);
    caliT = damp(caliT, game.biome && game.biome.isActive('cali') ? 1 : 0, 2.0, dt);
    rioT = damp(rioT, game.biome && game.biome.isActive('rio') ? 1 : 0, 2.0, dt);
    iceT = damp(iceT, inIce ? 1 : 0, 2.0, dt);
    sahT = damp(sahT, inSah ? 1 : 0, 2.0, dt);
    driT = damp(driT, inDri ? 1 : 0, 2.0, dt);
    venT = damp(venT, inVen ? 1 : 0, 2.0, dt);
    hkT = damp(hkT, inHk ? 1 : 0, 2.0, dt);
    palT = damp(palT, inPal ? 1 : 0, 2.0, dt);
    gorT = damp(gorT, inGor ? 1 : 0, 2.0, dt);
    // ...and the table-driven ones, in one line that never needs another.
    for (let ai = 0; ai < sysAIR_KEYS.length; ai++) {
      const nm = sysAIR_KEYS[ai];
      sysAirT[nm] = damp(sysAirT[nm], game.biome && game.biome.isActive(nm) ? 1 : 0, 2.0, dt);
    }
    // THE SECOND SKY IS NOT A BIOME FLAG, IT IS A CAMERA FLAG. palawan.js has
    // already smoothed it against the LENS rather than the animal, because the
    // picture goes green when the lens goes under and the lens is eleven metres
    // behind and four above — judging it from the capybara turns the surface
    // into a light switch that fires a second before anything on screen moves.
    subT = inPal && game.palawan ? clamp(game.palawan.submerged(), 0, 1) : damp(subT, 0, 4, dt);
    // These two are WORLD state, not camera state, so they are read from the
    // biome rather than damped toward a flag — sahara.js owns the storm clock
    // and it has already smoothed both of them.
    stormT = inSah && game.sahara ? clamp(game.sahara.storm(), 0, 1) : damp(stormT, 0, 3, dt);
    duskT = inSah && game.sahara ? clamp(game.sahara.dusk(), 0, 1) : damp(duskT, 0, 3, dt);
    auroraT = inIce && game.iceland ? clamp(game.iceland.aurora(), 0, 1) : damp(auroraT, 0, 3, dt);
    altOpen = damp(altOpen, flyT * clamp((camera.position.y - 8) / sysALT_REF, 0, 1),
                   sysALT_LAMBDA, dt);
    atmosApply(dayT, bioT, altOpen);
    if (seaT > 0.002 && scene.fog) {
      scene.fog.near = lerp(scene.fog.near, sysSEA_FOG_N, seaT);
      scene.fog.far = lerp(scene.fog.far, sysSEA_FOG_F, seaT);
      if (scene.background && scene.background.isColor) {
        sysColB.set(PALETTE.harbourHaze);
        scene.background.lerp(sysColB, seaT * 0.85);
        scene.fog.color.lerp(sysColB, seaT * 0.85);
      }
    }
    if (kyoT > 0.002 && scene.fog) {
      scene.fog.near = lerp(scene.fog.near, sysKYO_FOG_N, kyoT);
      scene.fog.far = lerp(scene.fog.far, sysKYO_FOG_F, kyoT);
      if (scene.background && scene.background.isColor) {
        sysColB.set(PALETTE.kyotoHaze);
        scene.background.lerp(sysColB, kyoT * 0.9);
        scene.fog.color.lerp(sysColB, kyoT * 0.9);
      }
    }
    if (rioT > 0.002 && scene.fog) {
      scene.fog.near = lerp(scene.fog.near, sysRIO_FOG_N, rioT);
      scene.fog.far = lerp(scene.fog.far, sysRIO_FOG_F, rioT);
      if (scene.background && scene.background.isColor) {
        sysColB.set(PALETTE.rioHaze);
        scene.fog.color.lerp(sysColB, rioT * 0.88);
        sysColB.set(PALETTE.rioSky);
        scene.background.lerp(sysColB, rioT * 0.82);
      }
    }
    // ---- ICELAND: the only night in the game -----------------------------
    // The fog does almost nothing here (polar air is clean and you can see for
    // miles); what makes it night is the three lights, and what keeps it from
    // being a black screen is that the ambient goes UP as the sun goes down —
    // in a world with no lamps in it, open shade has to be lit by the sky or it
    // is simply nothing. Then the aurora lifts the hemisphere green, which is
    // the only light in this game that comes from an event rather than a place.
    if (iceT > 0.002) {
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysICE_FOG_N, iceT);
        scene.fog.far = lerp(scene.fog.far, sysICE_FOG_F, iceT);
        sysColB.set(PALETTE.iceHaze);
        scene.fog.color.lerp(sysColB, iceT * 0.92);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysICE_BG_C, iceT * 0.94);
        if (auroraT > 0.01) scene.background.lerp(sysAURORA_C, auroraT * 0.13 * iceT);
      }
      sun.color.lerp(sysICE_SUN_C, iceT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysICE_SUN_I, iceT);
      hemi.color.lerp(sysICE_HEMI_C, iceT);
      hemi.groundColor.lerp(sysICE_GND_C, iceT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysICE_HEMI_I, iceT);
      amb.intensity = lerp(amb.intensity, sysICE_AMB_I, iceT);
      if (auroraT > 0.01) {
        // the sky itself becomes a light source, which is exactly what happens
        hemi.color.lerp(sysAURORA_C, auroraT * 0.45 * iceT);
        hemi.intensity += auroraT * 0.55 * iceT;
        amb.intensity += auroraT * 0.10 * iceT;
      }
    }
    // ---- THE DRIFT: a violet night with a moon in it ----------------------
    // The lantern is the only event in this biome that touches the lighting,
    // and it does it the way the aurora does in chapter seven: the sky itself
    // becomes a source. Everything warms, the fog pulls in a little (there is
    // suddenly something to be hazy AGAINST), and the ambient goes up — which
    // matters more here than anywhere, because after the lantern the player is
    // going to be looking at things a very long way off.
    if (driT > 0.002) {
      const glow = inDri && game.drift ? clamp(game.drift.glow(), 0, 1) : 0;
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysDRI_FOG_N, driT);
        scene.fog.far = lerp(scene.fog.far, sysDRI_FOG_F, driT);
        scene.fog.color.lerp(sysDRI_HAZE_C, driT * 0.94);
        if (glow > 0.01) scene.fog.color.lerp(sysDRI_WARM_C, glow * 0.10 * driT);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysDRI_BG_C, driT * 0.95);
        if (glow > 0.01) scene.background.lerp(sysDRI_WARM_C, glow * 0.07 * driT);
      }
      sun.color.lerp(sysDRI_SUN_C, driT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysDRI_SUN_I, driT);
      hemi.color.lerp(sysDRI_HEMI_C, driT);
      hemi.groundColor.lerp(sysDRI_GND_C, driT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysDRI_HEMI_I, driT);
      amb.intensity = lerp(amb.intensity, sysDRI_AMB_I, driT);
      if (glow > 0.01) {
        hemi.color.lerp(sysDRI_WARM_C, glow * 0.30 * driT);
        hemi.intensity += glow * 0.34 * driT;
        amb.intensity += glow * 0.12 * driT;
      }
    }
    // ---- VENICE: lit from underneath -------------------------------------
    // The one number the whole chapter turns on is the tide, and it is here as
    // well as in the water: as the square goes under, the bounce light comes
    // up, because a flooded piazza IS a light source. Read from the live biome
    // rather than from a flag — venice.js owns the tide clock and has already
    // smoothed it.
    if (venT > 0.002) {
      const tide = inVen && game.venice ? clamp(game.venice.tide(), 0, 1) : 0;
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysVEN_FOG_N, venT);
        scene.fog.far = lerp(scene.fog.far, sysVEN_FOG_F, venT);
        scene.fog.color.lerp(sysVEN_HAZE_C, venT * 0.9);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysVEN_BG_C, venT * 0.92);
      }
      sun.color.lerp(sysVEN_SUN_C, venT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysVEN_SUN_I, venT);
      hemi.color.lerp(sysVEN_HEMI_C, venT);
      hemi.groundColor.lerp(sysVEN_GND_C, venT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysVEN_HEMI_I, venT);
      amb.intensity = lerp(amb.intensity, sysVEN_AMB_I, venT);
      if (tide > 0.02) {
        hemi.groundColor.lerp(sysVEN_HEMI_C, tide * 0.45 * venT);
        hemi.intensity += tide * 0.30 * venT;
        amb.intensity += tide * 0.10 * venT;
      }
    }
    // ---- HONG KONG: a night made entirely of signs -----------------------
    if (hkT > 0.002) {
      const show = inHk && game.kowloon ? clamp(game.kowloon.show(), 0, 1) : 0;
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysHK_FOG_N, hkT);
        scene.fog.far = lerp(scene.fog.far, sysHK_FOG_F, hkT);
        scene.fog.color.lerp(sysHK_HAZE_C, hkT * 0.93);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysHK_BG_C, hkT * 0.95);
        if (show > 0.01) scene.background.lerp(sysHK_SHOW_C, show * 0.10 * hkT);
      }
      sun.color.lerp(sysHK_SUN_C, hkT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysHK_SUN_I, hkT);
      hemi.color.lerp(sysHK_HEMI_C, hkT);
      hemi.groundColor.lerp(sysHK_GND_C, hkT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysHK_HEMI_I, hkT);
      amb.intensity = lerp(amb.intensity, sysHK_AMB_I, hkT);
      if (show > 0.01) {
        // the far shore is a light source for about forty seconds an evening
        hemi.color.lerp(sysHK_SHOW_C, show * 0.35 * hkT);
        hemi.intensity += show * 0.30 * hkT;
        amb.intensity += show * 0.09 * hkT;
      }
    }
    // ---- PALAWAN: a bleached noon, and then the other one -----------------
    if (palT > 0.002) {
      const bloom = inPal && game.palawan ? clamp(game.palawan.bloom(), 0, 1) : 0;
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysPAL_FOG_N, palT);
        scene.fog.far = lerp(scene.fog.far, sysPAL_FOG_F, palT);
        scene.fog.color.lerp(sysPAL_HAZE_C, palT * 0.9);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysPAL_BG_C, palT * 0.93);
      }
      sun.color.lerp(sysPAL_SUN_C, palT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysPAL_SUN_I, palT);
      hemi.color.lerp(sysPAL_HEMI_C, palT);
      hemi.groundColor.lerp(sysPAL_GND_C, palT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysPAL_HEMI_I, palT);
      amb.intensity = lerp(amb.intensity, sysPAL_AMB_I, palT);

      // ---- AND UNDER IT ---------------------------------------------------
      // Applied on TOP of the above rather than instead of it, so surfacing is
      // a crossfade between two complete looks rather than a switch between
      // two settings. The fog does most of the work: at four metres near and
      // sixty far, the reef fades out at exactly the distance it does in real
      // water, and that single number is most of why it reads as underwater.
      if (subT > 0.002) {
        const k = subT * palT;
        if (scene.fog) {
          scene.fog.near = lerp(scene.fog.near, sysPAL_SUB_FOG_N, k);
          scene.fog.far = lerp(scene.fog.far, sysPAL_SUB_FOG_F, k);
          scene.fog.color.lerp(sysPAL_SUB_C, k * 0.95);
        }
        if (scene.background && scene.background.isColor) {
          scene.background.lerp(sysPAL_SUB_C, k * 0.9);
          // and it goes properly dark past the drop-off, which is the only
          // thing that makes eleven metres feel like eleven metres
          const capy = game.capy;
          const dp = capy ? clamp(((capy.depth || 0) - 4) / 8, 0, 1) : 0;
          scene.background.lerp(sysPAL_SUB_DEEP, dp * k * 0.7);
          if (scene.fog) scene.fog.color.lerp(sysPAL_SUB_DEEP, dp * k * 0.6);
        }
        // the sun cannot reach you and the water can: the key light drops away
        // and the fill goes up, which is what actually happens down there
        sun.intensity = lerp(sun.intensity, sun.intensity * 0.30, k);
        hemi.color.lerp(sysPAL_SUB_C, k);
        hemi.groundColor.lerp(sysPAL_SUB_DEEP, k);
        amb.intensity = lerp(amb.intensity, 0.72, k);
      }
      if (bloom > 0.01) {
        // for forty seconds the WATER is the light source, and it is the only
        // time in this game that anything but the sun and the neon is
        const kb = bloom * palT * (0.35 + subT * 0.65);
        hemi.color.lerp(sysPAL_BLOOM_C, kb * 0.55);
        hemi.intensity += kb * 0.35;
        amb.intensity += kb * 0.16;
        if (scene.background && scene.background.isColor) {
          scene.background.lerp(sysPAL_BLOOM_C, kb * 0.14);
        }
      }
    }
    // ---- CAPPADOCIA: the cold hour, and then the ridge lets go ------------
    if (gorT > 0.002) {
      const up = inGor && game.goreme ? clamp(game.goreme.sunUp(), 0, 1) : 0;
      const dawn = inGor && game.goreme ? clamp(game.goreme.dawn(), 0, 1) : 0;
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysGOR_FOG_N, gorT);
        scene.fog.far = lerp(scene.fog.far, sysGOR_FOG_F, gorT);
        scene.fog.color.lerp(sysGOR_HAZE_C, gorT * 0.9);
        scene.fog.color.lerp(sysGOR_DAY_HAZE, up * gorT * 0.75);
      }
      if (scene.background && scene.background.isColor) {
        scene.background.lerp(sysGOR_BG_C, gorT * 0.93);
        scene.background.lerp(sysGOR_DAY_BG, up * gorT * 0.55);
      }
      // THE SUN IS THE ONLY THING THAT CHANGES, and it changes by a factor of
      // nearly three. Before it clears the ridge the valley is lit by the sky
      // alone — flat, blue and shadowless, which is exactly what five in the
      // morning looks like and exactly why the shadows arriving is an event.
      sun.color.lerp(sysGOR_SUN_C, gorT);
      sun.color.lerp(sysGOR_DAY_C, up * gorT);
      sun.intensity = lerp(sun.intensity, sun.intensity * lerp(sysGOR_SUN_I, 1.30, up), gorT);
      hemi.color.lerp(sysGOR_HEMI_C, gorT);
      hemi.groundColor.lerp(sysGOR_GND_C, gorT);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysGOR_HEMI_I, gorT);
      amb.intensity = lerp(amb.intensity, lerp(sysGOR_AMB_I, 0.30, up), gorT);
      // the half hour before it, which is the reason anybody is out of bed
      if (dawn > 0.01 && up < 0.5) {
        hemi.color.lerp(sysGOR_DAY_BG, dawn * (1 - up * 2) * 0.35 * gorT);
        amb.intensity += dawn * (1 - up * 2) * 0.10 * gorT;
      }
    }
    // ---- THE TABLE-DRIVEN CHAPTERS ---------------------------------------
    // One loop, one row per place, and the fourteenth chapter did not have to
    // add a variable to this function. Everything above stays hand-written
    // because every one of those chapters has an EVENT in its air.
    for (let ai = 0; ai < sysAIR_KEYS.length; ai++) {
      const nm = sysAIR_KEYS[ai];
      const at = sysAirT[nm];
      if (at <= 0.002) continue;
      const r = sysAIR[nm];
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, r.fogN, at);
        scene.fog.far = lerp(scene.fog.far, r.fogF, at);
        sysColB.set(r.haze);
        scene.fog.color.lerp(sysColB, at * r.hazeK);
      }
      if (scene.background && scene.background.isColor) {
        sysColB.set(r.bg);
        scene.background.lerp(sysColB, at * r.bgK);
      }
      sysColB.set(r.sun);
      sun.color.lerp(sysColB, at);
      sun.intensity = lerp(sun.intensity, sun.intensity * r.sunK, at);
      sysColB.set(r.hemi);
      hemi.color.lerp(sysColB, at);
      sysColB.set(r.gnd);
      hemi.groundColor.lerp(sysColB, at);
      hemi.intensity = lerp(hemi.intensity, hemi.intensity * r.hemiK, at);
      amb.intensity = lerp(amb.intensity, r.amb, at);
    }
    // THE ONE EVENT THE TABLE CANNOT HOLD: a capybara shouting in the dark.
    // The echo is a real point light inside cave.js — it has to be, or it
    // could not fall off with distance and reveal one stalagmite at a time —
    // but the whole room lifts a little with it, and so does the sky, because
    // a sound that big in a space that big lights the ceiling too.
    if (sysAirT.cave > 0.002 && game.cave && game.cave.echo) {
      const e = clamp(game.cave.echo(), 0, 1) * sysAirT.cave;
      const day = game.cave.daylight ? clamp(game.cave.daylight(), 0, 1) * sysAirT.cave : 0;
      if (e > 0.004) {
        sysColB.set(PALETTE.cavEcho);
        hemi.color.lerp(sysColB, e * 0.5);
        hemi.intensity += e * 0.22;
        amb.intensity += e * 0.30;
      }
      if (day > 0.004) {
        // THREE PLACES IN A HUNDRED AND SEVENTY METRES OF MOUNTAIN HAVE REAL
        // DAYLIGHT IN THEM — the way in, the hole in the roof, and the way out
        // — and this is what makes them feel like it. The fog opens from a
        // hundred and sixty-five metres to five hundred, the sky comes back,
        // and the sun goes from a tenth to something you could read by.
        sysColB.set(PALETTE.cavShaft);
        hemi.color.lerp(sysColB, day * 0.72);
        hemi.intensity += day * 1.05;
        amb.intensity += day * 0.36;
        sun.color.lerp(sysColB, day * 0.7);
        sun.intensity = lerp(sun.intensity, sun.intensity + 2.0, day);
        if (scene.fog) {
          sysColB.set(PALETTE.cavMist);
          scene.fog.color.lerp(sysColB, day * 0.55);
          scene.fog.near = lerp(scene.fog.near, 70, day);
          scene.fog.far = lerp(scene.fog.far, 500, day);
        }
        if (scene.background && scene.background.isColor) {
          sysColB.set(PALETTE.cavDay);
          scene.background.lerp(sysColB, day * 0.88);
        }
      }
    }
    // ---- THE PANTANAL: THE SUNDOWN THE CROSSING SWITCHES ON ---------------
    //
    // pantanal.js has published `dusk()` since the chapter shipped, with a
    // comment saying "systems.js reads it" — and systems.js did not. Nothing
    // in the game read it. The chapter's marquee is written as a STATE rather
    // than a stunt: you are in the river, four of them are behind you, and the
    // light does the ceremony — except there was no ceremony, because the one
    // number the ceremony is made of went nowhere. Fourteen seconds of it,
    // and it is the same shape as the aurora and the storm: the sky becomes
    // the source, the sun drops into it and goes orange, the ground bounce
    // stays green because that is what is under it, and the haze closes in
    // because the air over a hundred thousand square kilometres of standing
    // water at seven in the evening is not clear air.
    //
    // It does NOT reset on leaving. A player who has taken the herd over the
    // river comes back to the light they left — pantanal.js's own decision,
    // and the reason this reads from the biome rather than damping to zero.
    if (sysAirT.pantanal > 0.002 && game.pantanal && game.pantanal.dusk) {
      const dk = clamp(game.pantanal.dusk(), 0, 1) * sysAirT.pantanal;
      if (dk > 0.004) {
        // A LOW SUN IS STILL A SUN. The first cut took the fog 62 % of the way
        // to the dusk colour and the sun down to 42 %, and photographed from
        // the middle of the river the whole chapter went the colour of milky
        // coffee — the OPPOSITE of golden hour, which is bright and low and
        // orange rather than dim and brown. Less colour in the air, more light
        // on the ground, and the contrast comes back.
        if (scene.fog) {
          sysColB.set(PALETTE.panSkyDusk);
          scene.fog.color.lerp(sysColB, dk * 0.42);
          scene.fog.near = lerp(scene.fog.near, 44, dk);
          scene.fog.far = lerp(scene.fog.far, 620, dk);
        }
        if (scene.background && scene.background.isColor) {
          sysColB.set(PALETTE.panSkyDusk);
          scene.background.lerp(sysColB, dk * 0.80);
        }
        // the sun goes DOWN, which for a light with no position that matters
        // means it goes orange and it goes out
        sysColB.set(PALETTE.panSun);
        sun.color.lerp(sysColB, dk * 0.55);
        sysColB.set(PALETTE.panSkyDusk);
        sun.color.lerp(sysColB, dk * 0.50);
        sun.intensity = lerp(sun.intensity, sun.intensity * 0.78, dk);
        // ...and the sky takes over, which is what actually happens at
        // sundown over water: the ambient goes UP as the sun goes out, the
        // same argument Iceland's night is built on.
        hemi.color.lerp(sysColB, dk * 0.48);
        sysColB.set(PALETTE.panGrass);
        hemi.groundColor.lerp(sysColB, dk * 0.4);
        hemi.intensity += dk * 0.30;
        amb.intensity = lerp(amb.intensity, 0.52, dk);
      }
    }
    // ---- MARRAKECH: noon, then a wall of sand, then evening ---------------
    if (sahT > 0.002) {
      if (scene.fog) {
        scene.fog.near = lerp(scene.fog.near, sysSAH_FOG_N, sahT);
        scene.fog.far = lerp(scene.fog.far, sysSAH_FOG_F, sahT);
        sysColB.set(PALETTE.sahHaze);
        scene.fog.color.lerp(sysColB, sahT * 0.9);
      }
      if (scene.background && scene.background.isColor) {
        sysColB.set(PALETTE.sahSkyHot);
        scene.background.lerp(sysColB, sahT * 0.86);
      }
      sun.color.lerp(sysSAH_SUN_C, sahT);
      sun.intensity = lerp(sun.intensity, sun.intensity * sysSAH_SUN_I, sahT);
      hemi.color.lerp(sysSAH_HEMI_C, sahT);
      hemi.groundColor.lerp(sysSAH_GND_C, sahT);
      amb.intensity = lerp(amb.intensity, sysSAH_AMB_I, sahT);

      // the storm. Everything collapses: you cannot see six metres, the sun is
      // a rumour, and the whole world is the colour of the ground because that
      // is where it currently is.
      const st = stormT * sahT;
      if (st > 0.004) {
        if (scene.fog) {
          scene.fog.near = lerp(scene.fog.near, sysSTORM_FOG_N, st);
          scene.fog.far = lerp(scene.fog.far, sysSTORM_FOG_F, st);
          scene.fog.color.lerp(sysSTORM_C, st * 0.95);
        }
        if (scene.background && scene.background.isColor) scene.background.lerp(sysSTORM_DEEP, st * 0.95);
        sun.intensity = lerp(sun.intensity, sun.intensity * 0.30, st);
        hemi.color.lerp(sysSTORM_C, st * 0.8);
        amb.intensity = lerp(amb.intensity, 0.5, st);
      }
      // and the evening it leaves behind, which is where the chapter ends
      const dk = duskT * sahT * (1 - stormT);
      if (dk > 0.004) {
        sun.color.lerp(sysDUSK_SUN_C, dk * 0.85);
        sun.intensity = lerp(sun.intensity, sun.intensity * 0.42, dk);
        hemi.intensity = lerp(hemi.intensity, hemi.intensity * 0.5, dk);
        amb.intensity = lerp(amb.intensity, 0.30, dk);
        if (scene.background && scene.background.isColor) scene.background.lerp(sysDUSK_SKY_C, dk * 0.86);
        if (scene.fog) {
          scene.fog.color.lerp(sysDUSK_SKY_C, dk * 0.7);
          scene.fog.far = lerp(scene.fog.far, 620, dk);
        }
      }
    }
    if (caliT > 0.002 && scene.fog) {
      scene.fog.near = lerp(scene.fog.near, sysCALI_FOG_N, caliT);
      scene.fog.far = lerp(scene.fog.far, sysCALI_FOG_F, caliT);
      if (scene.background && scene.background.isColor) {
        sysColB.set(PALETTE.caliHaze);
        scene.fog.color.lerp(sysColB, caliT * 0.85);
        sysColB.set(PALETTE.caliSky);
        scene.background.lerp(sysColB, caliT * 0.8);
      }
      // ---- and then the chiva takes the sun down --------------------------
      // Applied after Cali's own daytime haze and multiplied by caliT, so it
      // can only ever act while Cali is the live biome — cali.js keeps night()
      // at 1 for the rest of the run once the mirador is ticked, and a resident
      // detached biome that still tinted the sky would put Marrakech at
      // midnight. See the shared-coordinate-space rule.
      const nite = (inCali && game.cali && typeof game.cali.night === 'function')
        ? clamp(game.cali.night(), 0, 1) * caliT : 0;
      if (nite > 0.002) {
        scene.fog.near = lerp(scene.fog.near, sysCALI_N_FOG_N, nite);
        scene.fog.far = lerp(scene.fog.far, sysCALI_N_FOG_F, nite);
        scene.fog.color.lerp(sysCALI_N_HAZE_C, nite * 0.94);
        if (scene.background && scene.background.isColor) {
          scene.background.lerp(sysCALI_N_BG_C, nite * 0.95);
        }
        sun.color.lerp(sysCALI_N_SUN_C, nite);
        sun.intensity = lerp(sun.intensity, sun.intensity * sysCALI_N_SUN_I, nite);
        hemi.color.lerp(sysCALI_N_HEMI_C, nite);
        hemi.groundColor.lerp(sysCALI_N_GND_C, nite);
        hemi.intensity = lerp(hemi.intensity, hemi.intensity * sysCALI_N_HEMI_I, nite);
        amb.intensity = lerp(amb.intensity, sysCALI_N_AMB_I, nite);
      }
    }
    // ---- THE MICRO-ENVIRONMENT --------------------------------------------
    //
    // ABSOLUTELY LAST, and after every hand-written block above as well as the
    // table loop, because it is not a chapter's air — it is what is happening
    // to a chapter's air this minute. weather.js has already decided how much
    // of it there is; every number here is a MULTIPLIER or an ADDEND on what
    // the seventeen blocks above have finished computing, so a chapter with no
    // mood row (or a build in which weather.js failed to construct at all)
    // passes through this untouched to the last float.
    //
    // The rule it obeys, which is the whole brief: it may make an hour
    // WEATHER, and it may not make it a different hour. The sun may lose a
    // third of itself to a shower and the fog may come in by a third, and at
    // the bottom of that you can still say what time it is in every one of the
    // seventeen. That was the test the constants in weather.js were tuned to.
    const WX = game.weather;
    if (WX) {
      const wl = WX.light();
      if (wl.sunK !== 1) sun.intensity *= wl.sunK;
      if (wl.hemiK !== 1) hemi.intensity *= wl.hemiK;
      if (wl.amb) amb.intensity += wl.amb;
      if (scene.fog && (wl.fogFK !== 1 || wl.hazeMix > 0)) {
        scene.fog.near *= wl.fogNK;
        scene.fog.far *= wl.fogFK;
        if (wl.hazeMix > 0.002) {
          sysColB.set(wl.hazeHex);
          scene.fog.color.lerp(sysColB, wl.hazeMix);
        }
      }
      // THE SKY MOVES LESS THAN THE FOG, AND THAT IS NOT AN OVERSIGHT. Rain is
      // between you and the far half of the world, so it greys the DISTANCE
      // hard; it is barely between you and the zenith at all. Moving both by
      // the same amount is what makes a video-game rainstorm look like
      // somebody turned the lights down, and it is why bgMix is two thirds of
      // hazeMix in weather.js rather than equal to it.
      if (wl.bgMix > 0.002 && scene.background && scene.background.isColor) {
        sysColB.set(wl.hazeHex);
        scene.background.lerp(sysColB, wl.bgMix);
      }
    }

    // ---- THE DOME, THE FILL AND THE GRADE ---------------------------------
    // Last in the atmosphere section on purpose. Everything above has finished
    // moving the fog, the background and the three lights for this frame; these
    // three all READ that result rather than duplicating any of it, which is
    // the only reason a chapter can add a new event without also having to
    // remember to tell the sky and the lens about it.
    sysDressFrame(dt);
    // ...and the bed the atmosphere is heard over. Immediately after the
    // picture, because it is the other half of the same state: the shower that
    // just took a third of the sun is the shower you can now hear.
    sysWxBedSet(dt);

    // ---- the score goes to sea -------------------------------------------
    // Palette 3 is only ever alive while somebody is actually driving. Taking
    // your hands off the wheel puts the quay's own key back, so the euphoria is
    // attached to the passage rather than to the postcode.
    musPlaceTick();
    const sailNow = !!game.state.sailing;
    if (sailNow !== sailWas) {
      sailWas = sailNow;
      if (game.biome && game.biome.isActive('quay')) musSetPalette(sailNow ? 3 : 2);
    }

    // ---- flight readout: altimeter, airspeed, thermal ----
    const flyShow = flyT > 0.06;
    if (flyShow !== flyHudOn) { flyHudOn = flyShow; flyEl.classList.toggle('show', flyShow); }
    if (flyShow) {
      flyHudT += dt;
      if (flyHudT >= 0.1) {
        flyHudT = 0;
        const altI = Math.round(agl);
        if (altI !== flyAltLast) { flyAltLast = altI; flyAltN.textContent = altI; }
        const barI = Math.round(clamp(agl / sysALT_FS, 0, 1) * 100);
        if (barI !== flyBarLast) { flyBarLast = barI; flyBarFill.style.width = barI + '%'; }
        // Airspeed is the CONDOR's — the capybara is a passenger swinging on a
        // constraint, and its own velocity mirror wobbles with every flap.
        let sx = v.x, sy = v.y, sz = v.z;
        const cbody = game.condor && game.condor.body;
        if (cbody && cbody.velocity) { sx = cbody.velocity.x; sy = cbody.velocity.y; sz = cbody.velocity.z; }
        const airI = Math.round(Math.sqrt(sx * sx + sy * sy + sz * sz) * 10);
        if (airI !== flyAirLast) { flyAirLast = airI; flyAirN.textContent = (airI / 10).toFixed(1); }
        const inTherm = thermalAt(p.x, p.y, p.z);
        if (inTherm !== flyThermOn) { flyThermOn = inTherm; flyThermEl.classList.toggle('on', inTherm); }
      }
    } else if (flyThermOn) {
      flyThermOn = false; flyThermEl.classList.remove('on');
    }

    // ---- minimap ----
    // Baked on the first frame of a biome; redrawn a dozen times a second, which
    // is plenty for a 100 px chart and keeps it off the frame budget.
    if (started && game.biome) {
      const bio = game.biome.current;
      // A BAKED MAP IS A MAP OF A WORLD THAT DOES NOT MOVE, and one of them
      // does. The base layer draws land and water by asking isOverWater(), and
      // in Venice that answer changes with the tide — so a map baked at low
      // water shows the piazza as dry paving while the player is swimming
      // across it. Re-baked in fifths of the tide: coarse enough to be five
      // bakes a cycle rather than sixty, fine enough that the map is never
      // showing the wrong city.
      const tideStep = inVen && game.venice ? Math.round(game.venice.tide() * 5) : -1;
      if (bio !== mapBakedFor || tideStep !== mapBakedTide) {
        mapBakedTide = tideStep;
        mapBake(bio);
      } else {
        mapT += dt;
        if (mapT >= 1 / sysMAP_HZ) {
          mapT = 0;
          const cg = capy && capy.group;
          mapGoal.ok = hintHas && !mounted;
          mapGoal.x = hintX; mapGoal.z = hintZ;
          // The readout, off the same two numbers the pin is drawn from, so
          // the chip and the chart can never disagree. Twelve times a second,
          // and only touched when the string actually changes.
          if (mapGoal.ok) {
            const gdx = hintX - p.x, gdz = hintZ - p.z;
            const gd = Math.sqrt(gdx * gdx + gdz * gdz);
            const txt = (gd < 10 ? gd.toFixed(1) : String(Math.round(gd))) + ' m';
            if (txt !== mapDistLast) { mapDistLast = txt; mapDistN.textContent = txt; }
          }
          if (mapGoal.ok !== mapDistOn) {
            mapDistOn = mapGoal.ok;
            mapDistEl.classList.toggle('show', mapDistOn);
          }
          // Sampled on the draw rather than on the frame: twelve a second at
          // three metres apart is a hundred and ninety metres of history in
          // sixty-four points, which covers every world here end to end.
          mapTrailPush(p.x, p.z);
          mapDraw(p, cg ? cg.rotation.y : 0, useYaw, mapGoal.ok ? mapGoal : null);
        }
      }
      const wantMap = !!mapSpec && !transBusy;
      if (wantMap !== mapShown) { mapShown = wantMap; mapEl.classList.toggle('show', wantMap); }
    }

    // ---- stamina readout ----
    // scaleX rather than width: a width animation relayouts the bar every frame.
    if (capy) {
      const s = clamp(capy.stamina === undefined ? 1 : capy.stamina, 0, 1);
      stamFill.style.transform = 'scaleX(' + s.toFixed(3) + ')';
      if (s > 0.999 && !capy.blown) stamFullT += dt; else stamFullT = 0;
      const want = started && stamFullT < 1.2;
      if (want !== stamShown) { stamShown = want; stamEl.classList.toggle('show', want); }
      const low = s < 0.28;
      if (low !== stamLow) { stamLow = low; stamEl.classList.toggle('low', low); }
      const bl = !!capy.blown;
      if (bl !== stamBlownCls) { stamBlownCls = bl; stamEl.classList.toggle('blown', bl); }
    }

    // ---- the way home: three whistles, stood in the crater ----
    // Discoverable because the prompt appears the moment you are stood in the right
    // place, and it runs the same fade -> switchTo -> teleport path as the ferry.
    // Ashore at Manly, with the passage made, the same three whistles are the
    // onward ticket instead of the way back — Manly is where you leave from.
    const atManly = !!(inQuay && game.quay && game.quay.arrived() && !game.state.sailing &&
                       game.quay.inZone('corso', p.x, p.z));
    // Cali's way out is the bridge over the Río Cali — the one place in the city
    // everybody crosses, and the only bit of it that is over water.
    const atCali = !!(inCali && Math.abs(p.x + 6) < 5.5 && Math.abs(p.z) < 8);
    // Rio's way out is the rock at Arpoador: the one place in the biome that is
    // not looking at the city, and the one place everybody in it is already
    // facing the same way. Same rule as everywhere else — one exit, somewhere
    // obvious, using a verb the player already has.
    const atRio = !!(inRio && game.rio && game.rio.inZone('arpoador', p.x, p.z));
    // On the Uji bridge, three whistles and the river takes you home. Every
    // biome that is not Sydney needs exactly one way out of it, standing
    // somewhere obvious, using a verb the player already has.
    const atUji = !!(inKyoto && game.kyoto && Math.abs(p.x - 4) < 5 && Math.abs(p.z - 128) < 9);
    // Iceland's way out is the end of the pier in the old harbour: the one place
    // in Reykjavik where the land simply stops. Same rule as everywhere else.
    const atIce = !!(inIce && game.iceland && game.iceland.inZone('pier', p.x, p.z));
    // Marrakech's is the fire at the camp, which is where the chapter ends
    // anyway — the last line on the list happens standing in it.
    const atSah = !!(inSah && game.sahara && game.sahara.inZone('camp', p.x, p.z) &&
                     game.sahara.dusk() > 0.25);
    // The Drift's way out is the lantern's plinth, and only once the thing is
    // burning — which makes it the last line of the chapter by construction
    // rather than by a rule, the same trick the fire at the desert camp plays.
    const atDri = !!(inDri && game.drift && game.drift.inZone('plinth', p.x, p.z));
    // Venice's way out is the Molo between the two columns — the one place in
    // the city everybody has always left from, and the only bit of the square
    // that is still dry at the top of the tide. It opens once you have SEEN a
    // flood, which makes the chapter's central event a thing you have to have
    // been present for, without ever making it a gate you can fail.
    const atVen = !!(inVen && game.venice && game.venice.inZone('molo', p.x, p.z) &&
                     game.venice.seenFlood());
    // Hong Kong's is the end of the Star Ferry pier, and only after the far
    // shore has done its trick — the same construction as the fire at the desert
    // camp and the lit lantern in the Drift: the last line of the chapter by
    // where it is, not by a rule.
    const atHk = !!(inHk && game.kowloon && game.kowloon.inZone('pier', p.x, p.z) &&
                    game.kowloon.seenShow());
    // Palawan's way out is the end of the bamboo jetty, and only once the bay
    // has done its trick — the same construction as the fire at the desert camp
    // and the lit lantern in the Drift: the last line of the chapter by where
    // it is, not by a rule.
    const atPal = !!(inPal && game.palawan && game.palawan.inZone('jetty', p.x, p.z) &&
                     game.palawan.seenBloom());
    // Cappadocia's is the landing plain, once you have actually flown. Which is
    // the only exit in the game you have to arrive at by not steering.
    const atGor = !!(inGor && game.goreme && game.goreme.inZone('landing', p.x, p.z) &&
                     game.goreme.flown());
    // Manly's is between the red and yellow flags, which is the most obvious
    // place on any Australian beach and the only one with somebody standing in
    // it — and it opens once the sea has done its trick, the same construction
    // as the fire at the desert camp and the lit lantern in the Drift.
    const inMan = !!(game.biome && game.biome.isActive('manly'));
    const atMan = !!(inMan && game.manly && game.manly.atFlags(p.x, p.z) &&
                     game.manly.seenSet());
    // The Pantanal's is the last bridge on the Transpantaneira, and it is
    // ungated: the road out of that place has always simply been there, and a
    // chapter about being somewhere you belong should not make you earn the
    // door.
    const inPan = !!(game.biome && game.biome.isActive('pantanal'));
    const atPan = !!(inPan && game.pantanal && game.pantanal.inZone('lastbridge', p.x, p.z));
    // And Sơn Đoòng's is the slot of daylight at the far end — once you have
    // stood in the other one. You cannot leave a cave by the way you came in;
    // you go on through, which is what everybody who has ever been in there
    // has had to do.
    const inCav = !!(game.biome && game.biome.isActive('cave'));
    const atCav = !!(inCav && game.cave && game.cave.inZone('exit', p.x, p.z) &&
                     game.cave.seenLight());
    // Antarctica's is the head of the station jetty — the one place in the
    // chapter that is not sea and is not snow, and the place the boat you
    // have spent the whole chapter in came from. It opens once the pod has
    // formed up on you at least once: the same construction as the fire at
    // the desert camp and the lit lantern in the Drift, so the last line of
    // the chapter is decided by where the exit is and not by a rule. You
    // also cannot leave from the tiller, which is why !sailing is in it.
    const inAnt = !!(game.biome && game.biome.isActive('antarctic'));
    const atAnt = !!(inAnt && game.antarctic && !game.state.sailing &&
                     game.antarctic.inZone('jetty', p.x, p.z) && game.antarctic.seenPod());
    const homeOk = !!(started && !transBusy && !mounted && capy &&
                      ((inPasto && p.y < groundY + sysHOME_STAND && homeZone(p.x, p.z)) ||
                       atManly || atUji || atCali || atRio || atIce || atSah || atDri ||
                       atVen || atHk || atPal || atGor || atMan || atPan || atCav || atAnt));
    if (homeOk) {
      if (homeT > 0) { homeT -= dt; if (homeT <= 0) homeSet(0); }
      if (!homeHinted) {
        homeHinted = true;
        toast(atManly ? 'there is a boat here that goes a very long way.'
            : atUji ? 'the river goes a long way south.'
            : atCali ? 'somebody down there is going to Sydney.'
            : atRio ? 'that ocean goes all the way to Sydney.'
            : atIce ? 'the boats out of here go a very long way south.'
            : atSah ? 'somebody at this fire knows a man with a truck.'
            : atDri ? 'shout from up here and something will come and get you.'
            : atVen ? 'boats have left from these two columns for a thousand years.'
            : atHk ? 'the ferries out of here go further than across.'
            : atPal ? 'everything that has ever left this island left from here.'
            : atGor ? 'these crews drive to seven countries. ask one.'
            : atMan ? 'the people in the yellow caps can get anybody anywhere.'
            : atPan ? 'this road goes north for a hundred and forty kilometres.'
            : atCav ? 'there is a way on through there, and it is the only one.'
            : atAnt ? 'the ship that dropped you here comes back past at eight.'
            : 'the wind here goes south.');
      }
      if (input.whistlePressed) {
        homeSet(homeCount + 1);
        homeT = sysHOME_WINDOW;
        if (homeCount >= 3) {
          // The third wheek used to BE the journey. It now opens the board and
          // the journey is whichever line you pick off it — including the one
          // it used to pick for you.
          homeSet(0); homeT = 0;
          homeEl.classList.remove('show'); homeShown = false;
          jrShow(true);
        }
      }
    } else if (homeCount || homeT > 0) {
      homeSet(0); homeT = 0;
    }
    // transBusy flips inside jrTravel() on the way out, which pulls the prompt
    // down on the same frame instead of letting it flash once behind the white-out.
    const homeVis = homeOk && !transBusy;
    if (homeVis !== homeShown) { homeShown = homeVis; homeEl.classList.toggle('show', homeVis); }

    // ---- ambient bed ----
    if (ac && acAmbGain) {
      const wantAmb = started && !muted && !game.state.paused && !document.hidden;
      ambientSet(wantAmb);
      if (wantAmb) {
        ambTimer -= dt;
        // ---- ONE SOUNDSCAPE PER PLACE -----------------------------------
        // This used to be "a silver gull, unless you are in the Andes", which
        // was right when there were two biomes and became wrong the moment
        // there were five: it put Sydney seagulls over a Kyoto temple garden
        // and over a matcha terrace in Uji. Each place gets the one distant,
        // occasional sound that says where you are without ever competing with
        // the score — a gull on the harbour, a wind off the volcano, a temple
        // bell in the valley, a car horn and a far-off trumpet in Cali.
        if (ambTimer <= 0) {
          const bio = game.biome && game.biome.current;
          if (bio === 'pasto') {
            sfx('hiss', { volume: rand(0.10, 0.20), pitch: rand(0.55, 0.75) });
            ambTimer = rand(11, 24);
          } else if (bio === 'quay') {
            // THE ONE CHAPTER THAT HAD NO SOUNDSCAPE AT ALL. Circular Quay fell
            // through every rung of this ladder to the bare `sfx('gull')` at the
            // bottom — Sydney's fallback, on a working harbour, for the whole of
            // a seventy-second passage. It is three places and they sound
            // nothing like each other, so it is positional, which is the sahara
            // rule: the terminal is ropes and horns and a bell; the stream is
            // water and gulls and a very long gap; Manly is surf and a town.
            const qz = capy && capy.position ? capy.position.z : 0;
            const qy = game.quay;
            const atTerminal = qz > -30;
            const atManly = qz < -480;
            const r = Math.random();
            if (atTerminal) {
              if (r < 0.30) sfx('horn', { volume: rand(0.07, 0.13), pitch: rand(0.38, 0.52) });
              else if (r < 0.56) sfx('rustle', { volume: rand(0.07, 0.13), pitch: rand(0.45, 0.7) });
              else if (r < 0.80) sfx('gull', { volume: rand(0.09, 0.16), pitch: rand(1.1, 1.5) });
              else sfx('thud', { volume: rand(0.05, 0.10), pitch: rand(0.32, 0.46) });
              ambTimer = rand(6, 13);
            } else if (atManly) {
              if (r < 0.44) sfx('splash', { volume: rand(0.08, 0.15), pitch: rand(0.48, 0.68) });
              else if (r < 0.74) sfx('gull', { volume: rand(0.10, 0.18), pitch: rand(1.0, 1.4) });
              else sfx('cheer', { volume: rand(0.04, 0.09), pitch: rand(1.1, 1.4) });
              ambTimer = rand(5, 12);
            } else {
              // Out in the stream it should mostly be nothing — and when it is
              // something, it is the bell on the yellow buoy at the turn, which
              // is the one sound on this harbour you can navigate by.
              const nearTurn = capy && capy.position &&
                Math.hypot(capy.position.x - 100, capy.position.z + 516) < 150;
              if (nearTurn && r < 0.24) {
                sfx('chime', { volume: rand(0.07, 0.13), pitch: rand(0.52, 0.66) });
                ambTimer = rand(6, 12);
              } else if (r < 0.50) {
                sfx('splash', { volume: rand(0.05, 0.11), pitch: rand(0.44, 0.64) });
                ambTimer = rand(8, 17);
              } else if (r < 0.80) {
                sfx('gull', { volume: rand(0.06, 0.12), pitch: rand(1.2, 1.7) });
                ambTimer = rand(9, 19);
              } else {
                // and once in a long while, the other ferry's engine, from
                // wherever she actually is
                const far = qy && typeof qy.freshwaterRange === 'function' ? qy.freshwaterRange() : 999;
                sfx('hiss', { volume: clamp(0.16 - far * 0.0006, 0.03, 0.13), pitch: rand(0.30, 0.44) });
                ambTimer = rand(11, 22);
              }
            }
          } else if (bio === 'kyoto') {
            // A VALLEY IS NOT ONE SOUND. This was a single distant chime every
            // sixteen to thirty-four seconds for the whole chapter — the
            // thinnest bed in the game — over a place that contains a bamboo
            // grove, a river running at six metres a second, a temple bell and
            // a pond with a heron in it. Positional, like the harbour's.
            const kk = game.kyoto;
            const kp = capy && capy.position;
            const inGrove = !!(kk && kp && kk.inZone && kk.inZone('bamboo', kp.x, kp.z));
            const onRiver = !!(kk && kp && (kk.inRiver() || (kp.z > 100 && kp.z < 170)));
            const r = Math.random();
            if (inGrove) {
              // A grove of eighteen-metre culms in any wind at all knocks
              // against itself, and that hollow clack is the entire reason
              // anybody goes to Arashiyama.
              if (r < 0.6) sfx('tick', { volume: rand(0.10, 0.19), pitch: rand(0.30, 0.46) });
              else sfx('rustle', { volume: rand(0.08, 0.15), pitch: rand(1.2, 1.7) });
              ambTimer = rand(2.4, 6.0);
            } else if (onRiver) {
              if (r < 0.62) sfx('hiss', { volume: rand(0.09, 0.16), pitch: rand(0.85, 1.20) });
              else if (r < 0.86) sfx('splash', { volume: rand(0.06, 0.12), pitch: rand(0.7, 1.0) });
              else sfx('gull', { volume: rand(0.04, 0.08), pitch: rand(0.42, 0.56) });
              ambTimer = rand(4, 9);
            } else if (r < 0.42) {
              sfx('chime', { volume: rand(0.12, 0.22), pitch: rand(0.44, 0.58) });
              ambTimer = rand(16, 34);
            } else if (r < 0.72) {
              sfx('rustle', { volume: rand(0.05, 0.10), pitch: rand(0.9, 1.3) });
              ambTimer = rand(9, 19);
            } else {
              // a bush warbler, twice, a long way off
              sfx('pop', { volume: rand(0.04, 0.09), pitch: rand(2.6, 3.4) });
              ambTimer = rand(13, 26);
            }
          } else if (bio === 'cali') {
            // Two lines became four, and one of them is where you are standing:
            // the cane field east is a hundred metres of dry leaf in the wind
            // and it is the quietest part of the chapter, which is the whole
            // point of 'nobody can see you'.
            const cp = capy && capy.position;
            const inCane = !!(cp && cp.x > 62 && cp.z > -46 && cp.z < 74);
            const r = Math.random();
            if (inCane) {
              if (r < 0.66) sfx('rustle', { volume: rand(0.10, 0.18), pitch: rand(0.7, 1.0) });
              else sfx('pop', { volume: rand(0.04, 0.08), pitch: rand(2.4, 3.2) });
              ambTimer = rand(4, 10);
            } else if (r < 0.34) {
              sfx('horn', { volume: rand(0.10, 0.18), pitch: rand(1.5, 2.1) });
              ambTimer = rand(7, 15);
            } else if (r < 0.62) {
              sfx('strum', { volume: rand(0.10, 0.20), pitch: rand(1.2, 1.7) });
              ambTimer = rand(7, 15);
            } else if (r < 0.82) {
              // somebody's radio two streets over, and a dog
              sfx('cheer', { volume: rand(0.04, 0.09), pitch: rand(1.0, 1.35) });
              ambTimer = rand(9, 18);
            } else {
              sfx('bark', { volume: rand(0.05, 0.10), pitch: rand(0.9, 1.3) });
              ambTimer = rand(11, 22);
            }
          } else if (bio === 'rio') {
            // Copacabana from the pavement: surf, and every so often a whistle
            // off the beach or a cheer from the sand. Not drums — the bateria is
            // the SCORE here, and an ambient drum would fight the thing the
            // player is being asked to listen to.
            const r = Math.random();
            if (r < 0.5) sfx('splash', { volume: rand(0.07, 0.13), pitch: rand(0.5, 0.7) });
            else if (r < 0.8) sfx('gull', { volume: rand(0.08, 0.14), pitch: rand(1.1, 1.4) });
            else sfx('cheer', { volume: rand(0.05, 0.10), pitch: rand(0.9, 1.2) });
            ambTimer = rand(6, 13);
          } else if (bio === 'iceland') {
            // The quietest soundscape in the game, and it should be: wind off
            // the ice, water on the harbour wall, and once in a very long while
            // a bird. Anything busier and the point of the place is gone.
            const r = Math.random();
            if (r < 0.55) sfx('hiss', { volume: rand(0.09, 0.17), pitch: rand(0.35, 0.5) });
            else if (r < 0.8) sfx('splash', { volume: rand(0.05, 0.10), pitch: rand(0.4, 0.6) });
            else sfx('gull', { volume: rand(0.06, 0.11), pitch: rand(1.3, 1.7) });
            ambTimer = rand(13, 28);
          } else if (bio === 'drift') {
            // The emptiest soundscape in the game, emptier even than Iceland's:
            // a long way off, a bell that nobody is ringing, and wind that is
            // ONLY audible when there is actually wind. The gap between them is
            // most of the atmosphere — a place with nobody in it should mostly
            // be the sound of nobody being in it.
            const dr = game.drift;
            const w = dr ? dr.windSpeed() : 0;
            if (w > 1.5) {
              sfx('hiss', { volume: clamp(0.05 + w * 0.045, 0.05, 0.20), pitch: rand(0.30, 0.46) });
              ambTimer = rand(5, 11);
            } else {
              sfx('chime', { volume: rand(0.08, 0.16), pitch: rand(0.36, 0.52) });
              ambTimer = rand(15, 32);
            }
          } else if (bio === 'venice') {
            // A city with no cars in it. Water on stone, a bell a long way off,
            // and gulls — which are the loudest thing in Venice by some margin
            // and are why nobody sleeps late in San Marco. When the water is up
            // it is nothing but water, because that is exactly what it is like.
            const ve = game.venice;
            const tide = ve ? ve.tide() : 0;
            const r = Math.random();
            if (tide > 0.5) {
              sfx('splash', { volume: rand(0.08, 0.16), pitch: rand(0.5, 0.75) });
              ambTimer = rand(3.5, 8);
            } else if (r < 0.4) {
              sfx('splash', { volume: rand(0.05, 0.10), pitch: rand(0.7, 1.0) });
              ambTimer = rand(6, 13);
            } else if (r < 0.75) {
              sfx('gull', { volume: rand(0.09, 0.16), pitch: rand(1.0, 1.35) });
              ambTimer = rand(7, 16);
            } else {
              sfx('chime', { volume: rand(0.10, 0.18), pitch: rand(0.5, 0.66) });
              ambTimer = rand(14, 30);
            }
          } else if (bio === 'kowloon') {
            // The densest soundscape in the game, and it should be: a horn, a
            // shutter, somebody shouting, and under all of it the fact that
            // there are eleven thousand people on this street. During the show
            // it goes QUIET — everybody on the pavement has stopped to watch,
            // and the silence is what tells you something is happening.
            const hk = game.kowloon;
            const show = hk ? hk.show() : 0;
            if (show > 0.4) {
              if (Math.random() < 0.6) sfx('cheer', { volume: rand(0.06, 0.12), pitch: rand(1.0, 1.3) });
              else sfx('chime', { volume: rand(0.05, 0.10), pitch: rand(1.5, 2.0) });
              ambTimer = rand(5, 11);
            } else {
              const r = Math.random();
              if (r < 0.42) sfx('horn', { volume: rand(0.09, 0.16), pitch: rand(1.9, 2.4) });
              else if (r < 0.68) sfx('cheer', { volume: rand(0.06, 0.11), pitch: rand(1.2, 1.6) });
              else if (r < 0.86) sfx('rustle', { volume: rand(0.08, 0.15), pitch: rand(0.8, 1.2) });
              else sfx('pop', { volume: rand(0.05, 0.09), pitch: rand(0.6, 0.9) });
              ambTimer = rand(3.5, 8);
            }
          } else if (bio === 'palawan') {
            // ABOVE THE WATER: a beach, and beaches are loud in a way people
            // forget — surf, a gull, and a two-stroke engine somewhere.
            // UNDER IT: almost nothing, and that is the whole point. The
            // silence when the animal goes down is the single most effective
            // thing in the chapter and it costs nothing at all to build.
            // THE SILENCE UNDER THE WATER IS DOING LESS WORK THAN IT WAS.
            // palawan.js now runs the reef's own crackle — several thousand
            // snapping shrimp, which is the actual sound of a coral garden and
            // exists nowhere above the waterline — so the ambience's job down
            // here is only the far-off boom and, during the bloom, the shimmer.
            const sub = game.palawan ? game.palawan.submerged() : 0;
            const bloom = game.palawan ? game.palawan.bloom() : 0;
            if (sub > 0.5) {
              if (bloom > 0.4 && Math.random() < 0.55) {
                sfx('chime', { volume: rand(0.07, 0.15), pitch: rand(1.8, 2.6) });
                ambTimer = rand(2.4, 5.5);
              } else {
                sfx('splash', { volume: rand(0.02, 0.05), pitch: rand(0.30, 0.45) });
                ambTimer = rand(11, 22);
              }
            } else {
              const r = Math.random();
              if (r < 0.46) sfx('splash', { volume: rand(0.07, 0.14), pitch: rand(0.5, 0.8) });
              else if (r < 0.74) sfx('gull', { volume: rand(0.08, 0.15), pitch: rand(1.1, 1.5) });
              else if (r < 0.90) sfx('rustle', { volume: rand(0.06, 0.12), pitch: rand(0.6, 0.9) });
              else sfx('pop', { volume: rand(0.04, 0.08), pitch: rand(0.5, 0.7) });
              ambTimer = rand(5, 12);
            }
          } else if (bio === 'goreme') {
            // Five in the morning in a valley: a dog two kilometres away, wind
            // in a poplar, and — every fifteen or twenty seconds, from all over
            // the valley at once — the sound of a burner. That last one is the
            // whole soundscape, because it is what tells you the other hundred
            // and fifty balloons are real.
            // ---- AND THE HIGHER YOU GO THE QUIETER IT GETS -------------
            // The one thing everybody says about a balloon is that it is
            // silent, and what they actually mean is that the GROUND goes
            // quiet: there is no engine to be loud, no slipstream because you
            // are travelling with the air, and the dogs and the roosters and
            // the fans fall away underneath you. This chapter put the player a
            // hundred and fifty metres up and played exactly the same village
            // at exactly the same volume. `sky` is 0 on the ground and 1 by a
            // hundred and twenty metres, and everything except the burner over
            // your own head is multiplied by what is left of it — so the climb
            // has a sound, and the sound is things going away.
            //
            // The burners are no longer fired from here at all: goreme.js makes
            // one on the rising edge of every envelope that actually lights, at
            // the volume its own distance says, which is a sound that TELLS you
            // something. A hiss on a random timer told you nothing.
            const g = game.goreme;
            const alt = g ? g.altitude() : 0;
            const aboard = !!(g && g.aboard());
            const sky = aboard ? clamp(alt / 120, 0, 1) : 0;
            const gnd = 1 - sky * 0.92;
            const r = Math.random();
            if (aboard && g.burner() > 0.4) {
              // ...and the one over your head gets LOUDER with height, because
              // it is the only thing left to hear
              sfx('hiss', { volume: rand(0.16, 0.26) * (1 + sky * 0.5), pitch: rand(1.4, 1.9) });
              ambTimer = rand(0.5, 1.1);
            } else if (r < 0.34) {
              // a dog, two kilometres away, answered by another one
              sfx('bark', { volume: rand(0.05, 0.10) * gnd, pitch: rand(0.55, 0.85) });
              ambTimer = rand(6, 13) * (1 + sky * 1.6);
            } else if (r < 0.60) {
              sfx('rustle', { volume: rand(0.06, 0.12) * gnd, pitch: rand(0.5, 0.8) });
              ambTimer = rand(7, 15) * (1 + sky * 1.6);
            } else if (r < 0.84 && alt < 6) {
              sfx('gull', { volume: rand(0.05, 0.10) * gnd, pitch: rand(0.55, 0.8) });
              ambTimer = rand(10, 22);
            } else {
              sfx('chime', { volume: rand(0.07, 0.14) * gnd, pitch: rand(0.45, 0.62) });
              ambTimer = rand(14, 30) * (1 + sky * 1.6);
            }
          } else if (bio === 'sahara') {
            // The medina and the erg are two different soundscapes and the one
            // you get is decided by where you are standing, which is the only
            // place in the game an ambience is positional. In the storm it is
            // nothing but wind, and that is the whole idea.
            const sa = game.sahara;
            const st = sa ? sa.storm() : 0;
            const east = capy && capy.position && capy.position.x > 150;
            if (st > 0.25) {
              sfx('hiss', { volume: rand(0.20, 0.34), pitch: rand(0.7, 1.1) });
              ambTimer = rand(1.4, 3.0);
            } else if (east) {
              sfx('hiss', { volume: rand(0.06, 0.13), pitch: rand(0.5, 0.8) });
              ambTimer = rand(9, 20);
            } else {
              const r = Math.random();
              if (r < 0.4) sfx('horn', { volume: rand(0.07, 0.13), pitch: rand(1.7, 2.3) });
              else if (r < 0.7) sfx('cheer', { volume: rand(0.05, 0.10), pitch: rand(1.1, 1.4) });
              else sfx('strum', { volume: rand(0.09, 0.16), pitch: rand(0.7, 1.0) });
              ambTimer = rand(5, 12);
            }
          } else if (bio === 'manly') {
            // A surf beach is the loudest quiet place there is, and the thing
            // that makes it sound like one is NOT a loop of surf — it is that
            // the surf comes in EVENTS, eight and a half seconds apart, and
            // manly.js already fires those from the break itself. What is left
            // for the ambience is everything on the sand: gulls, a whistle
            // from the tower, and somebody's radio.
            const r = Math.random();
            if (r < 0.42) {
              sfx('gull', { volume: rand(0.09, 0.17), pitch: rand(0.95, 1.3) });
              ambTimer = rand(5, 12);
            } else if (r < 0.62) {
              sfx('whistle', { volume: rand(0.06, 0.11), pitch: rand(1.5, 1.9) });
              ambTimer = rand(12, 26);
            } else if (r < 0.82) {
              sfx('cheer', { volume: rand(0.04, 0.09), pitch: rand(1.2, 1.5) });
              ambTimer = rand(10, 20);
            } else {
              sfx('hiss', { volume: rand(0.07, 0.13), pitch: rand(1.1, 1.5) });
              ambTimer = rand(8, 16);
            }
          } else if (bio === 'pantanal') {
            // The Pantanal at five in the afternoon is the single noisiest
            // habitat on earth and every noise in it is a bird. It is also the
            // one soundscape here that should never go quiet for long, because
            // the SILENCE in that place means something has walked in.
            // ...AND IT IS A DIFFERENT PLACE AT SUNDOWN. The crossing switches
            // the evening on and `dusk()` already runs the sky, the grade, the
            // water, the lilies, the fireflies and the fazenda's windows — and
            // the soundscape went on being four in the afternoon for the rest
            // of the chapter. The changeover at dusk in that place is the most
            // dramatic thing about it: the birds stop within about ten minutes
            // and the frogs and the insects take the whole sky over. Same
            // positional argument as the Sahara's medina and the Antarctic
            // pack, on a clock the player caused rather than on a position.
            const pdk = (game.pantanal && game.pantanal.dusk) ? clamp(game.pantanal.dusk(), 0, 1) : 0;
            const r = Math.random();
            const frogs = r < pdk * 0.72;
            if (frogs) {
              // the frog wall. Two notes, very close together, and the gap
              // between them shrinks to nothing as the light goes.
              if (Math.random() < 0.6) sfx('tick', { volume: rand(0.06, 0.13) * pdk, pitch: rand(0.5, 0.7) });
              else sfx('bark', { volume: rand(0.05, 0.11) * pdk, pitch: rand(1.5, 2.0) });
              ambTimer = rand(0.9, 2.4);
            } else if (r < 0.30) sfx('gull', { volume: rand(0.08, 0.15) * (1 - pdk * 0.7), pitch: rand(0.55, 0.85) });
            else if (r < 0.52) sfx('pop', { volume: rand(0.07, 0.13), pitch: rand(2.2, 3.0) });
            else if (r < 0.72) sfx('chime', { volume: rand(0.05, 0.11), pitch: rand(1.6, 2.2) });
            else if (r < 0.88) sfx('rustle', { volume: rand(0.07, 0.13), pitch: rand(0.8, 1.2) });
            else sfx('bark', { volume: rand(0.05, 0.10), pitch: rand(0.6, 0.9) });
            if (!frogs) ambTimer = rand(2.6, 6.5) * (1 - pdk * 0.45);
          } else if (bio === 'antarctic') {
            // THE EMPTIEST SOUNDSCAPE IN THE GAME, emptier than the Drift's,
            // and it is the whole point of the place: sea ice grinding
            // against itself, a colony a long way upwind, and a very long
            // gap. But it is not empty in the same way everywhere — in
            // thick pack you hear the pack, because you are IN it, and
            // when the orcas are on you the gap closes right down. Both
            // are positional, which is the sahara rule.
            const an = game.antarctic;
            const packK = an ? an.pack() : 0;
            const podK = an ? an.withPod() : 0;
            const rr = Math.random();
            if (podK > 0.35) {
              if (rr < 0.55) sfx('splash', { volume: rand(0.12, 0.22), pitch: rand(0.36, 0.52) });
              else sfx('hiss', { volume: rand(0.10, 0.18), pitch: rand(0.28, 0.40) });
              ambTimer = rand(2.2, 5.0);
            } else if (packK > 0.4) {
              sfx('rustle', { volume: rand(0.07, 0.14), pitch: rand(0.34, 0.52) });
              ambTimer = rand(5, 11);
            } else if (rr < 0.34) {
              sfx('hiss', { volume: rand(0.07, 0.14), pitch: rand(0.26, 0.40) });
              ambTimer = rand(12, 26);
            } else if (rr < 0.62) {
              sfx('bark', { volume: rand(0.05, 0.11), pitch: rand(1.7, 2.4) });
              ambTimer = rand(9, 19);
            } else if (rr < 0.84) {
              sfx('splash', { volume: rand(0.05, 0.10), pitch: rand(0.40, 0.60) });
              ambTimer = rand(10, 21);
            } else {
              sfx('gull', { volume: rand(0.05, 0.10), pitch: rand(1.6, 2.1) });
              ambTimer = rand(16, 34);
            }
          } else if (bio === 'cave') {
            // AND THE OPPOSITE, WHICH IS THE POINT OF IT. Four sounds, all of
            // them small, all of them a very long way apart: water on stone, a
            // rock deciding to move, and a swiftlet clicking. A cave is not
            // silent, it is EMPTY, and the difference between the two is that
            // an empty place lets you hear how big it is.
            const r = Math.random();
            if (r < 0.44) sfx('tick', { volume: rand(0.10, 0.19), pitch: rand(0.35, 0.55) });
            else if (r < 0.70) sfx('splash', { volume: rand(0.05, 0.10), pitch: rand(0.4, 0.62) });
            else if (r < 0.88) sfx('pop', { volume: rand(0.05, 0.10), pitch: rand(3.0, 4.2) });
            else sfx('thud', { volume: rand(0.05, 0.11), pitch: rand(0.28, 0.42) });
            ambTimer = rand(6, 17);
          } else {
            // THROUGH sfx(), NEVER sfxGull() DIRECTLY. The direct call passed no
            // volume, so pk went NaN, exponentialRampToValueAtTime threw, and the
            // throw landed in systems.update — four strikes and main.js dropped
            // the whole module, taking the camera, the input poll and the HUD with
            // it. That is the "capybara walks out of frame and everything freezes"
            // bug, and it could only ever fire in Sydney and Quay because every
            // other biome above already goes through the dispatcher. The defaults
            // it fills in (volume 1, pitch 1) are exactly what the bare call meant.
            sfx('gull');
            ambTimer = rand(8, 20);
          }
        }
      }
    }

    // ---- music intensity: a shift in mood on a chase, never a stinger ----
    if (musChaseT > 0) musChaseT -= dt;
    const musWant = clamp(game.state.chaos * 0.7 + (musChaseT > 0 ? 0.55 : 0), 0, 1);
    musIntensity = damp(musIntensity, musWant, musChaseT > 0 ? 0.9 : 0.35, dt);
    musApplyT += dt;
    if (musApplyT > 0.3 && musPad && ac.state === 'running') {
      musApplyT = 0;
      const nowA = ac.currentTime;
      // duck the pad a touch and open the filter — plus denser plucks (scheduler).
      // The base values come from the live chapter palette, so a chapter change
      // glides the mix as well as the key.
      // A set piece leans on the same two parameters as a chase, in the opposite
      // direction: a chase DUCKS the pad to make room for the noise, a wow opens
      // it. Both are folded in here because this is the only writer either
      // parameter has — see musSwell().
      const lift = musLift * musLiftEnv();
      musPad.gain.setTargetAtTime(musPal.bus * (1 - musIntensity * 0.3) * (1 + 0.5 * lift),
        nowA, lift > 0.02 ? 0.6 : 1.2);
      musFilt.frequency.setTargetAtTime(musPal.cut + musIntensity * 780 + lift * 1100,
        nowA, lift > 0.02 ? 0.7 : 1.4);
      musBassGain.gain.setTargetAtTime(musPal.bass + musIntensity * 0.08 + lift * 0.05, nowA, 1.5);
      // the thickening layer: silent at zero tasks, a shimmer at all of them
      if (musShimGain) musShimGain.gain.setTargetAtTime(0.0001 + musProg * 0.85, nowA, 2.5);
      // ---- THE AURORA'S CHOIR ------------------------------------------
      // One number, one gain, and a two-and-a-half second time constant so it
      // arrives the way the sky does. Everywhere but under an Icelandic aurora
      // this target is zero and the four voices cost nothing but their phase.
      if (musChoirGain) {
        const want = inIce ? auroraT * auroraT * 0.62 : 0;
        musChoirLevel = want;
        musChoirGain.gain.setTargetAtTime(0.0001 + want, nowA, 2.5);
      }
      // ---- AND THE LIFT ------------------------------------------------
      // Written here rather than in musSwell so that ONE gain node is ever
      // scheduled on this parameter: a swell fired while the last one is still
      // ringing (two set pieces inside ten seconds is rare but not impossible)
      // otherwise leaves two overlapping ramps fighting over the same gain and
      // the level lands wherever the race lands it.
      if (musLiftGain) {
        musLiftGain.gain.setTargetAtTime(0.0001 + musLift * musLiftEnv(), nowA, 0.55);
      }
    }
    // The lift's clock. Off the frame timer, not the audio clock, because it is
    // an ENVELOPE the mix reads and not a scheduled note — and it has to keep
    // running while the context is suspended, or an alt-tab in the middle of the
    // aurora comes back to a swell that is permanently up.
    if (musLiftT > 0) {
      musLiftT -= dt;
      if (musLiftT <= 0) { musLiftT = 0; musLift = 0; }
    }
    // ---- the gnawa's two live inputs -----------------------------------
    // Read every frame rather than in the 0.3 s music block, because the storm
    // stripping the band is the loudest thing that happens in chapter 8 and a
    // third of a second of latency on it is audible.
    if (inSah && game.sahara) {
      musGnawaStrip = damp(musGnawaStrip, clamp(game.sahara.storm() * 1.15, 0, 1), 1.6, dt);
      musGnawaBuild = damp(musGnawaBuild,
        clamp((game.sahara.onFire() ? 1 : 0) * 0.75 + game.sahara.dusk() * 0.35, 0, 1), 1.1, dt);
    } else if (musGnawaStrip > 0.001 || musGnawaBuild > 0.001) {
      musGnawaStrip = damp(musGnawaStrip, 0, 3, dt);
      musGnawaBuild = damp(musGnawaBuild, 0, 3, dt);
    }
    // ---- and the other two live inputs, on the same terms -----------------
    // Both are read from the LIVE biome and damped to zero everywhere else, for
    // the reason every biome query in this file is: game.venice keeps answering
    // about a tide long after you have left the lagoon.
    musVenTide = damp(musVenTide,
      inVen && game.venice ? clamp(game.venice.tide(), 0, 1) : 0, 1.5, dt);
    musHkShow = damp(musHkShow,
      inHk && game.kowloon ? clamp(game.kowloon.show(), 0, 1) : 0, 2.2, dt);

    // ---- the save file ---------------------------------------------------
    if (savePending) {
      saveT += dt * 1000;
      if (saveT >= sysSAVE_DEBOUNCE) saveWrite();
    }
    if (jrShown) jrRefresh();

    confettiStep(dt);

    // ---- perf readout ----
    fpsAcc += dt; fpsFrames++;
    if (fpsAcc >= 0.5) {
      fps = fpsFrames / fpsAcc;
      fpsAcc = 0; fpsFrames = 0;
    }
    // adaptive resolution — trade pixels for frames on weak integrated GPUs
    dprT += dt;
    if (dprT > 2) {
      dprT = 0;
      if (fps < 50 && dprScale > 0.7) { dprScale -= 0.15; applyDPR(); }
      else if (fps > 58 && dprScale < 1) { dprScale = Math.min(1, dprScale + 0.1); applyDPR(); }
    }
    if (perfOn) {
      perfAcc += dt;
      if (perfAcc >= 0.35) {
        perfAcc = 0;
        const info = renderer.info.render;
        perfEl.textContent =
          'fps    ' + fps.toFixed(0) + '\n' +
          'calls  ' + info.calls + '\n' +
          'tris   ' + info.triangles + '\n' +
          'bodies ' + (game.world ? game.world.bodies.length : 0) + '\n' +
          'biome  ' + (game.biome ? game.biome.current : '-') + '\n' +
          'props  ' + game.props.length + '  npcs ' + game.npcs.length + '\n' +
          'shadow ' + (renderer.shadowMap.enabled ? 'on' : 'off') + '  dpr ' +
            renderer.getPixelRatio().toFixed(2);
      }
    }

    // Edge flags are set at the event source and cleared here, at the very end of
    // the frame, so every earlier module has already seen them.
    input.honkPressed = false; input.actionPressed = false; input.whistlePressed = false;
    input.jumpPressed = false;
    honkPend = false; touchHonkPend = false;
    actionPend = false; touchActionPend = false;
    whistlePend = false; touchWhistlePend = false;
    jumpPend = false; touchJumpPend = false;

    // ...AND THE PAD'S EDGES ARE PUBLISHED HERE, AFTER THE CLEAR.
    // A pad has no event to latch at, and systems runs last: a press written at
    // the top of update() would be wiped four lines above this one, on the same
    // frame, having been seen by nobody. Published here it survives into the
    // next frame, where capybara.js — which runs BEFORE systems — reads it with
    // the held flag already true and agreeing with it. That is one frame of
    // latency and it is the only correct place for them.
    if (padEdgeHonk)   { input.honkPressed = true; input.whistlePressed = true; padEdgeHonk = false; }
    if (padEdgeAction) { input.actionPressed = true; padEdgeAction = false; }
    if (padEdgeJump)   { input.jumpPressed = true; padEdgeJump = false; }
  }

  return { update: update, sun: sun, hemi: hemi };
}
