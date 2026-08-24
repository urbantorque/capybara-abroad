import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, TASKS, rand, randInt, clamp, damp, lerp } from './shared.js';

// ===========================================================================
// AGENT B — THE CAPYBARA
// Low-poly mesh, procedural rig, snappy acceleration controls, compound-sphere
// physics body, grab / wheek / dig / swim. Everything prefixed `capy`.
// ===========================================================================

// --- dimensions ------------------------------------------------------------
const capyR = 0.34;                 // collision sphere radius
const capyFOOT_Y = 0.34;            // resting body-centre height on flat ground
const capySPAWN = { x: 0, y: 1.2, z: 22 };
const capyWALK = 4.2;
const capyRUN = 7.4;
const capySWIM_SPEED = 2.6;
const capyACCEL = 55;
const capyAIR_CONTROL = 0.35;
const capyTURN_LAMBDA = 15;         // nose onto the stick in ~0.2 s, not ~0.25
const capySTOP_LAMBDA = 14;
// --- STANDING STILL IS NOW THE CONTROLLER'S JOB ----------------------------
// The ground contact is frictionless (see props.js), so this damper is the
// capybara's entire grip on the world. At capySTOP_LAMBDA it is enough to stop a
// run on flat ground but NOT enough to stand on Galeras: measured on a 50-degree
// flank, gravity's downhill component won and the capybara slid at 1.89 m/s.
// A stiffer damper plus a snap-to-zero below walking pace is static friction —
// it only ever runs when the stick is centred, so it cannot fight the player,
// and capyShove is applied after it, so a rolling bin still knocks you about.
const capyGRIP_LAMBDA = 60;         // idle, grounded: how hard the feet hold
const capyGRIP_SNAP = 0.9;          // m/s below which idle motion is simply over
// --- SLIP: WHEN THE GROUND STOPS HOLDING YOU (chapter 7) --------------------
// Everything above is written for ground that grips. A glacier does not, and a
// dune face only half does, so a biome may publish groundSlip(x, z) -> 0..1 and
// this module blends four things against it:
//
//   grip     x (1 - slip)      the damper above is what standing still IS, so
//                              turning it off IS the slide
//   control  x (1 - slip*0.8)  you can still steer, badly, which is the fun
//   cap      x (1 + slip*K)    the speed ceiling has to rise or the controller
//                              claws back everything gravity just gave you
//   shrink   softened          and it has to come back down gently, or the cap
//                              reads as a rev limiter rather than as terminal
//                              velocity
//
// The FORWARD force is not touched, and does not need to be: the ground contact
// is already frictionless (see props.js), so on a slope the contact normal on
// its own accelerates the body downhill. Removing the damper IS the mechanic.
// SLIP IS LINEAR IN THE TERMINAL VELOCITY, NOT IN THE DAMPER. This is the one
// thing about the whole mechanic that has to be got right and the obvious way
// is wrong, so it is worth the paragraph.
//
// The damper does not merely slow a slide down: it SETS the speed the slide
// settles at. Gravity supplies a constant downhill acceleration a, the damper
// removes L times the current speed, and the two balance at v = a/L. So the
// player-facing quantity is 1/L, and interpolating L is interpolating the
// wrong end of a reciprocal:
//
//   grip x (1 - slip), slip 0.5  ->  L = 30  ->  v = 0.3 m/s   ("it is not
//   grip x (1 - slip), slip 0.97 ->  L = 1.8 ->  v = 4.8 m/s    working")
//
// Both were measured. 0.97 was the first cut and an instrumented run down the
// glacier came back at 4.9 m/s — a slightly downhill WALK — and every value of
// slip below about 0.95 was indistinguishable from full grip, which made a
// half-slippery dune face impossible to express at all.
//
// Interpolating 1/L instead makes slip mean exactly what it looks like it
// means. Half slip is half the terminal speed of full slip, and sand can be a
// real material rather than either ice or concrete:
//
//   slip 0.00  ->  L = 60     ->  stands still on anything
//   slip 0.35  ->  L = 1.19   ->  a firm sand slope, ~6 m/s
//   slip 0.72  ->  L = 0.58   ->  the great dune, ~13 m/s
//   slip 1.00  ->  L = 0.42   ->  the glacier, ~19 m/s
const capyGRIP_ICE  = 0.42;         // the residual damper at full slip
const capySLIP_CTRL = 0.80;         // how much steering authority slip takes
const capySLIP_CAP  = 1.65;         // extra top speed, as a multiple, at full slip
const capySLIP_LAM  = 8.2;          // how much gentler the cap comes back down
// --- THE CLIMB (chapter 11) -------------------------------------------------
// Ten chapters of locomotion are horizontal plus a hop. The Drift added air but
// not HEIGHT — you fall further, you do not go up. Hong Kong is a city where the
// only direction with any room left in it is up, so it gets the one verb this
// game has never had, and it is built the way slip and wind were: the biome
// publishes a hook, capybara.js owns the solve, and nine chapters that never
// publish it are untouched.
//
// A biome answers climbHold(x, y, z) with the outward normal of the face that is
// within reach, or null. Hold the GRAB key against it and the animal clings.
// The stick is then read against that face rather than against the ground:
// pushing INTO the wall goes up, pulling away goes down, sideways shuffles.
// That mapping is the whole reason this needs no new key — with the camera
// behind the capybara and the wall in front of it, W is up, and it is up for the
// same reason W is forward.
const capyCLIMB_UP    = 3.05;       // m/s of climb, pushing into the face
const capyCLIMB_DOWN  = 4.10;       // coming back down is faster, as it should be
const capyCLIMB_SIDE  = 2.35;       // m/s of shuffle across the face
// A DEADZONE ON THE SHUFFLE, and it is not a nicety.
// The stick is resolved onto the face with two dot products, so a camera that
// is a fifth of a radian off square turns 'hold forward' into a small constant
// sideways component — measured, a straight climb walked 3.8 m along the face in
// eight seconds and out from under the only gap in the scaffold's decks. The
// player meant UP. Below this, they get up.
const capyCLIMB_DEAD  = 0.30;
const capyCLIMB_STICK = 1.60;       // m/s pulled toward the face, so it holds
// MEASURED AGAINST THE ACTUAL CLIMB. The scaffold in chapter 11 is thirty-five
// metres and the climb rate is 3.05 m/s, so a full ascent is 11.4 seconds — at
// the first value here (0.115, times a factor that peaked at 1.3) that cost
// 1.7 bars of a bar that holds 1.0, and the marquee climb was not merely hard,
// it was arithmetically impossible. At 0.042 a full unbroken ascent costs about
// half the bar, hanging still costs nothing at all, and the working decks every
// six metres are somewhere to get it back.
const capyCLIMB_STAM  = 0.042;      // stamina per second of CLIMBING (not of hanging)
const capyCLIMB_KICK  = 5.20;       // m/s pushed off the wall by a hop
const capyCLIMB_KICKY = 5.60;       // and up
const capyCLIMB_COOL  = 0.34;       // s before the wall will take you back
const capyGRAB_RADIUS = 1.6;
const capyGRAB_WINDUP = 0.10;
const capyDIG_TIME = 0.34;
const capyWET_DECAY = 1 / 8;
// --- the waterline, and everything measured from it -------------------------
// See capyWaterY(). These are OFFSETS from the live biome's waterLevel, not
// world heights, so a biome may move its sea. At the −0.5 every biome but
// Venice uses they are numerically identical to the constants they replaced.
const capyFLOAT_OFF = 0.08;         // body-centre rides this far over the surface
const capySWIM_ENTER = 0.70;        // below surface + this, the animal is swimming
const capySWIM_MEM_H = 2.10;        // "there was water under me" reaches this high
const capySWIM_OUT_H = 0.60;        // standing this far over the surface = out
// --- GOING UNDER (chapter 12) ----------------------------------------------
// Twelve chapters in which the water was a wall, a floor or a road, and the
// animal paddling across the top of it like a duck. A capybara is the best
// swimmer of any rodent alive and holds its breath for five minutes; the one
// thing it had never been allowed to do was the thing it is FOR.
//
// Built the way slip, wind, the river and the climb were built: the biome
// publishes one flag, capybara.js owns the solve, and the twelve chapters that
// never publish it are untouched to the last decimal.
//
//   HOLD E IN THE WATER  ->  down          (release -> up, on its own buoyancy)
//   SPACE                ->  a hard kick for the surface, and the dive is over
//   breath               ->  the stamina bar, because that is what it is
//
// E is also the grab key, and that is deliberate rather than survivable: the
// grace window below means a TAP of E underwater fires the grab edge without
// ending the dive, so "hold to stay down, tap to take things" is one key doing
// two jobs and neither of them fights the other.
const capyDIVE_V      = 2.05;       // m/s of descent under a held key
const capyDIVE_SPEED  = 3.10;       // horizontal, and FASTER than paddling (it is)
const capyDIVE_GRACE  = 0.42;       // s of held depth after the key comes up
const capyDIVE_FLOOR  = 0.55;       // how far off the seabed the animal levels out
// HOW MUCH WATER MAKES A DIVE (v19). Under this it is a puddle and holding E in
// it would be a key that does nothing. 1.75 leaves 1.2 m of travel once the
// animal has levelled out capyDIVE_FLOOR off the bottom, which is enough to be
// under, to be worth it, and to be visibly a decision. See capyCanDive.
const capyDIVE_MIN_D  = 1.75;
const capyRISE_MAX    = 3.60;       // cap on the buoyancy spring — see the note by it
const capySTAM_BREATH = 0.0620;     // per second under water -> about sixteen seconds
const capySTRIDE = 0.62;            // metres of ground per half gait cycle (~= foot arc)
// --- solver-friendly tuning (velocity space only — we never write position) --
const capyGROUND_KP = 9;            // floor recovery gain, metres of gap -> m/s
const capyGROUND_SLOP = 0.02;       // penetration we simply ignore (real contacts own it)
const capyGROUND_VMAX = 3.0;        // cap on the corrective rise so it can't launch
const capyVOID_Y = -3;              // below this we genuinely fell out of the world
// --- THE HOP THAT ATE THE MOVEMENT -----------------------------------------
// The contact equation does not merely stop the body, it pushes accumulated
// penetration out — and at contactEquationStiffness 1e7 that push-out arrives as
// velocity. MEASURED walking flat ground at a metronome 60 Hz: the solver handed
// the body +0.80 m/s upward on the frame it touched, which is a 13 mm hop with a
// four-frame flight time, so the capybara had ground contact on ONE FRAME IN
// FIVE. Friction scales with the NORMAL IMPULSE, not with weight, so each of
// those landings was an impact and took 1.60 m/s of horizontal speed with it —
// 96 m/s^2, five times what resting friction on this contact can apply. The
// trace was exactly periodic: vx 2.97 -> 1.37, then four frames climbing back at
// the controller's accel limit, for ever. That is the reported jerk, and it is
// also why a 4.2 m/s walk measured 2.9.
// The cure is to refuse the launch. Sitting in continuous contact, the normal
// impulse per step is only m*g*dt, friction becomes a 0.36 m/s-per-frame drag the
// controller trivially covers, and the gait stops being a bounce.
const capyREST_BAND = 0.06;         // m above rest height that still counts as ON the ground
const capyHOP_KILL = 1.2;           // m/s of upward contact push-out we refuse to keep
const capyYAW_KP = 18;              // first-order (=> non-ringing) yaw drive gain
const capyUP_KP = 12;               // upright restoring drive gain
const capySPEED_LAMBDA = 11;        // gait speed smoothing — legs must not stutter
const capyRENDER_Y_LAMBDA = 26;     // presentation-only vertical filter, at rest
// The predict-and-correct render filter. lambda is the rate the CORRECTION
// decays, not the rate the position moves — the position is carried by the
// prediction — so it can be low enough to swallow a whole step of sawtooth
// (lambda*dt ~ 0.4 at 60 Hz) without costing any lag at constant velocity.
const capyRENDER_LAMBDA = 24;
const capyRENDER_SNAP2 = 1.6 * 1.6;  // m^2 of prediction error that means "teleport"
const capyDESYNC2 = 2.25;           // (1.5 m)^2 — someone teleported the body
// --- Circular Quay verbs -------------------------------------------------------
const capyTUG_RADIUS = 1.95;        // bite-and-pull reach (grab reach is 1.6)
const capyTUG_EFFORT = 0.85;        // default seconds of strain before it gives
const capyPLAT_MIN_MASS = 4;        // lighter dynamic bodies are not platforms
// --- KEEPING THE FRAME WHEN YOUR FEET LEAVE IT ------------------------------
// This used to be one number — 0.18 s — and its only stated job was to survive a
// frame where the solver missed a contact point. It is the same mechanism as a
// hop, and it was far too short for one.
//
// A hop off a moving deck lasts about 0.55 s. After 0.18 s of it the frame was
// dropped, `vx` was re-derived against the WORLD, and the controller — with no
// stick held — damped that toward zero. So the animal stopped dead in the air
// and the vehicle drove out from under it. On the ferry nobody found this,
// because you spend the voyage at the wheel. On a bus whose entire mechanic is
// HOPPING A CABLE it is fatal: every successful hop threw you off the roof.
//
// The correct model is the one the rest of this block already believes: while
// there is no contact at all, you are still in the frame you left. The timer
// therefore has two lengths — a blip's worth while grounded, and a whole flight
// while not — and after that it BLEEDS rather than snapping, which is what air
// does to a body that has left a moving vehicle.
const capyPLAT_COYOTE = 0.18;       // hold the platform frame through a contact blip
const capyPLAT_AIR    = 1.20;       // s of it held through an actual jump
const capyPLAT_FADE   = 3.2;        // 1/s the held frame bleeds away afterwards
const capyPLAT_VMAX = 12;           // sanity clamp on inherited platform speed
// --- BEING THROWN ----------------------------------------------------------
// How long the controller refuses to believe it is standing on anything after
// capy.launch(). Without it a throw off a MOVING platform is silently deleted,
// and the way that fails is genuinely hard to read: the geyser works (the
// ground under it is static, so the platform frame is zero and only the vertical
// term matters), and the identical code on a bus doing seven metres a second
// does nothing at all. The reason is that the grip damper is 60 — it exists to
// make standing still BE standing still — so one frame of contact with the roof
// pulls the whole horizontal throw back to the roof's own velocity, and the
// animal goes politely straight up and lands where it started.
//
// 0.20 s is two things at once: long enough for the body to clear a contact it
// is still touching this step, and short enough that it cannot be used to skip
// a landing. The soft-floor backstop is off for that window, which is fine —
// being thrown is exactly when you want no floor under you.
const capyLAUNCH_HOLD = 0.20;
const capyLAUNCH_LIFT = 0.30;       // m of daylight, so the contact is gone next step
// --- THE HOP ---------------------------------------------------------------
// A capybara is not a goat, but the Opera House podium stands 1.20 m above the
// forecourt and the ceremonial stair only serves the south face. capyJUMP_V is
// sized off that: h = v^2 / 2g = 8.4^2 / 48 = 1.47 m, so a running hop clears
// the deck edge with a hand's width to spare and nothing else in the world is
// suddenly climbable. Holding the key buys a little more, releasing it early
// cuts the arc — variable jump height, because a fixed one always feels canned.
// Two numbers, both measured against g = 24:
//   tap  -> 6.6 m/s  -> 0.91 m, a kerb, a bench, a stair flight two at a time
//   held -> 8.7 m/s  -> 1.57 m, the podium deck with a hand's width to spare
// The launch IS the tap height and the sustain buys the rest, rather than
// launching high and clipping the arc on release — a clip is unpredictable
// because how much rise it eats depends on which frame the key came up.
const capyJUMP_V      = 6.0;        // m/s of launch
const capyJUMP_HOLD   = 0.20;       // s the sustain may run
const capyJUMP_HOLD_A = 15;         // m/s^2 of sustain while the key is held
const capyJUMP_COOL   = 0.16;       // s between hops — no pogo-sticking
const capyJUMP_GRACE  = 0.14;       // s after launch that the floor logic stands down
const capyCOYOTE      = 0.12;       // s off the edge that still counts as grounded
const capyLAND_K      = 190;        // landing-absorb spring, rad^2/s^2
const capyLAND_C      = 27;         // ...critically damped: c = 2*sqrt(k) approx
const capyLAND_SCALE  = 0.022;      // metres of dip per m/s of impact
const capySWIM_HOP    = 4.6;        // m/s lunge out of the water
// --- STEP ASSIST -----------------------------------------------------------
// Stair treads, kerbs, the boardwalk lip, the podium flight: all of them are
// boxes the size of a paw, and a three-sphere body walks into their vertical
// face and simply stops. Rather than raycast (which the contract's zero-alloc
// rule and the heightfield both make awkward), detect the STALL: full stick,
// grounded, and going nowhere. Then feed in a rise the player never asked for,
// capped so it can only ever climb a step and never a wall.
const capySTEP_STALL  = 0.09;       // s of being blocked before the legs try
const capySTEP_V      = 2.9;        // m/s of assisted rise
const capySTEP_MAX    = 0.40;       // m of rise per blockage before it gives up
const capySTEP_FRAC   = 0.34;       // fraction of target speed that counts as blocked
// --- CLIMBING OUT OF THE HARBOUR -------------------------------------------
// THE SOFT-LOCK. The sea wall is a solid box whose top sits at y = 0.45 and the
// capybara floats at y = -0.42, so a swimmer pressing the stick at the shore
// pushed into the wall FOR EVER: measured, position pinned at z = -10.68 with
// a standing 0.92 m/s of intent and no way back onto land anywhere within 25 m
// of the Opera House. That is the reported "it can't move any more and the game
// kind of stops". A capybara hauls itself out of water; so does this one.
// It is a LATCHED state, not a per-frame test, and that matters: the swim state
// itself switches off the moment the body clears y = 0.2, so a frame-by-frame
// version lifts the capybara 0.25 m, drops out of `capySwimming`, loses its own
// assist, sinks, and does it again for ever. Measured against the Opera House
// footing — a 1.2 m wall straight out of the harbour — that oscillated at 2 Hz
// and never got out.
const capyHAUL_PROBE  = 1.15;       // m ahead the shore test looks
const capyHAUL_V      = 3.6;        // m/s of clamber
const capyHAUL_FWD    = 2.9;        // m/s of scrabble onto the ledge
const capyHAUL_TOP    = 2.30;       // this far OVER THE SURFACE the animal is out
const capyHAUL_HOLD   = 0.55;       // s the latch survives without a fresh trigger
const capyWATER_MEM   = 0.60;       // s after leaving the water it still counts
const capySHAKE_DUR = 1.05;         // shake-dry length
const capySHAKE_DELAY = 0.55;       // beat ashore before the shake starts
const capyWET_FAST = 7.0;           // wet decay multiplier while shaking it off
// How much of the ground's wetness ends up on the animal. Under 0.42 the fur
// never crosses capyWetDark's 0.42 threshold and a downpour leaves no mark at
// all; at 1.0 a drizzle looks identical to swimming the harbour, which throws
// away the one thing the wet coat was for. 0.72 puts a full shower plainly
// into the dark-fur state and still leaves the swim visibly wetter.
const capyRAIN_WET = 0.85;
const capyIDLE_DELAY = 4.0;         // seconds of nothing before the first idle beat

// --- shared geometry (built once) -----------------------------------------
const capyGeoBlob = new THREE.SphereGeometry(1, 8, 6);
const capyGeoBead = new THREE.SphereGeometry(1, 6, 4);
const capyGeoLeg = new THREE.CylinderGeometry(0.078, 0.10, 0.32, 6);
const capyGeoFoot = new THREE.BoxGeometry(1, 1, 1);
const capyGeoRing = new THREE.CylinderGeometry(1, 1, 0.05, 8, 1, true);

// --- scratch (NEVER allocate inside update) --------------------------------
const capyThrow = new THREE.Vector3();
const capyShove = new THREE.Vector3();
const capySHOVE_MAX = 6.0;          // m/s — ceiling on the external-force channel

// ---- the grade (Tobler's hiking function) ---------------------------------
// exp(-3.5*|0 + 0.05|) — the value of the curve on the flat, so the multiplier
// normalises to exactly 1.0 on level ground and every existing speed in every
// flat chapter is unchanged to the last decimal.
const capyGRADE_FLAT = Math.exp(-3.5 * 0.05);
const capyGRADE_LOOK = 1.4;         // m ahead the grade is sampled over
const capyGRADE_MIN  = 0.42;        // a steep climb is slow, never a wall
const capyGRADE_MAX  = 1.16;        // and a gentle descent is a little free
let capyGrade = 0;                  // signed grade under the feet, published


const capyMouthLocal = new THREE.Vector3();
const capyPosition = new THREE.Vector3(capySPAWN.x, capySPAWN.y, capySPAWN.z);
const capyVelocity = new THREE.Vector3();
// RENDER transform — interpolated + lightly filtered. Never used for gameplay.
const capyRenderPos = new THREE.Vector3(capySPAWN.x, capySPAWN.y, capySPAWN.z);
const capyUpLocal = new CANNON.Vec3(0, 1, 0);
const capyUpWorld = new CANNON.Vec3();
const capyRingM4 = new THREE.Matrix4();
const capyRingQ = new THREE.Quaternion();
const capyRingP = new THREE.Vector3();
const capyRingS = new THREE.Vector3();
const capyMovePayload = { position: capyPosition, speed: 0 };
const capyWheekPayload = { position: capyPosition };
const capyDigPayload = { position: capyPosition };
const capySfxOpts = { pitch: 1, volume: 1, wet: 0 };   // reused — update() may not allocate

// --- pools -----------------------------------------------------------------
// Three splash rings, plus ONE more slot on the end of the same instanced mesh
// for the wheek's shockwave — see the fx block in update().
const capyRING_COUNT = 3;
let capyWheekRing = 0, capyWheekX = 0, capyWheekY = 0, capyWheekZ = 0;
const capyRingLife = new Float32Array(capyRING_COUNT);
const capyRingX = new Float32Array(capyRING_COUNT);
const capyRingY = new Float32Array(capyRING_COUNT);
const capyRingZ = new Float32Array(capyRING_COUNT);

// --- animation state -------------------------------------------------------
let capyYaw = 0;
let capyPrevYaw = 0;
let capyYawRate = 0;
let capyBodyYaw = 0;
let capyLegPhase = 0;
let capySpeedSm = 0;                // smoothed ground speed — drives the whole gait
let capyPop = 0;
let capyPopVel = 0;
let capyEarTimer = 2;
let capyEarFlick = 0;
let capyBlink = 0;
// ---- STANDING STILL IS ALSO A PERFORMANCE ---------------------------------
// Stop moving in this game and the animal stops entirely: a breath on the
// barrel, an ear flick every few seconds, and otherwise a capybara standing to
// attention for as long as you leave it there. That is the one pose a capybara
// is famous for NOT holding, and it is on screen every time the player stops to
// read the card, look at the map, or think — which, over three hours, is a very
// long time to be looking at nothing.
//
// Two beats, render-only. Nothing here touches the body, the collider, the
// gait, or a single number the solver reads: the shake is a term added to the
// model's existing roll (which has exactly one writer, and this goes inside
// it), and the look is head.rotation.y, which nothing else in the file writes.
// Deliberately rare — a flourish on a nine-second timer is a tic.
const capyIDLE_MIN  = 9;            // s of stillness before the first beat
const capyIDLE_MAX  = 17;
const capyIDLE_DUR  = 0.85;         // s the shake takes
const capyIDLE_LOOK = 1.9;          // s the look-around takes — slower, it is a look
let capyIdleT = 0;                  // s spent standing still
let capyIdleNext = 12;              // s at which the next beat is due
let capyIdleAct = -1;               // -1 none, 0 shake, 1 look
let capyIdleP = 0;                  // 0..1 through the current beat
let capyIdleRoll = 0;               // the shake, folded into the model's roll
let capyIdleYaw = 0;                // the look, on the head alone
let capyHeadPitch = 0;
let capyJawOpen = 0;
let capyWheekHold = 0;
let capyGrabTimer = 0;
let capyDigTimer = 0;
let capyAirTime = 0;
let capySwimming = false;
let capySwimTime = 0;
let capyDiving = false;             // under the surface on purpose
let capyDiveGrace = 0;              // s of held depth left after the key came up
let capyDiveT = 0;                  // s this dive has lasted
let capyDiveDeep = 0;               // deepest point of this dive, metres
let capySwamOnce = false;
let capyWetLevel = 0;
let capyWetDark = false;
let capyWakeT = 0;
let capyBreathAmt = 0;
let capyStageTime = 0;
let capyPlatVX = 0, capyPlatVZ = 0, capyPlatT = 0;   // the frame the floor is moving in
let capyLaunchT = 0;                                 // s left of "you are not standing on anything"
// ---- STAMINA -------------------------------------------------------------
// A capybara is a sprinter with a rodent's lungs, not a horse. Ten seconds flat
// out and it is done, and the hop is expensive because leaving the ground is the
// most expensive thing a heavy animal does. The point is not to punish running —
// it is to make the sprint a DECISION, so that a chase, a dash across an avenue
// and the run-up to a jump each cost something and each have to be timed.
const capySTAM_DRAIN   = 0.100;     // per second at a flat run -> 10 s from full
const capySTAM_HOP     = 0.11;      // one hop
const capySTAM_REGEN   = 0.265;     // per second stood still
const capySTAM_REGEN_M = 0.62;      // ...scaled by this while still walking about
const capySTAM_DELAY   = 0.55;      // s of no exertion before any of it comes back
const capySTAM_RECOVER = 0.30;      // blown until this much is back — no stutter-sprinting
const capySTAM_TIRED   = 0.90;      // walk speed multiplier while blown
let capyStam = 1;                   // 0..1
let capyStamBlown = false;          // out of puff: walk only, no hops
let capyStamHold = 0;               // s left of the regen delay
let capyJumpT = 0;                  // s left of the launch grace
let capyJumpHold = 0;               // s left of the sustain window
let capyJumpCool = 0;
let capyJumpArm = false;            // a launch is live and may still be cut short
let capyHaulT = 0;                  // s of clamber left on the latch
let capySwimAgo = 99;               // s since there was last water underneath
let capyClinging = false;           // hanging off a face — see capyCLIMB_UP
let capyClingCool = 0;              // s before a kicked-off wall will take us back
let capyClingT = 0;                 // s spent on the current hold, for the pose
let capyStallT = 0;                 // s spent blocked with the stick down
let capyStepUsed = 0;               // m of step assist spent on this blockage
let capyStepX = 0, capyStepZ = 0;   // where this blockage started
let capyAirPose = 0;                // 0..1 render blend into the tuck
let capyLand = 0, capyLandVel = 0;  // the landing absorb spring (render only)
let capyFallV = 0;                  // fastest descent of the current flight, m/s
let capyStepPhase = 0;              // which half gait-cycle the last footfall was in

/**
 * THE LIVE BIOME'S API, or null.
 *
 * `game.env` is Sydney's and stays resident when Sydney is detached, so asking
 * it about the harbour while standing on a volcano answers "yes, water, z is
 * less than -10" — which used to be harmless (there was nothing that acted on
 * it up there) and stopped being harmless the moment the clamber latch started
 * reading it, because every cliff in Pasto would have become climbable. Answer
 * from the live biome, or from nobody.
 *
 * This was an if-ladder with one rung per biome, which is a bug waiting for the
 * next chapter: eleven of them, in six different functions, and a chapter that
 * forgot one rung got a world with no water in it, or no relief, in a way that
 * looks like a physics bug rather than a missing line. There is only ever ONE
 * live biome and its api hangs off `game` under its own name, so the whole
 * ladder is a property lookup. Sydney is the one exception, because
 * environment.js published itself as `game.env` eight chapters before any of
 * this existed.
 */
function capyBiomeApi(game) {
  const b = game.biome;
  if (!b) return null;
  const n = b.current;
  if (!n) return null;
  return n === 'sydney' ? game.env : (game[n] || null);
}
function capyWater(game) { return capyBiomeApi(game); }

/**
 * A number a biome published, or a default. Every optional biome hook below is
 * one of these: ask the LIVE biome, take the answer only if it is a real finite
 * number, and fall back otherwise. A biome with no opinion simply does not
 * publish the name and this is a property lookup that misses.
 */
function capyAskNum(game, name, x, z, dflt) {
  const api = capyBiomeApi(game);
  if (!api || typeof api[name] !== 'function') return dflt;
  const v = api[name](x, z);
  return (typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity) ? v : dflt;
}

/**
 * The height of the ground under (x, z) in the LIVE biome, or 0 where the world
 * is flat. The soft-floor backstop and the fell-out-of-the-world test below are
 * both written against "the floor is at y = 0", which is true in Sydney and on
 * the harbour and is emphatically not true on a volcano or in a river valley.
 */
function capyGroundY(game, x, z) {
  return capyAskNum(game, 'terrainHeight', x, z, 0);
}

/**
 * HOW SLIPPERY THE GROUND IS UNDER (x, z), 0..1.
 *
 * Asked of the LIVE biome and nobody else — the same rule as capyWater() and
 * for the same reason: game.iceland stays resident when Iceland is detached, and
 * a glacier that is still answering questions while the capybara is stood in the
 * Botanic Gardens would make Sydney an ice rink.
 *
 * A biome with no opinion simply does not publish groundSlip, and this is a
 * property lookup that misses. Most of them do not.
 */
function capySlipAt(game, x, z) {
  let s = capyAskNum(game, 'groundSlip', x, z, 0);
  // ---- AND THE RAIN, WHICH IS EVERY CHAPTER'S PROBLEM AND NO CHAPTER'S ----
  // Added to whatever the biome says rather than replacing it: a glacier in a
  // shower is a glacier plus a shower, and taking the max would make the two
  // wettest chapters in the game no more slippery than they already were.
  //
  // It reads weather.slip(), which is keyed off wetness ABOVE the chapter's
  // own baseline. Son Doong's floor is wet limestone at 0.52 and Kowloon's
  // asphalt never dries; both were authored, tuned and shipped with the grip
  // they have, and handing them a permanent slide the day a weather system
  // arrived would be a rebalance of finished work. Only water that was not
  // there before costs anything.
  const W = game.weather;
  if (W) s += W.slip(x, z);
  return clamp(s, 0, 1);
}

/**
 * SOMETHING TO HANG ON TO at (x, y, z), or null.
 *
 * The live biome answers with the outward normal of the face within reach —
 * `{nx, nz}`, and optionally `top`, the height at which the lattice runs out and
 * the animal is put on the deck. Asked of the live biome for the same reason
 * everything else here is: game.kowloon stays resident once you have left it,
 * and a scaffold still hanging in the air over the Botanic Gardens would let a
 * capybara climb a rectangle of nothing.
 */
const capyClimbOut = { nx: 0, nz: 0, top: Infinity };
function capyClimbAt(game, x, y, z) {
  const api = capyBiomeApi(game);
  if (!api || typeof api.climbHold !== 'function') return null;
  const h = api.climbHold(x, y, z);
  if (!h) return null;
  const nx = h.nx, nz = h.nz;
  if (typeof nx !== 'number' || nx !== nx || typeof nz !== 'number' || nz !== nz) return null;
  const m = Math.sqrt(nx * nx + nz * nz);
  if (m < 1e-4) return null;
  capyClimbOut.nx = nx / m;
  capyClimbOut.nz = nz / m;
  capyClimbOut.top = (typeof h.top === 'number' && h.top === h.top) ? h.top : Infinity;
  return capyClimbOut;
}

/**
 * THE VELOCITY OF THE AIR at the capybara, 0 unless the live biome says
 * otherwise — the same rule as capyWater() and capySlipAt() and for the same
 * reason: game.drift stays resident when the Drift is detached, and a thirty-
 * eight-second gale still blowing across the Botanic Gardens would be a very
 * hard bug to find. Most biomes have still air and simply do not publish
 * wind(), so this is a property lookup that misses.
 */
// ---- AND THE MICRO-GUST DELIBERATELY DOES NOT COME IN HERE ----------------
// weather.js publishes a gust for every chapter — up to seven metres a second
// over the Erg — and the obvious thing to do with it is add it to this, and it
// would be a serious bug. `wind()` is not "how windy is it": it is THE AIR AS
// A REFERENCE FRAME, a chapter-owned mechanic that moves the world the animal
// is standing in, and it is added to `platVX/platVZ` alongside a moving ferry
// deck and a hot-air balloon's basket. A five-metre ambient breeze on that
// channel would slide a capybara across Jemaa el-Fnaa at walking pace with
// nobody touching a key, and in Cappadocia it would fight the one system that
// chapter IS.
//
// So the gust drives the things a gust visibly and audibly drives — the motes,
// the rain's lean, the wind bed, and which way the locals turn their backs —
// and it does not touch the controller. A chapter that wants the air to carry
// the animal says so itself, through wind(), exactly as the Drift and
// Cappadocia already do.
const capyWindOut = { x: 0, z: 0 };
function capyWindAt(game) {
  capyWindOut.x = 0; capyWindOut.z = 0;
  const api = capyBiomeApi(game);
  if (!api || typeof api.wind !== 'function') return capyWindOut;
  const w = api.wind();
  if (!w) return capyWindOut;
  if (typeof w.x === 'number' && w.x === w.x) capyWindOut.x = clamp(w.x, -12, 12);
  if (typeof w.z === 'number' && w.z === w.z) capyWindOut.z = clamp(w.z, -12, 12);
  return capyWindOut;
}

/**
 * THE VELOCITY OF THE WATER at (x, z) — zero unless the live biome says
 * otherwise, the same rule as capyWindAt() and for the same reason. Two biomes
 * have a current in them; the rest publish no flow() and this is a property
 * lookup that misses.
 *
 * Clamped hard at 12 m/s. The frame is added to the animal's own velocity and a
 * runaway here would launch a swimming capybara out of the world, which is
 * precisely the class of thing main.js's velocity cap exists to catch and which
 * should never get that far.
 */
const capyFlowOut = { x: 0, z: 0 };
function capyFlowAt(game, x, z) {
  capyFlowOut.x = 0; capyFlowOut.z = 0;
  const api = capyBiomeApi(game);
  if (!api || typeof api.flow !== 'function') return capyFlowOut;
  const f = api.flow(x, z);
  if (!f) return capyFlowOut;
  if (typeof f.x === 'number' && f.x === f.x) capyFlowOut.x = clamp(f.x, -12, 12);
  if (typeof f.z === 'number' && f.z === f.z) capyFlowOut.z = clamp(f.z, -12, 12);
  return capyFlowOut;
}

/**
 * HOW MUCH STEERING THE ANIMAL HAS WITH ITS FEET OFF THE GROUND.
 *
 * 0.35 in the chapters where a jump is a hop over a kerb and the whole point of
 * a committed arc is that it is committed. A chapter where the jump IS the
 * traversal cannot use that number: a third of a second of no steering is a
 * flourish and two full seconds of it is a punishment. A biome asks for more by
 * publishing airControl, and nothing else may write it.
 */
function capyAirCtl(game) {
  const api = capyBiomeApi(game);
  if (api && typeof api.airControl === 'number' && api.airControl === api.airControl) {
    return clamp(api.airControl, 0, 1);
  }
  return capyAIR_CONTROL;
}

/**
 * THE WORLD UNDER YOU IS MOVING, AND IT SAYS SO ITSELF.
 *
 * The fourth thing to use the reference-frame channel, after a ferry's deck,
 * the Drift's air and the Uji's current — and the first to be DECLARED rather
 * than sniffed off a solver contact. A balloon basket carrying the animal
 * upward at the same rate the animal is rising barely penetrates its own floor,
 * and a contact that is barely there is a contact that is sometimes not there:
 * measured, the capybara fell out of the basket within a second of the wind
 * taking it, every time.
 *
 * Returns the frame's world velocity, or null. One biome publishes it.
 */
function capyCarryAt(game) {
  const api = capyBiomeApi(game);
  if (!api || typeof api.carryFrame !== 'function') return null;
  const f = api.carryFrame();
  if (!f) return null;
  const x = f.x, z = f.z;
  if (!(x === x && z === z)) return null;
  return f;
}

/**
 * IS THERE ANYTHING UNDER THIS WATER WORTH GOING TO?  (v19 — measured)
 *
 * This used to be `!!api.canDive`, and exactly three chapters published it. The
 * comment underneath said the reason, and it was a good one: the harbour is two
 * metres of nothing over a collision plane, and letting the player sink into it
 * would be a way to be STUCK rather than a mechanic.
 *
 * But that is an argument about DEPTH, not about which chapter you are in — and
 * the game has a depth. A capybara is the finest swimmer of any rodent alive and
 * for seventeen chapters it could only prove it in three of them; the verb was
 * taught in Palawan and then taken away again, which is the shape every new verb
 * in this game had and the one thing that stops hour five being richer than
 * hour one.
 *
 * So: the biome may still answer, and an explicit answer always wins — `true`
 * for the three that built a floor to look at, and `false` for anything that
 * ever needs to say "not here". Everybody else is MEASURED. If the live biome's
 * own terrainHeight says there is more than capyDIVE_MIN_D of water under this
 * point, there is somewhere to go and going there is safe, because the dive
 * levels out capyDIVE_FLOOR above that same number.
 *
 * The rule self-selects almost exactly right, which is the tell that it is the
 * real question: a chapter that MODELLED a seabed gets the verb, and a chapter
 * whose water is a flat plate over nothing does not publish terrainHeight at
 * all, answers 0, and is left exactly as it was. Sydney's harbour stays a wall.
 *
 * See RELIEF IS NOT A LIST OF CHAPTERS in CONTRACT.md — the same argument, and
 * the fourth time this codebase has replaced a list of biome names with the
 * question the list was standing in for.
 */
function capyCanDive(game, x, z) {
  const api = capyBiomeApi(game);
  if (!api) return false;
  if (api.canDive === true) return true;
  if (api.canDive === false) return false;
  const d = capyWaterY(api, x, z) - capyGroundY(game, x, z);
  return d >= capyDIVE_MIN_D;
}

/**
 * WHERE THE WATERLINE IS, and the two offsets everything about swimming is
 * measured from it.
 *
 * For nine chapters this was the constant −0.5 and every number around it was
 * written as an absolute world height: enter the water below y = 0.2, float at
 * y = −0.42, stop clambering above y = 1.80. That is fine while the sea never
 * moves and it makes a TIDE impossible — which is the whole of chapter 10, where
 * the water comes up over the paving of the lowest square in the city and the
 * route across it changes as it does.
 *
 * So the three numbers are offsets from the live waterline now, chosen to be
 * exactly what they used to be at −0.5 (0.2 = −0.5 + 0.70, −0.42 = −0.5 + 0.08,
 * 1.80 = −0.5 + 2.30). Every other biome is unchanged to the last decimal; the
 * one with a tide in it works.
 *
 * AND FOR ONE CHAPTER IT IS NOT A NUMBER AT ALL.
 *
 * Venice moved the waterline in TIME. Manly moves it in SPACE — a swell is a
 * surface with a metre and a half of relief on it travelling at eight metres a
 * second, and no single scalar can describe that. A biome may therefore
 * declare `localWater: true`, and this asks `waterHeightAt(x, z)` instead.
 *
 * Built exactly the way slip, wind, the current, the climb and the dive were
 * built: ONE flag from the biome, the solve stays here, and the fourteen
 * chapters that do not publish it cost one property miss and are untouched to
 * the last decimal. Everything that already reads this — the swim threshold,
 * the float target, the clamber ceiling, the wake rings — becomes correct on a
 * wave for free, because all five were already expressed as offsets from
 * "wherever the water is" rather than as world heights.
 */
function capyWaterY(env, x, z) {
  if (env && env.localWater === true && typeof env.waterHeightAt === 'function') {
    const y = env.waterHeightAt(x, z);
    if (typeof y === 'number' && y === y) return y;
  }
  const w = env && env.waterLevel;
  return (typeof w === 'number' && w === w) ? w : -0.5;
}

/**
 * What the capybara is standing ON, expressed as the pitch systems.js's step
 * voice reads: < 0.9 soft ground, ~1.0 stone, > 1.15 hollow timber.
 *
 * Deliberately a handful of rectangle tests rather than anything that touches
 * the physics world: this runs on every footfall, up to seven times a second,
 * and a raycast per footfall to distinguish grass from paving is not a trade
 * anybody should make. Every number here is a world-layout constant that
 * already exists in CONTRACT.md.
 */
function capySurfacePitch(game, env, x, z, y) {
  const b = game.biome;
  if (!b) return 0.82;
  // A biome may simply answer for itself. The ladder below is nine chapters of
  // rectangles written before there was anywhere to put them; anything new
  // publishes surfacePitch(x, z, y) and never appears here at all.
  const api = capyBiomeApi(game);
  if (api && typeof api.surfacePitch === 'function') {
    const v = api.surfacePitch(x, z, y);
    if (typeof v === 'number' && v === v) return clamp(v, 0.5, 1.6);
  }
  if (b.isActive('sydney')) {
    // the Opera House podium and its ceremonial stair are dressed sandstone
    if (y > 0.9 && x > -13.5 && x < 13.5 && z > -12.5 && z < 7.5) return 1.0;
    // the boardwalk and the ferry wharf are timber
    if (z < -7 && z > -25) return 1.22;
    return 0.82;
  }
  if (b.isActive('quay')) {
    const q = game.quay;
    if (q && q.inZone && q.inZone('deck', x, z)) return 1.24;   // the ferry herself
    if (z < 16) return 1.22;                                     // the finger wharves
    if (z > 16 && z < 46) return 1.0;                            // the paved apron
    return 0.82;                                                 // the sand at Manly
  }
  if (b.isActive('pasto')) {
    // the plaza is cobbled; the flanks of Galeras are not
    if (x > -24 && x < 24 && z > 8 && z < 46) return 1.0;
    return 0.82;
  }
  if (b.isActive('kyoto')) {
    const k = game.kyoto;
    if (k && k.inZone) {
      if (k.inZone('gion', x, z)) return 1.0;    // granite setts
      if (k.inZone('zen', x, z)) return 0.86;    // raked gravel — soft, but crunchier
    }
    // the torii path is gravel over stone steps
    if (z < -40 && z > -140) return 1.0;
    return 0.82;
  }
  if (b.isActive('cali')) {
    const c = game.cali;
    if (c && c.inZone && c.inZone('dancefloor', x, z)) return 1.24;  // a sprung board floor
    if (c && c.inZone && c.inZone('street', x, z)) return 1.0;
    return 0.82;
  }
  if (b.isActive('rio')) {
    const r = game.rio;
    // the calcadao is set stone, the avenue is asphalt, and Selaron's steps are
    // glazed tile — the hardest, brightest footfall in the game
    if (r && r.inZone) {
      if (r.inZone('calcadao', x, z)) return 1.06;
      if (r.inZone('avenue', x, z)) return 0.98;
      if (r.inZone('santateresa', x, z)) return 1.18;
    }
    return 0.82;                                                     // the sand
  }
  if (b.isActive('iceland')) {
    const i = game.iceland;
    // ice is the hardest, brightest footfall there is; the pier is timber; the
    // basalt headland and the city street are stone; the moss is nothing at all
    if (i && i.groundSlip && i.groundSlip(x, z) > 0.3) return 1.30;
    if (i && i.inZone) {
      if (i.inZone('pier', x, z)) return 1.24;
      if (i.inZone('cliff', x, z)) return 1.04;
      if (i.inZone('city', x, z)) return 1.0;
    }
    return 0.82;
  }
  if (b.isActive('drift')) {
    // grass over a metre of floating rock, and a jetty of very old planks
    if (x > 14 && x < 32 && z > 32 && z < 36) return 1.26;
    return 0.80;
  }
  if (b.isActive('sahara')) {
    const sa = game.sahara;
    if (sa && sa.inZone) {
      if (sa.inZone('erg', x, z)) return 0.74;    // sand, and a lot of it
      if (sa.inZone('souk', x, z)) return 1.02;   // beaten earth over stone
      if (sa.inZone('square', x, z)) return 0.94;
    }
    return 0.86;
  }
  return 0.82;
}

function capyWrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function capyAddPart(parent, geo, material, px, py, pz, sx, sy, sz) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(px, py, pz);
  if (sx !== undefined) m.scale.set(sx, sy, sz);
  m.castShadow = true;
  m.receiveShadow = false;
  parent.add(m);
  return m;
}

export function createCapybara(game) {
  const scene = game.scene;

  // -------------------------------------------------------------------
  // MATERIALS (flat Lambert via mat(); dry/wet pairs for the swim soak)
  // -------------------------------------------------------------------
  // TWO VALUES PLUS ACCENTS (Goose Game rule):
  //   mFur   = capy       -> barrel, rump, dorsal ridge, head, snout, shoulders
  //   mBelly = capyLight  -> belly underside ONLY
  //   mDark  = capyDark   -> legs, jaw, ears, tail
  //   mNose / mEye        -> tiny accents (nose pad, mouth interior, eyes)
  const mFur = mat(PALETTE.capy);
  const mFurWet = mat(PALETTE.capyDark);
  const mBelly = mat(PALETTE.capyLight);
  const mBellyWet = mat(PALETTE.capy);
  const mDark = mat(PALETTE.capyDark);
  const mDarkWet = mat(PALETTE.capyNose);
  const mNose = mat(PALETTE.capyNose);
  const mEye = mat(PALETTE.capyEye);
  const wetParts = [];

  // -------------------------------------------------------------------
  // RIG HIERARCHY
  //   capyRoot (world position + yaw)
  //     capyModel (bob / roll / pitch)  — model space, feet at y=0
  //       capySquash (squash & stretch — NON-uniform, so nothing that needs a
  //                   clean world quaternion may live under it)
  //       mouthAnchor (driven from the head's local transform each frame)
  // -------------------------------------------------------------------
  const capyRoot = new THREE.Group();
  capyRoot.position.set(capySPAWN.x, capySPAWN.y, capySPAWN.z);
  scene.add(capyRoot);

  const capyModel = new THREE.Group();
  capyModel.position.y = -capyFOOT_Y;
  capyRoot.add(capyModel);

  const capySquash = new THREE.Group();
  capyModel.add(capySquash);

  // --- barrel body ---------------------------------------------------
  const barrel = capyAddPart(capySquash, capyGeoBlob, mFur, 0, 0.42, -0.02, 0.32, 0.26, 0.42);
  wetParts.push({ m: barrel, dry: mFur, wet: mFurWet });
  const rump = capyAddPart(capySquash, capyGeoBlob, mFur, 0, 0.40, -0.40, 0.29, 0.25, 0.17);
  wetParts.push({ m: rump, dry: mFur, wet: mFurWet });
  // dorsal ridge — same base value as the barrel on purpose. It exists for the
  // SILHOUETTE (a higher, straighter back line) not for a colour break.
  const saddle = capyAddPart(capySquash, capyGeoBlob, mFur, 0, 0.48, -0.04, 0.30, 0.245, 0.38);
  wetParts.push({ m: saddle, dry: mFur, wet: mFurWet });
  // the ONLY capyLight on the animal: the belly underside. Narrow enough that
  // it emerges as a low band along the underside instead of a mottled patch.
  const belly = capyAddPart(capySquash, capyGeoBlob, mBelly, 0, 0.245, -0.04, 0.245, 0.105, 0.30);
  wetParts.push({ m: belly, dry: mBelly, wet: mBellyWet });
  const tail = capyAddPart(capySquash, capyGeoBlob, mDark, 0, 0.44, -0.55, 0.055, 0.06, 0.05);

  // --- head: no neck, squared-off snout, eyes+ears high and far back --
  const head = new THREE.Group();
  head.position.set(0, 0.50, 0.26);
  capySquash.add(head);

  // brick-shaped skull — half the capybara read is that it has no neck.
  // Deep enough (rear face at local z = -0.18) that it buries itself inside the
  // saddle/barrel: from behind there is no seam and no dark wedge at the join.
  const skullBox = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.32, 0.50), mFur);
  skullBox.position.set(0, 0.02, 0.07);
  skullBox.castShadow = true;
  head.add(skullBox);
  wetParts.push({ m: skullBox, dry: mFur, wet: mFurWet });

  // blunt brick muzzle, 90% of skull width — the single biggest species tell
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.325, 0.20, 0.26), mFur);
  snout.position.set(0, -0.045, 0.37);
  snout.castShadow = true;
  head.add(snout);
  wetParts.push({ m: snout, dry: mFur, wet: mFurWet });

  // brow / cheek mass: bridges the skull front into the muzzle (no gap above
  // the snout) and gives the eyes a corner to sit in. Its top edge stands 0.01
  // above the skull, so the sun leaves a brow shadow across the eyes.
  const brow = capyAddPart(head, new THREE.BoxGeometry(0.375, 0.14, 0.08), mFur, 0, 0.12, 0.295);
  wetParts.push({ m: brow, dry: mFur, wet: mFurWet });

  // NOSE PAD — a marking, not a box bolted to the face. Tapered 4-sided prism
  // (wide at the top lip, narrower at the bottom), 39% of the muzzle width and
  // 21% of its height, sitting high on the muzzle front. The top face stands
  // 0.005 proud of the snout, the bottom edge is flush-to-inset.
  const nosePadGeo = new THREE.CylinderGeometry(0.0905, 0.0622, 0.042, 4);
  nosePadGeo.rotateY(Math.PI * 0.25);           // flats face front/back/sides
  const nosePad = new THREE.Mesh(nosePadGeo, mNose);
  nosePad.scale.set(1, 1, 0.30);                // flatten it onto the muzzle
  nosePad.position.set(0, 0.020, 0.4858);
  nosePad.castShadow = true;
  head.add(nosePad);
  // two nostril pricks, barely proud of the pad
  capyAddPart(head, capyGeoBead, mEye, 0.030, 0.026, 0.4995, 0.013, 0.011, 0.009);
  capyAddPart(head, capyGeoBead, mEye, -0.030, 0.026, 0.4995, 0.013, 0.011, 0.009);

  // EYES — dark beads set into the outer-front corners of the brow, angled
  // outward-and-forward so BOTH catch the light from a three-quarter front
  // view instead of hiding on a side plane, and far enough forward that the
  // shoulder can never be mistaken for one.
  const eyeSockL = new THREE.Group();
  eyeSockL.position.set(0.128, 0.128, 0.265);
  eyeSockL.rotation.y = 0.62;
  head.add(eyeSockL);
  const eyeL = capyAddPart(eyeSockL, capyGeoBead, mEye, 0, 0, 0.056, 0.046, 0.050, 0.042);
  capyAddPart(eyeL, capyGeoBead, mBelly, 0.15, 0.45, 0.62, 0.30, 0.30, 0.30);
  const eyeSockR = new THREE.Group();
  eyeSockR.position.set(-0.128, 0.128, 0.265);
  eyeSockR.rotation.y = -0.62;
  head.add(eyeSockR);
  const eyeR = capyAddPart(eyeSockR, capyGeoBead, mEye, 0, 0, 0.056, 0.046, 0.050, 0.042);
  capyAddPart(eyeR, capyGeoBead, mBelly, -0.15, 0.45, 0.62, 0.30, 0.30, 0.30);

  // ears are a capyDark accent — at this size the dark cup IS the whole ear
  const earL = new THREE.Group();
  earL.position.set(0.135, 0.17, -0.05);
  head.add(earL);
  const earMeshL = capyAddPart(earL, capyGeoBlob, mDark, 0.02, 0.03, 0, 0.072, 0.078, 0.036);
  wetParts.push({ m: earMeshL, dry: mDark, wet: mDarkWet });
  const earR = new THREE.Group();
  earR.position.set(-0.135, 0.17, -0.05);
  head.add(earR);
  const earMeshR = capyAddPart(earR, capyGeoBlob, mDark, -0.02, 0.03, 0, 0.072, 0.078, 0.036);
  wetParts.push({ m: earMeshR, dry: mDark, wet: mDarkWet });

  // --- jaw ------------------------------------------------------------
  // The snout box is 0.325 x 0.20 x 0.26 centred (0, -0.045, 0.37):
  //   underside y = -0.145, front face z = 0.50, rear face z = 0.24.
  // At rest the jaw is a SOLID closed box tucked flush under that muzzle:
  // top edge 0.007 up INSIDE the snout and front face 0.004 behind the snout's
  // front face — both faces are near-flush but never coplanar, so no seam
  // z-fights — and sides inset 0.0125 per side.
  // It hinges on its REAR-TOP edge — the mouth rotates, it never translates.
  const jawHinge = new THREE.Group();
  jawHinge.position.set(0, -0.138, 0.262);
  head.add(jawHinge);
  const jawBox = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.085, 0.234), mDark);
  jawBox.position.set(0, -0.0425, 0.117);
  jawBox.castShadow = true;
  jawHinge.add(jawBox);
  wetParts.push({ m: jawBox, dry: mDark, wet: mDarkWet });
  // dark plate closing off the back of the cavity: when the jaw drops you see
  // darkness, not the lit inside of a hollow box. Parented to the head, and
  // fully enclosed by snout + jaw when the mouth is shut.
  const mouthDark = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.09, 0.07), mNose);
  mouthDark.position.set(0, -0.176, 0.305);
  head.add(mouthDark);

  // Lives OUTSIDE the squash node: props.js decomposes its world matrix and a
  // non-uniform parent scale would shear the recovered rotation.
  const mouthAnchor = new THREE.Object3D();
  mouthAnchor.position.set(0, 0.445, 0.76);
  capyModel.add(mouthAnchor);

  // --- four stumpy legs with shoulder / hip blobs and blunt feet ------
  const legs = [];
  const legX = [0.15, -0.15, 0.15, -0.15];
  const legZ = [0.28, 0.28, -0.28, -0.28];
  for (let i = 0; i < 4; i++) {
    // shoulder / hip blobs are BODY, so they carry the body's one base value
    const blob = capyAddPart(capySquash, capyGeoBlob, mFur, legX[i] * 0.82, 0.335, legZ[i] * 0.92, 0.115, 0.115, 0.135);
    wetParts.push({ m: blob, dry: mFur, wet: mFurWet });
  }
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.position.set(legX[i], 0.32, legZ[i]);
    capySquash.add(g);
    const shin = capyAddPart(g, capyGeoLeg, mDark, 0, -0.16, 0);
    const foot = capyAddPart(g, capyGeoFoot, mDark, 0, -0.295, 0.03, 0.145, 0.05, 0.175);
    wetParts.push({ m: shin, dry: mDark, wet: mDarkWet });
    wetParts.push({ m: foot, dry: mDark, wet: mDarkWet });
    legs.push(g);
  }

  // --- fx: splash rings, one InstancedMesh (three instances, one draw) --
  const capyRingMesh = new THREE.InstancedMesh(
    capyGeoRing,
    mat(PALETTE.foam, { side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }),
    capyRING_COUNT + 1
  );
  capyRingMesh.frustumCulled = false;
  capyRingMesh.castShadow = false;
  capyRingMesh.receiveShadow = false;
  capyRingQ.set(0, 0, 0, 1);
  capyRingP.set(0, -999, 0);
  capyRingS.set(0.0001, 0.0001, 0.0001);
  capyRingM4.compose(capyRingP, capyRingQ, capyRingS);
  for (let i = 0; i <= capyRING_COUNT; i++) capyRingMesh.setMatrixAt(i, capyRingM4);
  capyRingMesh.instanceMatrix.needsUpdate = true;
  scene.add(capyRingMesh);

  // every mesh casts, regardless of module construction order
  capyRoot.traverse(function (n) { if (n.isMesh) n.castShadow = true; });
  if (typeof game.registerShadowTarget === 'function') game.registerShadowTarget(capyRoot);

  // -------------------------------------------------------------------
  // PHYSICS — compound of three spheres. Never a box: boxes catch edges.
  // -------------------------------------------------------------------
  const body = new CANNON.Body({
    mass: 30,
    material: (game.mats && game.mats.capy) || undefined,
    linearDamping: 0.02,
    angularDamping: 0.95,
    allowSleep: false,
    fixedRotation: false,
  });
  body.addShape(new CANNON.Sphere(capyR), new CANNON.Vec3(0, 0, 0.34));
  body.addShape(new CANNON.Sphere(capyR), new CANNON.Vec3(0, 0, 0));
  body.addShape(new CANNON.Sphere(capyR), new CANNON.Vec3(0, 0, -0.34));
  body.position.set(capySPAWN.x, capySPAWN.y, capySPAWN.z);
  // seed the interpolation fields, or frame 0 renders a smear from the origin
  body.previousPosition.copy(body.position);
  body.interpolatedPosition.copy(body.position);
  body.previousQuaternion.copy(body.quaternion);
  body.interpolatedQuaternion.copy(body.quaternion);
  body.updateMassProperties();
  game.world.addBody(body);

  // heavy props actually shove the capybara around — decaying velocity channel
  body.addEventListener('collide', function (e) {
    const other = e.body;
    if (!other || other.mass < 0.8) return;
    const c = e.contact;
    if (!c) return;
    const v = c.getImpactVelocityAlongNormal();
    if (Math.abs(v) < 2.0) return;
    const n = c.ni;
    const s = clamp(Math.abs(v) * other.mass / 30, 0, 4.5);
    const sign = (body === c.bi) ? 1 : -1;
    capyShove.x += n.x * s * sign;
    capyShove.z += n.z * s * sign;
  });

  // -------------------------------------------------------------------
  // The published record
  // -------------------------------------------------------------------
  const capy = {
    group: capyRoot,
    body,
    mouthAnchor,
    position: capyPosition,          // AUTHORITATIVE simulated position (gameplay)
    velocity: capyVelocity,
    renderPosition: capyRenderPos,   // additive: smoothed display transform (camera-friendly)
    heldProp: null,
    grounded: false,
    wet: 0,
    isRunning: false,
    stamina: 1,                      // 0..1, drawn by systems.js
    slip: 0,                         // 0..1, how little the floor is holding on
    grade: 0,                        // signed gradient underfoot, + is uphill

    // The velocity of the FRAME the animal is currently solving in — a deck, the
    // air, a river. Published because "is the world moving under me, and how
    // fast" is the single most useful thing to be able to read back when a
    // reference-frame mechanic misbehaves, and three chapters now depend on one.
    frameVX: 0, frameVZ: 0,
    blown: false,                    // out of puff — walk only until it comes back
    carriedBy: null,
    atHelm: false,
    climbing: false,                 // hanging off a face — see capyCLIMB_UP
    diving: false,                   // under the surface on purpose — see capyDIVE_V
    depth: 0,                        // metres below the live waterline, 0 on land
    diveTime: 0,                     // s this breath has lasted
    threwAt: -1,
    /**
     * POINT THE ANIMAL. For arrivals, and for arrivals only.
     *
     * `capyYaw` is integrated toward whatever the stick is asking for and is
     * written to the model every frame, so a caller that sets `group.rotation.y`
     * from outside is overwritten before it is ever drawn. Every chapter's
     * spawn comment in main.js describes a HEADING — "the torii hill in front
     * and Uji behind", "the Atlantic straight ahead" — and none of them were
     * ever set: you arrived facing wherever you had been looking in the last
     * country. This is the one line that makes those comments true.
     *
     * Sets the render yaw and the body's, so the first frame is already right
     * and there is nothing to spring out of.
     */
    face(yaw) {
      if (typeof yaw !== 'number' || yaw !== yaw) return;
      capyYaw = yaw; capyPrevYaw = yaw; capyBodyYaw = yaw; capyYawRate = 0;
      capyRoot.rotation.y = yaw;
      body.quaternion.setFromAxisAngle(capyUpLocal, yaw);
      if (body.previousQuaternion) body.previousQuaternion.copy(body.quaternion);
      if (body.interpolatedQuaternion) body.interpolatedQuaternion.copy(body.quaternion);
      body.angularVelocity.set(0, 0, 0);
    },
    /**
     * THROW THE ANIMAL, and mean it.
     *
     * The one supported way for the world to take the capybara off its feet:
     * a geyser, a cable at head height over a barrio street, a wave. It sets the
     * world velocity, clears the reference frame of whatever it was stood on,
     * lifts it clear of the contact that is still in the solver's list this
     * step, and then refuses to be grounded for capyLAUNCH_HOLD.
     *
     * All four parts are load-bearing on a MOVING platform. Setting the velocity
     * alone does nothing there at all — see the note by capyLAUNCH_HOLD.
     */
    launch: function (vx, vy, vz) {
      if (!(vx === vx && vy === vy && vz === vz)) return;
      body.velocity.set(vx, vy, vz);
      body.wakeUp();
      capyPlatVX = 0; capyPlatVZ = 0; capyPlatT = 0;
      capyLaunchT = capyLAUNCH_HOLD;
      body.position.y += capyLAUNCH_LIFT;
      body.previousPosition.copy(body.position);
      body.interpolatedPosition.copy(body.position);
      capyPosition.set(body.position.x, body.position.y, body.position.z);
    },
    /**
     * AN EXTERNAL FORCE ON A CAPYBARA THAT IS STILL ON ITS FEET.
     *
     * launch() is for being thrown; this is for being LEANED ON — a sandstorm,
     * a bow wave, a crowd. It is the one channel that survives the movement
     * solve, because it is added AFTER the grip damper and after the snap, and
     * because the speed cap is widened by however much of it is live.
     *
     * Writing body.velocity from outside instead does nothing measurable and
     * this is arithmetic, not opinion: the grip damper is lambda 60, which
     * removes 63% of any injected velocity in a single 60 Hz frame, and
     * anything left under capyGRIP_SNAP (0.9 m/s) is then set to exactly zero.
     * Marrakech's storm was pushing 0.103 m/s per frame into that and moving
     * the animal a measured nothing.
     *
     * Takes a VELOCITY INCREMENT (the caller has already multiplied by dt), so
     * calling it every frame builds to a steady state against the decay rather
     * than jumping.
     */
    shove: function (dvx, dvz) {
      if (!(dvx === dvx && dvz === dvz)) return;
      capyShove.x = clamp(capyShove.x + dvx, -capySHOVE_MAX, capySHOVE_MAX);
      capyShove.z = clamp(capyShove.z + dvz, -capySHOVE_MAX, capySHOVE_MAX);
    },
    update: capyUpdate,
  };
  game.capy = capy;

  // ears snap on the beat the gardener shouts
  game.events.on('npc:chase', function () { capyEarFlick = 1; capyEarTimer = rand(1.4, 3.0); });
  // ---- CROSSING A BORDER CLEARS EVERY LATCH IN THIS MODULE ----------------
  // Every biome is authored in the same coordinates, so a stateful latch that
  // survives travel is a bug waiting to happen somewhere it makes no sense —
  // this is exactly what froze the gardener's carry across a hemisphere. The
  // cling is the newest of them: leave Hong Kong halfway up a scaffold and,
  // without this, the animal arrives in Venice still holding on to nothing.
  game.events.on('biome:enter', function () {
    capyClinging = false; capyClingCool = 0; capyClingT = 0;
    capy.climbing = false;
    capyHaulT = 0; capyStallT = 0; capyStepUsed = 0;
    capySwimming = false; capySwimAgo = 99;
    capyDiving = false; capyDiveGrace = 0; capyDiveT = 0; capyDiveDeep = 0;
    capy.diving = false; capy.swimming = false; capy.depth = 0; capy.diveTime = 0;
    capyLaunchT = 0;
    capyPlatVX = 0; capyPlatVZ = 0; capyPlatT = 0;
  });

  // -------------------------------------------------------------------
  // helpers
  // -------------------------------------------------------------------
  function capySpawnRings(x, z, waterY) {
    for (let k = 0; k < capyRING_COUNT; k++) {
      capyRingX[k] = x;
      capyRingY[k] = waterY + 0.26;    // clear of the +/-0.18 water ripple
      capyRingZ[k] = z;
      capyRingLife[k] = 1.4 - k * 0.16;  // all start at grow <= 0, expand in sequence
    }
  }

  function capyWheek() {
    // POP, not a swell: jump the squash value instantly so the stretch is
    // already at 1.25 on the very next frame, then let the spring ring it out.
    capyPop = capyPop > 0.65 ? capyPop : 0.65;
    capyPopVel = 9;
    capyWheekHold = 0.42;
    capyEarFlick = 1;
    // the shockwave, on the ground, right here
    capyWheekRing = 1;
    capyWheekX = capyPosition.x;
    capyWheekY = capyPosition.y - 0.30;
    capyWheekZ = capyPosition.z;
    capyWheekPayload.position = capyPosition;
    game.events.emit('capy:wheek', capyWheekPayload);
    game.sfx('wheek');
    game.completeTask('wheek');
    game.shake(0.14);
    // a wheek from centre stage is the joke — the player earns the task.
    // game.env is Sydney's module and stays resident abroad; every biome shares
    // one coordinate space, so the zone test only means anything in Sydney.
    const env = game.env;
    if (env && typeof env.inZone === 'function' &&
        game.biome && game.biome.isActive('sydney') &&
        env.inZone('operaStage', capyPosition.x, capyPosition.z)) {
      game.completeTask('opera-stage');
    }
  }

  function capyTryRelease() {
    const p = capy.heldProp;
    if (!p) return;
    // Mass-proportional impulse so the toss reads as a VELOCITY: every prop
    // leaves the mouth at the same arc regardless of how heavy it is.
    const m = Math.max(0.15, p.mass || 0.5);
    const spin = (p.spin === undefined || p.spin === null) ? 1 : p.spin;
    const power = (5.0 + (game.input.run ? 2.0 : 0)) * (0.8 + spin * 0.15);
    capyThrow.set(Math.sin(capyYaw), 0, Math.cos(capyYaw)).multiplyScalar(power * m);
    capyThrow.y = 4.2 * m;
    // props.js owns the held-state transition, the 'capy:drop' event and the sfx
    if (game.physics && typeof game.physics.release === 'function') game.physics.release(capyThrow);
    capyJawOpen = 1;
    // Stamped with the frame time so condor.js — which runs after this module,
    // by which point heldProp is already null — can tell a bomb release from a
    // dismount on the same key press.
    capy.threwAt = game.state.time;
  }

  function capyTryGrabStart() {
    if (!game.physics || typeof game.physics.nearestGrabbable !== 'function') return;
    if (!game.physics.nearestGrabbable(capyPosition, capyGRAB_RADIUS)) return;
    capyGrabTimer = capyGRAB_WINDUP;
  }

  // -------------------------------------------------------------------
  // AT THE WHEEL
  // quay.js owns the body while the capybara is driving the ferry, so this is
  // presentation only: stand up at the binnacle, front paws on the spokes, ears
  // back in the wind, and lean into whatever the boat is leaning into.
  // -------------------------------------------------------------------
  function capyHelmPose(dt) {
    const t = game.state.time;
    const q = game.quay;
    const sp = q && q.boat ? Math.abs(q.boat.speed) : 0;
    const st = clamp(sp / ((q && q.boat && q.boat.maxSpeed) || 11.5), 0, 1);

    capyPosition.set(body.position.x, body.position.y, body.position.z);
    capyVelocity.set(body.velocity.x, body.velocity.y, body.velocity.z);
    capyRenderPos.copy(capyRoot.position);
    capyYaw = capyRoot.rotation.y;
    capyPrevYaw = capyYaw;

    // reared up: the model tips back so the forepaws can reach the wheel
    capyModel.position.y = damp(capyModel.position.y, -capyFOOT_Y + 0.16, 8, dt);
    capyModel.rotation.x = damp(capyModel.rotation.x, -0.42, 8, dt);
    capyModel.rotation.z = damp(capyModel.rotation.z, 0, 8, dt);
    for (let i = 0; i < 4; i++) {
      const target = i < 2 ? 1.05 + Math.sin(t * 2.2 + i) * 0.05 : -0.10;
      legs[i].rotation.x = damp(legs[i].rotation.x, target, 9, dt);
      legs[i].rotation.z = damp(legs[i].rotation.z, i < 2 ? (i ? -0.18 : 0.18) : 0, 9, dt);
    }
    // head up and forward, watching the water
    capyHeadPitch = damp(capyHeadPitch, -0.24, 9, dt);
    head.rotation.x = capyHeadPitch;
    head.rotation.z = damp(head.rotation.z, 0, 9, dt);
    // ears stream aft with the speed; whiskers of spray at the top end
    const back = 0.20 + st * 0.85;
    earL.rotation.x = -back; earR.rotation.x = -back;
    earL.rotation.z = -0.18 - Math.sin(t * 9) * 0.05 * st;
    earR.rotation.z = 0.18 + Math.sin(t * 9) * 0.05 * st;
    capyBlink = capyBlink > 0 ? capyBlink - dt : 0;
    const eo = capyBlink > 0 ? 0.010 : 0.050;
    eyeL.scale.set(0.046, eo, 0.042);
    eyeR.scale.set(0.046, eo, 0.042);
    capyEarTimer -= dt;
    if (capyEarTimer <= 0) { capyEarTimer = rand(2.2, 5.5); capyBlink = 0.11; }

    if (game.input.honkPressed) capyWheek();
    if (capyWheekHold > 0) capyWheekHold -= dt;
    const jawTarget = capyWheekHold > 0 ? 1 : 0;
    capyJawOpen = damp(capyJawOpen, jawTarget, jawTarget > capyJawOpen ? 30 : 8, dt);
    jawHinge.rotation.x = capyJawOpen * 0.5;

    capySquash.scale.set(1, 1, 1);
    capy.grounded = true;
    capy.isRunning = false;
    capySpeedSm = 0;
    capyAirPose = 0;
    capyStallT = 0; capyStepUsed = 0; capyHaulT = 0;
    capyMouthLocal.set(0, -0.055, 0.50).applyEuler(head.rotation).add(head.position);
    mouthAnchor.position.copy(capyMouthLocal);
    mouthAnchor.quaternion.copy(head.quaternion);
    capyRoot.updateMatrixWorld(true);
  }

  // -------------------------------------------------------------------
  // UPDATE — zero allocations below this line
  // -------------------------------------------------------------------
  function capyUpdate(dt) {
    if (dt <= 0) dt = 1 / 60;
    const input = game.input;
    const env = capyWater(game);
    const t = game.state.time;
    // At the wheel of the ferry, quay.js owns this body outright — it parks the
    // capybara at the helm every frame. Running the walk controller as well
    // would fight it for the velocity and jitter the whole boat.
    if (capy.atHelm) { capyHelmPose(dt); return; }

    // ---- ground / water sensing -------------------------------------
    // The same sweep also picks up WHAT we are standing on. With ground friction
    // at zero (see the contact-pair note in props.js) a moving platform can no
    // longer drag the capybara along by its feet, so the ferry is carried here
    // instead: everything below solves in the platform's frame of reference, and
    // on solid ground that frame is simply (0, 0). This is more honest than
    // friction ever was — the deck now moves you exactly, not approximately.
    let grounded = false;
    let platVX = 0, platVZ = 0;
    const contacts = game.world.contacts;
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      let other = null;
      if (c.bi === body) { if (-c.ni.y > 0.4) { grounded = true; other = c.bj; } }
      else if (c.bj === body) { if (c.ni.y > 0.4) { grounded = true; other = c.bi; } }
      if (!other) continue;
      // Only something being DRIVEN counts — a static kerb has a zero velocity
      // and a loose prop is cargo, not a floor.
      if (other.mass !== 0 && other.mass < capyPLAT_MIN_MASS) continue;
      const ov = other.velocity;
      if (!ov) continue;
      if (ov.x * ov.x + ov.z * ov.z < 1e-4) continue;
      platVX = clamp(ov.x, -capyPLAT_VMAX, capyPLAT_VMAX);
      platVZ = clamp(ov.z, -capyPLAT_VMAX, capyPLAT_VMAX);
    }
    // ...or the biome simply says what the frame is. Applied AFTER the contact
    // sweep and before the latch, so a declared frame wins over a sniffed one
    // and everything below — the latch, the coyote window, the bleed — treats
    // it exactly like a ferry deck, which is what it is.
    const carried3 = capyCarryAt(game);
    if (carried3) {
      platVX = clamp(carried3.x, -capyPLAT_VMAX, capyPLAT_VMAX);
      platVZ = clamp(carried3.z, -capyPLAT_VMAX, capyPLAT_VMAX);
    }

    // JUST THROWN: there is no floor and there is no frame, whatever the solver
    // still has a contact point for. Checked before the coyote latch, because
    // the latch is the very thing that would hand the roof's velocity straight
    // back on the frame after a launch.
    if (capyLaunchT > 0) {
      capyLaunchT -= dt;
      grounded = false;
      platVX = 0; platVZ = 0;
      capyPlatVX = 0; capyPlatVZ = 0; capyPlatT = 0;
    } else if (platVX !== 0 || platVZ !== 0) {
      // riding something that is going somewhere: latch it
      capyPlatVX = platVX; capyPlatVZ = platVZ;
      capyPlatT = grounded ? capyPLAT_COYOTE : capyPLAT_AIR;
    } else if (grounded || capySwimming) {
      // A contact was found and it was not moving. That is solid ground, and
      // solid ground is the world frame — no fade, no memory, immediately.
      // Water counts: stepping off the side of a ferry doing ten metres a second
      // puts you in the harbour, and the harbour is not going anywhere.
      capyPlatVX = 0; capyPlatVZ = 0; capyPlatT = 0;
    } else if (capyPlatT > 0) {
      // no contact at all: a blip, or a jump. Either way you are still in it.
      capyPlatT -= dt;
      platVX = capyPlatVX; platVZ = capyPlatVZ;
    } else if (capyPlatVX !== 0 || capyPlatVZ !== 0) {
      // and if you are STILL in the air a second later you have genuinely left,
      // so the frame bleeds out instead of vanishing. Fading it is continuous in
      // world velocity — vx is re-derived against the shrinking frame every
      // frame — so what the player feels is air resistance, which is what it is.
      capyPlatVX = damp(capyPlatVX, 0, capyPLAT_FADE, dt);
      capyPlatVZ = damp(capyPlatVZ, 0, capyPLAT_FADE, dt);
      if (Math.abs(capyPlatVX) < 0.05 && Math.abs(capyPlatVZ) < 0.05) { capyPlatVX = 0; capyPlatVZ = 0; }
      platVX = capyPlatVX; platVZ = capyPlatVZ;
    }

    const px = body.position.x, py = body.position.y, pz = body.position.z;
    // How much the floor has agreed to hold on to. Zero everywhere but a
    // glacier and a dune face; see capySLIP_GRIP.
    const slip = capySlipAt(game, px, pz);
    capy.slip = slip;
    const waterY = capyWaterY(env, px, pz);
    const overWater = !!(env && typeof env.isOverWater === 'function' && env.isOverWater(px, pz));
    const wantSwim = overWater && py < waterY + capySWIM_ENTER;

    if (wantSwim && !capySwimming) {
      capySwimming = true;
      capySwimTime = 0;
      capySpawnRings(px, pz, waterY);
      game.sfx('splash');
      game.shake(0.18);
      body.velocity.y *= 0.15;
    } else if (!wantSwim && capySwimming) {
      capySwimming = false;
    }

    // ---- THE DIVE (chapter 12) -------------------------------------------
    // Decided here, with the swim, because everything below reads it: the speed
    // cap, the breath, the buoyancy spring and the pose all branch on it.
    // ...and it is asked WHERE THE ANIMAL IS, every frame, because the answer is
    // now a property of the water rather than of the chapter: paddle out of the
    // shallows in a place with a floor and the verb arrives under you.
    if (capySwimming && capyCanDive(game, px, pz)) {
      if (input.action && !capyStamBlown) {
        if (!capyDiving) {
          capyDiving = true; capyDiveT = 0; capyDiveDeep = 0;
          capyHaulT = 0;                  // and it cancels any clamber in flight
          capySfxOpts.volume = 0.55; capySfxOpts.pitch = 0.7;
          game.sfx('splash', capySfxOpts);
        }
        capyDiveGrace = capyDIVE_GRACE;
      } else if (capyDiveGrace > 0) {
        // A TAP OF E IS A GRAB, NOT A SURFACE. Without this window the one key
        // that takes you down is the one key that picks things up, and reaching
        // for the pearl throws you at the ceiling. During the grace the animal
        // holds its depth rather than rising, so the tap is invisible.
        capyDiveGrace -= dt;
      } else if (capyDiving) {
        capyDiving = false;
      }
    } else if (capyDiving) {
      capyDiving = false; capyDiveGrace = 0;
    }
    if (capyDiving) {
      capyDiveT += dt;
      const dNow = waterY - py;
      if (dNow > capyDiveDeep) capyDiveDeep = dNow;
    }
    capy.diving = capyDiving;
    // PUBLISHED, NOT INFERRED. A biome that wants to know whether the animal is
    // in the water cannot ask `depth > 0`: the depth of a capybara floating on
    // its own waterline is zero, and a wave passing under it makes that number
    // flicker. Same rule as `carriedBy` and `climbing` — if two modules have to
    // agree about state, one of them writes a flag and the other reads it.
    capy.swimming = capySwimming;
    capy.depth = capySwimming ? Math.max(0, waterY - py) : 0;
    capy.diveTime = capyDiving ? capyDiveT : 0;
    // ---- THE CLIMB: is there anything here to hang off? -------------------
    // Decided before the floor solve, because clinging means there is no floor
    // question to answer, and before the hop, because a hop off a wall is a
    // different hop. Nothing below this can put the animal on a lattice that the
    // biome did not offer, and no biome but one offers any.
    if (capyClingCool > 0) capyClingCool -= dt;
    const hold = (capySwimming || capy.carriedBy || capy.atHelm || capyClingCool > 0)
                 ? null : capyClimbAt(game, px, py, pz);
    const wantCling = !!hold && input.action && !capy.heldProp && py < hold.top;
    if (wantCling && !capyClinging) {
      capyClinging = true;
      capyClingT = 0;
      capySfxOpts.volume = 0.5; capySfxOpts.pitch = 1.25;
      game.sfx('rustle', capySfxOpts);
    } else if (!wantCling && capyClinging) {
      capyClinging = false;
    }
    if (capyClinging) { capyClingT += dt; grounded = false; }
    capy.climbing = capyClinging;

    // "Was there water under me recently" — the clamber latch reads this, not
    // capySwimming, which switches off 0.25 m into the climb.
    if (overWater && body.position.y < waterY + capySWIM_MEM_H) capySwimAgo = 0; else capySwimAgo += dt;

    // ---- THE AIR ITSELF MOVES (chapter 9) ---------------------------
    // Solved exactly the way the ferry's deck is, and for exactly the same
    // reason: everything below this line is relative to the frame the animal is
    // in, and platVX/platVZ is that frame's own velocity, added back on at the
    // very end. Nothing else in this module needed changing to make wind work.
    // Three things fall out of it for free and all three are correct —
    //   the airborne bleed now damps toward the AIR rather than toward the
    //   ground, which is what drag actually does;
    //   the speed cap limits the speed THROUGH the air, so a tailwind can carry
    //   you further than the controller would ever accelerate you;
    //   and the world velocity is continuous across the frame you land on,
    //   because vx is re-derived from body.velocity minus the new frame.
    if (!grounded && !capySwimming && !capy.carriedBy && !capy.atHelm) {
      const wind = capyWindAt(game);
      platVX += wind.x; platVZ += wind.z;
    }

    // ---- AND SO DOES THE WATER (chapter 4) --------------------------
    // The third thing to use this channel, after a ferry's deck and the Drift's
    // air, and the one that most obviously had to: a river.
    //
    // Every other way of doing it is wrong for the same reason it was wrong for
    // wind. A force is eaten by the speed cap — which for a swimming capybara is
    // 2.6 m/s, and is the whole reason swimming feels like swimming. Writing the
    // velocity deletes the player's steering, which is the ONLY input the Uji
    // run has. As a frame, the animal swims at its own honest 2.6 through water
    // that is itself doing six, so it cannot beat the river and can always cross
    // it — and the moment it grabs a bank the world velocity is continuous,
    // because vx is re-derived against the new frame.
    if (capySwimming) {
      const flow = capyFlowAt(game, px, pz);
      platVX += flow.x; platVZ += flow.z;
    }
    capy.frameVX = platVX; capy.frameVZ = platVZ;

    // ---- soft floor, in VELOCITY SPACE ------------------------------
    // The world has a real ground collider now, so this is only a backstop for
    // the lip at the quay and for any frame the contact solver misses. It must
    // never assign body.position: that fights contact resolution, micro-
    // oscillates, and (since previousPosition is left stale) smears the render.
    if (!overWater && !capyClinging) {
      const terr = capyGroundY(game, px, pz);
      const gap = terr + capyFOOT_Y - body.position.y;
      // ONLY when the solver has no contact of its own. Running this against a live
      // contact makes the backstop and the contact equation both push up in the same
      // frame: the body gets launched to y 0.378, loses contact, falls back, and
      // repeats — a stable bounce limit cycle that also chopped horizontal drive to
      // ~40% because the move force is gated on `grounded`.
      let lifted = false;
      if (!grounded && gap > capyGROUND_SLOP) {
        const rise = clamp(gap * capyGROUND_KP, 0, capyGROUND_VMAX);
        // only ever ADD upward intent — never brake a deliberate leap
        if (body.velocity.y < rise) body.velocity.y = damp(body.velocity.y, rise, 20, dt);
        grounded = true;
        lifted = true;
      } else if (gap > -0.02 && body.velocity.y <= 0.5) {
        grounded = true;                     // resting on the collider
      }
      // ---- REFUSE THE CONTACT PUSH-OUT (see capyHOP_KILL) ----------------
      // Standing on the floor, upward velocity can only have come from the
      // contact equation resolving penetration — the capybara cannot jump and
      // nothing else here pushes it up. Keeping it costs contact on the next
      // four frames and hands the landing an impulse that eats half the walk
      // speed. `lifted` is excluded because that IS the backstop's own recovery
      // rise, and a small deliberate shove (a rolling bin, a collapsing stall)
      // clears capyHOP_KILL and is left alone.
      if (!lifted && grounded && !capySwimming && !capy.carriedBy &&
          body.velocity.y > 0 && body.velocity.y < capyHOP_KILL &&
          gap > -capyREST_BAND) {
        body.velocity.y = 0;
      }
      // last resort: genuinely fell out of the world. This one IS a teleport, so
      // the interpolation history has to be rewritten with it.
      if (body.position.y < terr + capyVOID_Y) {
        body.position.y = terr + capyFOOT_Y;
        body.velocity.set(0, 0, 0);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        body.previousQuaternion.copy(body.quaternion);
        body.interpolatedQuaternion.copy(body.quaternion);
        capyRenderPos.set(body.position.x, body.position.y, body.position.z);
        grounded = true;
      }
    }

    // =================================================================
    // THE HOP
    // Sits between the floor solve and the movement solve: it needs to know
    // whether there is ground under the feet, and it needs its launch velocity
    // to survive into the step. Everything it touches is velocity — the
    // capybara never has its position written by this module.
    // =================================================================
    // ---- stamina ---------------------------------------------------------
    // Decided BEFORE the hop and the run, because both of them read it. Water
    // and passenger seats are free: a capybara swims all day, and hanging off a
    // condor's feet is the bird's problem. The drain is charged against the
    // INTENT to run rather than against the resulting speed, so being blocked by
    // a bin while holding shift still costs — otherwise the honest way to sprint
    // for ever would be to sprint into a wall.
    const stamMag2 = input.x * input.x + input.z * input.z;
    // SWIMMING IS FREE. HOLDING YOUR BREATH IS NOT — and it is the same bar,
    // because a bar that already means "how much have you got left" means the
    // right thing, and a second one would be a second thing to learn.
    const stamFree = (capySwimming && !capyDiving) || !!capy.carriedBy || !!capy.atHelm;
    const stamWantRun = !!input.run && stamMag2 > 0.01 && !stamFree;
    if (capyDiving) {
      capyStamHold = capySTAM_DELAY;
      capyStam -= capySTAM_BREATH * dt;
    } else if (stamFree) {
      capyStamHold = 0;
      capyStam += capySTAM_REGEN * dt;
      if (capyStam > 1) capyStam = 1;
    } else if (stamWantRun && !capyStamBlown) {
      capyStamHold = capySTAM_DELAY;
      capyStam -= capySTAM_DRAIN * dt;
    } else if (capyStamHold > 0) {
      capyStamHold -= dt;
    } else if (capyStam < 1) {
      capyStam += capySTAM_REGEN * (stamMag2 > 0.01 ? capySTAM_REGEN_M : 1) * dt;
      if (capyStam > 1) capyStam = 1;
    }
    if (capyStam <= 0) {
      capyStam = 0;
      if (!capyStamBlown) {
        // one beat of theatre on the way out, so running dry is a MOMENT rather
        // than a number quietly reaching zero
        capyStamBlown = true;
        capyEarFlick = 1;
        capyPop = capyPop > -0.16 ? -0.16 : capyPop;
        capySfxOpts.pitch = 0.82; capySfxOpts.volume = 0.5;
        game.sfx('gasp', capySfxOpts);
      }
    } else if (capyStamBlown && capyStam >= capySTAM_RECOVER) {
      capyStamBlown = false;
    }
    // OUT OF AIR IS NOT A DEATH, IT IS A DECISION THE GAME MAKES FOR YOU.
    // The animal lets go of the bottom and goes up, which is what a swimmer
    // does, and the gasp is already the sound stamina makes when it runs out.
    if (capyStamBlown && capyDiving) { capyDiving = false; capyDiveGrace = 0; capy.diving = false; }
    capy.stamina = capyStam;
    capy.grade = capyGrade;

    capy.blown = capyStamBlown;

    if (capyJumpCool > 0) capyJumpCool -= dt;
    if (capyJumpT > 0) capyJumpT -= dt;
    // "WAS IN THE AIR" IS LAST FRAME'S QUESTION, NOT THIS ONE.
    // This used to read `const wasAir = !grounded`, evaluated on the very frame
    // the contact appears — on which `grounded` is already TRUE. The landing
    // branch below therefore required grounded && !grounded and could never run
    // once, which is why the landing thud and the camera bump for a long fall
    // had never been heard by anybody. capyAirTime still holds the previous
    // frame's total at this point, so it is the honest answer.
    const wasAir = capyAirTime > 0.02;
    // ...and the impact speed has to be remembered too: the solver has already
    // resolved the contact by the time this module runs, so body.velocity.y on
    // the landing frame is about zero. Track the fastest descent of the flight.
    if (!grounded && body.velocity.y < 0) {
      const fv = -body.velocity.y;
      if (fv > capyFallV) capyFallV = fv;
    }
    // Out of puff, the animal does not leave the ground. Swimming is exempt —
    // being unable to hop out of the harbour is a way to be stuck, not a cost.
    const stamCanHop = capySwimming || (!capyStamBlown && capyStam >= capySTAM_HOP);
    // ---- KICKING OFF A WALL ------------------------------------------------
    // A hop while clinging is not the hop: it is a push-off, and it goes OUT as
    // well as up, because the useful thing to do from halfway up a scaffold is
    // to reach the balcony behind you. It also has to bar the wall for a third
    // of a second, or the grab key — which is still held, because that is what
    // clinging IS — catches you again on the very next frame and the kick reads
    // as a twitch.
    if (capyClinging && input.jumpPressed && capyJumpCool <= 0 && stamCanHop && hold) {
      body.velocity.y = capyCLIMB_KICKY;
      body.velocity.x = hold.nx * capyCLIMB_KICK;
      body.velocity.z = hold.nz * capyCLIMB_KICK;
      capyClinging = false; capy.climbing = false;
      capyClingCool = capyCLIMB_COOL;
      capyStam -= capySTAM_HOP; if (capyStam < 0) capyStam = 0;
      capyStamHold = capySTAM_DELAY;
      capyJumpT = capyJUMP_GRACE;
      capyJumpCool = capyJUMP_COOL;
      capyAirTime = capyCOYOTE;
      capyPop = capyPop < 0.34 ? 0.34 : capyPop;
      capyPopVel = 5;
      capySfxOpts.volume = 0.75; capySfxOpts.pitch = 1.2;
      game.sfx('pop', capySfxOpts);
    }
    const canHop = !capy.carriedBy && !capyClinging && capyJumpCool <= 0 && stamCanHop &&
                   (capySwimming || grounded || capyAirTime < capyCOYOTE);
    if (input.jumpPressed && canHop) {
      const v0 = capySwimming ? capySWIM_HOP : capyJUMP_V;
      if (body.velocity.y < v0) body.velocity.y = v0;
      if (!capySwimming) {
        capyStam -= capySTAM_HOP;
        if (capyStam < 0) capyStam = 0;
        capyStamHold = capySTAM_DELAY;
      }
      capyJumpT = capyJUMP_GRACE;
      capyJumpHold = capyJUMP_HOLD;
      capyJumpCool = capyJUMP_COOL;
      // A KICK OFF THE BOTTOM ENDS THE DIVE. Space has meant "up" for twelve
      // chapters and it is not about to start meaning something else.
      if (capyDiving) { capyDiving = false; capyDiveGrace = 0; capy.diving = false; }
      capyJumpArm = !capySwimming;
      capyAirTime = capyCOYOTE;          // the coyote window is spent, not doubled
      grounded = false;
      capyPop = capyPop < 0.30 ? 0.30 : capyPop;   // stretch out of the crouch
      capyPopVel = 5;
      capyEarFlick = 1;
      capySfxOpts.pitch = capySwimming ? 0.9 : 1.35;
      capySfxOpts.volume = 0.45;
      game.sfx(capySwimming ? 'splash' : 'pop', capySfxOpts);
    }
    // Variable height: hold for the full arc, release early for a clipped one.
    if (capyJumpArm) {
      if (body.velocity.y <= 0 || !input.jump || capyJumpHold <= 0) {
        capyJumpArm = false;
      } else {
        capyJumpHold -= dt;
        body.velocity.y += capyJUMP_HOLD_A * dt;
      }
    }
    // Leaving the ground has to STICK for a few frames or the contact the
    // capybara has not cleared yet reports grounded and the gait never lifts.
    if (capyJumpT > 0) grounded = false;

    if (grounded) capyAirTime = 0; else capyAirTime += dt;
    const effGround = grounded || capyAirTime < 0.12;
    capy.grounded = grounded;
    // Landing: one squash, one thud, proportional to how far it fell.
    if (wasAir && grounded && !capySwimming && capyJumpT <= 0) {
      const fall = capyFallV;
      // the absorb runs on ANY landing, however gentle — it is the difference
      // between an animal arriving and a sprite changing state
      if (fall > 0.8) capyLandVel -= clamp(fall * capyLAND_SCALE, 0, 0.30) * capyLAND_C;
      if (fall > 3) {
        capyPop = capyPop > -0.34 ? -0.34 : capyPop;
        capyPopVel = -4;
        capySfxOpts.pitch = clamp(1.18 - fall * 0.035, 0.72, 1.18);
        capySfxOpts.volume = clamp(fall * 0.06, 0.15, 0.6);
        game.sfx('thud', capySfxOpts);
        if (fall > 7) game.shake(clamp((fall - 7) * 0.02, 0, 0.12));
        // a hard arrival kicks up dust, which is what tells you it was hard
        capyDigPayload.position = capyPosition;
        if (fall > 5.5) game.events.emit('capy:land', capyDigPayload);
      }
      capyStallT = 0; capyStepUsed = 0;
      capyFallV = 0;
    }
    if (grounded) capyFallV = 0;

    // being hauled to the gate by the gardener (npc.js pins us at y 2.25)
    // ---- BEING CARRIED IS SOMETHING SOMEBODY IS DOING TO YOU ---------------
    // This used to read `capy.carriedBy || (!grounded && y > 1.5)`, and the
    // second half was a guess standing in for a flag npc.js never set: the
    // gardener pins the body at y 1.62, so "airborne and high up" meant "in his
    // hands". It was true in Sydney, where the ground is at y = 0 and 1.5 m is
    // over your head, and it has been quietly wrong in every chapter with relief
    // in it since — on the flank of Galeras, on the glacier, on the great dune,
    // and on every single deck in the Drift (the lowest of which is thirty
    // metres up), EVERY HOP rendered as the dangling flail: legs windmilling,
    // head down, no tuck, model rolled onto its side. Nobody spotted it because
    // it only fires in mid-air and it looks like an animation, not a bug.
    // The gardener sets the flag now. The guess is gone.
    const carried = !!capy.carriedBy;

    // ---- desired move, camera relative -------------------------------
    const cy = Math.cos(input.camYaw), sy = Math.sin(input.camYaw);
    let dx = input.x * cy + input.z * sy;
    let dz = -input.x * sy + input.z * cy;
    let mag = Math.sqrt(dx * dx + dz * dz);
    if (mag > 1) { dx /= mag; dz /= mag; mag = 1; }

    // ---- FACING: driven by INTENT, never by velocity. A reversal turns
    //      the nose immediately instead of waiting for the velocity to
    //      cross zero (no moonwalk), and the turn rate stays at full
    //      lambda exactly when it matters most.
    if (mag > 0.02) {
      const target = Math.atan2(dx, dz);
      capyYaw += capyWrapAngle(target - capyYaw) * (1 - Math.exp(-capyTURN_LAMBDA * dt));
    }

    const running = input.run && mag > 0.1 && !capySwimming && !capyStamBlown;
    capy.isRunning = running;
    // A DIVING CAPYBARA IS FASTER THAN A PADDLING ONE, which is not a game
    // design decision — a body entirely in the water stops dragging half of
    // itself along the surface, and that is most of the drag.
    let topSpeed = capyDiving ? capyDIVE_SPEED
                 : capySwimming ? capySWIM_SPEED : (running ? capyRUN : capyWALK);
    // Blown is not just "no sprint": the walk itself goes heavy for a beat, which
    // is what makes the recovery readable without a single word of UI.
    if (capyStamBlown && !capySwimming) topSpeed *= capySTAM_TIRED;
    if (capy.heldProp) topSpeed *= 0.94;

    // ---- A HILL IS A HILL (Tobler's hiking function) -----------------------
    // Eleven biomes publish slopeAt() and NOTHING had ever read it, so a 23
    // degree dune, the flank of a volcano, the switchbacks up Cristo Rey and
    // the moraine all walked at exactly the speed of flat paving. slopeAt is
    // the gradient MAGNITUDE, which cannot tell uphill from downhill, so the
    // signed grade is taken from the terrain itself along the direction of
    // travel — one extra terrainHeight sample per frame.
    //
    // The model is Tobler's, the standard empirical one for walking speed on a
    // gradient: v = 6*exp(-3.5*|G + 0.05|) km/h. It is not symmetric and that
    // is the interesting part — it peaks slightly DOWNHILL (G = -0.05), which
    // is why a gentle descent feels free and a steep one does not.
    //
    // Floored at capyGRADE_MIN, because a slope you cannot climb is a wall
    // rather than a run, and switched off wherever the ground is already
    // sliding: on ice the slip model owns the speed and the two would fight.
    capyGrade = 0;
    if (effGround && !capySwimming && !capyClinging && mag > 0.02 && slip < 0.35) {
      const ah = capyGroundY(game, px + dx * capyGRADE_LOOK, pz + dz * capyGRADE_LOOK);
      const here = capyGroundY(game, px, pz);
      if (ah === ah && here === here) {
        const g = clamp((ah - here) / capyGRADE_LOOK, -1.2, 1.2);
        capyGrade = g;
        const tob = Math.exp(-3.5 * Math.abs(g + 0.05)) / capyGRADE_FLAT;
        topSpeed *= clamp(tob, capyGRADE_MIN, capyGRADE_MAX);
      }
    }


    // Everything from here to the shove is solved RELATIVE TO THE FLOOR: on solid
    // ground platVX/platVZ are zero and this is exactly the old arithmetic, and on
    // the ferry "stand still" means stand still on the DECK rather than hold
    // station over the harbour while the deck slides out from under you.
    let vx = body.velocity.x - platVX, vz = body.velocity.z - platVZ;

    if (mag > 0.02) {
      // Facing-gated acceleration: lean into a turn rather than drive straight
      // out of it. The floors used to be 0.45 of top speed and 0.30 of the accel,
      // which meant any turn past 90 degrees dumped 55% of the speed and then
      // took a fifth of a second to buy it back — weaving between two props read
      // as the animal repeatedly sticking. Raised so a turn costs a quarter of
      // the speed rather than half; the pivot still reads, it just is not a stop.
      const fwdx = Math.sin(capyYaw), fwdz = Math.cos(capyYaw);
      const align = capySwimming ? 1 : clamp(fwdx * dx + fwdz * dz, 0, 1);
      // ON A SLIDE, THE TARGET SPEED HAS TO RISE WITH THE CEILING.
      // This block steers by pulling the velocity toward `target`, so leaving
      // the target at walking pace while the capybara is doing nineteen metres
      // a second means every attempt to STEER is also a hard brake — press
      // forward down a glacier and you would slow to a jog. Raising it by the
      // same factor as the cap makes the stick steer and never brake, which is
      // the difference between sliding and being dragged.
      const slipSpeed = topSpeed * (1 + slip * capySLIP_CAP);
      const tx = dx * slipSpeed * (0.74 + 0.26 * align);
      const tz = dz * slipSpeed * (0.74 + 0.26 * align);
      const control = capySwimming ? 0.55
        : (effGround ? 1 - slip * capySLIP_CTRL : capyAirCtl(game));
      const step = capyACCEL * control * (0.62 + 0.38 * align) * dt;
      let ex = tx - vx, ez = tz - vz;
      const el = Math.sqrt(ex * ex + ez * ez);
      if (el > 1e-5) {
        const s = el <= step ? 1 : step / el;
        vx += ex * s; vz += ez * s;
      }
    } else if (capySwimming) {
      vx = damp(vx, 0, 2.5, dt);
      vz = damp(vz, 0, 2.5, dt);
    } else if (effGround) {
      // The ONLY horizontal friction the capybara has, now that the contact pair
      // is frictionless — and on a slope it is also the only thing holding the
      // animal up the hill, so it is stiff and it snaps. See capyGRIP_LAMBDA.
      // The grip IS the slide. On ice this damper is switched almost entirely
      // off and the frictionless contact does the rest; the snap-to-zero has to
      // go with it, or the animal would stick to a twenty-degree slope every
      // time it dipped below walking pace.
      const grip = slip > 0.001
        ? 1 / lerp(1 / capyGRIP_LAMBDA, 1 / capyGRIP_ICE, slip)
        : capyGRIP_LAMBDA;
      vx = damp(vx, 0, grip, dt);
      vz = damp(vz, 0, grip, dt);
      if (slip < 0.35 && vx * vx + vz * vz < capyGRIP_SNAP * capyGRIP_SNAP) { vx = 0; vz = 0; }
    } else if (!capySwimming) {
      // airborne: keep the old gentle bleed so a fall still carries its arc
      vx = damp(vx, 0, capySTOP_LAMBDA * 0.15, dt);
      vz = damp(vz, 0, capySTOP_LAMBDA * 0.15, dt);
    }

    // external shoves ride ON TOP of the solved velocity, so a rolling bin
    // actually knocks the capybara sideways instead of being eaten by the
    // controller.
    vx += capyShove.x;
    vz += capyShove.z;
    capyShove.x = damp(capyShove.x, 0, 4, dt);
    capyShove.z = damp(capyShove.z, 0, 4, dt);

    const sp = Math.sqrt(vx * vx + vz * vz);
    // A ceiling of "a bit over a jog" is right for an animal that is walking and
    // catastrophically wrong for one that is falling down a glacier: it would eat
    // every metre per second gravity handed over, and the longest run in the game
    // would happen at exactly walking pace. So the ceiling rises with the slip,
    // and stops being a hard limiter and starts being a terminal velocity.
    const cap = topSpeed * (1 + slip * capySLIP_CAP) + 0.05 +
                Math.abs(capyShove.x) + Math.abs(capyShove.z);
    if (sp > cap) {
      const lam = effGround ? Math.max(0.8, 9 - slip * capySLIP_LAM) : 3;
      const shrink = damp(sp, cap, lam, dt) / sp;
      vx *= shrink; vz *= shrink;
    }
    // groundSpeed is the speed OVER THE FLOOR — it drives the gait, and a
    // capybara standing still on a moving ferry must not break into a run.
    const groundSpeed = Math.sqrt(vx * vx + vz * vz);
    body.velocity.x = vx + platVX;
    body.velocity.z = vz + platVZ;

    // ---- ...UNLESS WE ARE HANGING OFF SOMETHING ----------------------------
    // The whole ground solve above is written against a floor, and on a wall
    // there is no floor to write against, so this overrides it outright rather
    // than trying to blend with it. Three axes, all in velocity space (this
    // module never assigns a position), read against the FACE rather than
    // against the world:
    //
    //   into the face   -> up      (and out of it -> down, faster)
    //   across the face -> shuffle
    //   the face itself -> a steady pull toward it, so contact is never lost
    //
    // Gravity is simply not in the answer: velocity.y is assigned, not added to,
    // so whatever the solver applied this step is replaced. That is the same
    // trick the Drift's puff plays from inside its own biome, and it is safe for
    // the same reason — nothing downstream of here touches vertical velocity.
    if (capyClinging && hold) {
      // the stick, resolved onto the face. dx/dz are already camera-relative
      // world axes, so this is two dot products and no trigonometry.
      const into = -(dx * hold.nx + dz * hold.nz);          // +1 = pressed at the wall
      let across = dx * -hold.nz + dz * hold.nx;             // tangent, right-handed
      across = Math.abs(across) < capyCLIMB_DEAD ? 0
             : (across - Math.sign(across) * capyCLIMB_DEAD) / (1 - capyCLIMB_DEAD);
      const rate = into >= 0 ? into * capyCLIMB_UP : into * capyCLIMB_DOWN;
      body.velocity.y = rate;
      // the pull toward the face keeps the contact honest; the shuffle rides on
      // top of it, and neither is capped by topSpeed, which is a walking number
      body.velocity.x = -hold.nx * capyCLIMB_STICK + (-hold.nz) * across * capyCLIMB_SIDE;
      body.velocity.z = -hold.nz * capyCLIMB_STICK + (hold.nx) * across * capyCLIMB_SIDE;
      // TOPPING OUT. The lattice ends somewhere and the animal has to end up ON
      // the thing rather than pawing at the last rung of it for ever, so the top
      // metre of the climb is given a shove over the parapet.
      if (hold.top - py < 0.9 && into > 0.1) {
        body.velocity.y = capyCLIMB_UP * 1.15;
        body.velocity.x -= hold.nx * 2.2;
        body.velocity.z -= hold.nz * 2.2;
      }
      // ---- OUT OF PUFF MEANS YOU STOP, NOT THAT YOU FALL -------------------
      // Dropping a blown animal off a wall is the obvious cost and it is the
      // wrong one: it is a punishment for a thing the player cannot see coming,
      // in a chapter whose entire pitch is that going up is now possible. So
      // being blown takes the UP away and leaves the grip — hang, wait, carry
      // on — and the working decks are there to wait on. Coming down is always
      // allowed, because a wall you cannot get off is a trap.
      if (capyStamBlown) {
        if (body.velocity.y > 0) body.velocity.y = 0;
      } else if (into > 0.02) {
        capyStam -= capyCLIMB_STAM * dt * into;
        if (capyStam < 0) capyStam = 0;
        capyStamHold = capySTAM_DELAY;
      }
      // face the wall, always: a climbing animal that is looking over its
      // shoulder reads as falling
      capyYaw += capyWrapAngle(Math.atan2(-hold.nx, -hold.nz) - capyYaw) *
                 (1 - Math.exp(-capyTURN_LAMBDA * dt));
    }

    // ---- STEP ASSIST / HAULING OUT ----------------------------------
    // Two halves of the same idea: the stick is hard over and the capybara is
    // going nowhere, so give it the rise its legs would have found. On land
    // that is a kerb or a stair tread; in the water it is the sea wall, and
    // without it the harbour is a one-way trip (see capyHAUL_V).
    let hauling = false;
    const wantsIt = mag > 0.2 && !capy.carriedBy && !capyClinging && capyJumpT <= 0;
    // --- (re)arm the clamber ---
    // NOT WHILE DIVING, and this is the single most important word in the
    // condition. The clamber exists to get a swimmer OUT — up a sea wall, onto
    // a pontoon — and it arms on "in water, holding the stick, and not making
    // much progress". Underwater that is true every time you slow down for
    // anything at all: measured in Palawan, a capybara that paused on the
    // seabed was hauled eleven metres to the surface at four metres a second
    // and pinned against the roof of the tunnel it was trying to swim through.
    // A diving animal is deliberately going the other way and the game must not
    // argue with it.
    if (wantsIt && !capyDiving && capySwimAgo < capyWATER_MEM &&
        body.position.y < waterY + capyHAUL_TOP) {
      const dry = !!(env && typeof env.isOverWater === 'function' &&
                     !env.isOverWater(px + dx * capyHAUL_PROBE, pz + dz * capyHAUL_PROBE));
      if (dry || groundSpeed < 0.6) capyHaulT = capyHAUL_HOLD;
    }
    // --- run it ---
    if (capyHaulT > 0) {
      capyHaulT -= dt;
      // Out: standing on something above the waterline, or the player let go.
      if (!wantsIt || (grounded && body.position.y > waterY + capySWIM_OUT_H) ||
          body.position.y > waterY + capyHAUL_TOP) {
        capyHaulT = 0;
      } else {
        hauling = true;
        if (body.velocity.y < capyHAUL_V) body.velocity.y = capyHAUL_V;
        body.velocity.x = dx * capyHAUL_FWD + platVX;
        body.velocity.z = dz * capyHAUL_FWD + platVZ;
      }
    }
    // --- kerbs and stair treads ---
    // The budget is per BLOCKAGE, and a blockage ends when the capybara has
    // actually got somewhere — not merely when it left the floor. Resetting on
    // "airborne" instead turned an unclimbable wall (the concert hall's flank,
    // say) into a pogo stick: assist, leave the ground, reset, land, assist.
    if (wantsIt && !hauling && !capySwimming && !capyClinging) {
      const mx = px - capyStepX, mz = pz - capyStepZ;
      if (mx * mx + mz * mz > 0.36) { capyStepX = px; capyStepZ = pz; capyStepUsed = 0; }
      if (effGround && groundSpeed < topSpeed * 0.9 * capySTEP_FRAC) capyStallT += dt;
      else capyStallT = 0;
      if (effGround && capyStallT > capySTEP_STALL && capyStepUsed < capySTEP_MAX) {
        capyStepUsed += capySTEP_V * dt;
        if (body.velocity.y < capySTEP_V) body.velocity.y = capySTEP_V;
      }
    } else if (!hauling) {
      capyStallT = 0; capyStepUsed = 0; capyStepX = px; capyStepZ = pz;
    }

    // ---- buoyancy ----------------------------------------------------
    if (capySwimming) {
      capySwimTime += dt;
      const bobTarget = waterY + capyFLOAT_OFF + Math.sin(t * 2.3) * 0.045;
      // CLAMPED, and it has to be. The spring is proportional to the gap, which
      // was harmless while the deepest water in the game was knee-deep and is
      // not once there is a seabed fourteen metres down: uncapped it hands back
      // eighty-four metres a second, and the animal comes up like a cork out of
      // a bottle and keeps going. Three and a half is a brisk, readable ascent.
      const rise = clamp((bobTarget - body.position.y) * 6, -capyRISE_MAX, capyRISE_MAX);
      // Cancel the gravity the solver already applied this step. Without this the
      // spring only balances gravity once it is ~0.6 units *below* the target, so
      // the capybara floated fully submerged instead of riding the waterline.
      body.velocity.y -= game.world.gravity.y * dt;
      // ...but never while the animal is deliberately going UP. The waterline
      // spring is stiff enough to eat a clamber or a hop whole, which is what
      // made the sea wall unclimbable in the first place.
      if (capyDiving || capyDiveGrace > 0) {
        // DOWN, and then LEVEL just off the bottom. The seabed has a collider,
        // so this could have been left to the solver — but a capybara that
        // grinds along the sand nose-first for the whole chapter is a capybara
        // nobody can see, and the view is the entire reason to be down here.
        const floorY = capyGroundY(game, px, pz) + capyFOOT_Y + capyDIVE_FLOOR;
        let want = capyDiving ? -capyDIVE_V : 0;
        if (body.position.y < floorY) want = clamp((floorY - body.position.y) * 3, 0, 1.6);
        body.velocity.y = damp(body.velocity.y, want, 6, dt);
      } else if (!hauling && capyJumpT <= 0 && capyHaulT <= 0) {
        body.velocity.y = damp(body.velocity.y, rise, 7, dt);
      }
      capyWetLevel = 1;
      capyWakeT -= dt;
      if (capyWakeT <= 0 && groundSpeed > 0.6) { capyWakeT = 0.32; capySpawnRings(px, pz, waterY); }
      if (capySwimTime > 0.7 && !capySwamOnce) { capySwamOnce = true; game.completeTask('swim'); }
    } else {
      capyWetLevel = clamp(capyWetLevel - capyWET_DECAY * dt, 0, 1);
    }
    // ---- ...AND STANDING IN THE RAIN IS ALSO BEING WET --------------------
    // The whole dry/wet material pair, the shake, the darkened fur and the
    // drips already existed and were reachable by exactly one route: getting
    // in the water. An animal that walks through a sixty-second downpour and
    // comes out with a dry coat is the tell that the weather is a decal.
    //
    // A FLOOR, not an assignment. Swimming still slams it to 1 and the shake
    // still works, because the shake sets capyWetLevel down and the floor only
    // holds it where the sky has genuinely put it. And it is deliberately
    // BELOW the level a swim gives: getting rained on is damp, getting in the
    // harbour is soaked, and the two must not read the same.
    if (game.weather) {
      const sky = game.weather.wetness() * capyRAIN_WET;
      if (sky > capyWetLevel) capyWetLevel = sky;
    }
    capy.wet = capyWetLevel;

    // ---- upright lock + yaw drive, both CRITICALLY DAMPED ------------
    // The yaw still goes THROUGH the solver (never teleported) so the nose/tail
    // spheres sweep with a real velocity and shove props instead of ejecting
    // them. What changed: the old drive was err/dt — a deadbeat gain that lands
    // the whole error in exactly one step, so any contact torque it disagreed
    // with came back as ringing. Now it is feed-forward (the intent yaw's own
    // rate, which keeps the turn as snappy as before) plus a proportional term
    // on the residual. First order, gain*dt = 0.3, so it settles, never rings.
    const yawDelta = capyWrapAngle(capyYaw - capyPrevYaw);
    capyPrevYaw = capyYaw;
    const rawRate = yawDelta / dt;
    capyBodyYaw = Math.atan2(2 * (body.quaternion.w * body.quaternion.y),
                             1 - 2 * body.quaternion.y * body.quaternion.y);
    body.angularVelocity.y = clamp(rawRate + capyWrapAngle(capyYaw - capyBodyYaw) * capyYAW_KP, -16, 16);
    // Roll/pitch: restore toward upright instead of hard-zeroing. Zeroing froze
    // the RATE but left whatever tilt the step had already accumulated, so the
    // body slowly leaned and the yaw extraction above drifted with it. The axis
    // that rotates the body's up-vector back onto world up is (-up.z, 0, up.x).
    body.quaternion.vmult(capyUpLocal, capyUpWorld);
    // Pitch/roll are LOCKED, not sprung. A P-controller on the angular rate cannot
    // win against the contact-friction torque that walking generates: it settles
    // into a permanent ~5 deg forward lean that keeps oscillating. Because the body
    // is a 3-sphere compound spread +/-0.34 along z, a 5 deg pitch lifts its centre
    // by 0.34*sin(5deg) = 0.03 — which is exactly the y 0.349<->0.379 bounce that
    // broke contact every few frames and, since the move force is gated on
    // `grounded`, chopped horizontal speed from 4.06 to 1.18 m/s. That was the
    // reported "jerky movement". Zero the rate AND erase the accumulated tilt.
    body.angularVelocity.x = 0;
    body.angularVelocity.z = 0;
    if (capyUpWorld.y < 0.99999) {
      body.quaternion.setFromAxisAngle(capyUpLocal, capyBodyYaw);
      body.previousQuaternion.copy(body.quaternion);
      body.interpolatedQuaternion.copy(body.quaternion);
    }

    // ---- mirrors (everyone else reads these) -------------------------
    capyPosition.set(body.position.x, body.position.y, body.position.z);
    capyVelocity.set(body.velocity.x, body.velocity.y, body.velocity.z);

    // ---- loitering on the podium also counts, eventually --------------
    if (env && typeof env.inZone === 'function' && !capySwimming && grounded &&
        env.inZone('operaStage', capyPosition.x, capyPosition.z)) {
      capyStageTime += dt;
      if (capyStageTime > 5) game.completeTask('opera-stage');
    } else {
      capyStageTime = 0;
    }

    // =================================================================
    // ACTIONS
    // =================================================================
    if (input.honkPressed) capyWheek();

    // The action key is shared with the condor, and condor.js runs AFTER this
    // module — so when the talons are in reach the same press used to throw the
    // held prop here and board the bird there. That is why you could never carry
    // anything up to the crater: 'Post something into the crater' is only
    // reachable by air, and taking to the air emptied your mouth. Defer.
    const talonsHere = !!(game.condor && typeof game.condor.talonInReach === 'function' &&
                          game.condor.talonInReach());
    if (input.actionPressed && !talonsHere) {
      if (capy.heldProp) capyTryRelease();
      else capyTryGrabStart();
    }
    // A STARTED GRAB IS A COMMITMENT. This used to read
    //   if (!input.action && capyGrabTimer > 0) capyGrabTimer = 0;
    // which cancelled the wind-up the instant the key came back up — and the
    // wind-up is 0.10 s, which is SHORTER THAN A MOUSE CLICK. Measured against
    // a 60 ms tap the grab never fired at all, so "walk up to the thing and
    // click it" simply did not work; the coffee sack in Pasto (and every other
    // prop) could only be picked up by someone who happened to hold the button.
    // The wind-up is animation, not a charge meter: once it starts it fires.

    if (capyGrabTimer > 0) {
      capyGrabTimer -= dt;
      if (capyGrabTimer <= 0) {
        // re-resolve at FIRE time — the stored target may be metres behind us
        // by now, or may have been removed from the world entirely.
        const p = (game.physics && typeof game.physics.nearestGrabbable === 'function')
          ? game.physics.nearestGrabbable(capyPosition, capyGRAB_RADIUS) : null;
        // props.js owns held-state, the 'capy:grab' event and the sfx
        if (p && typeof game.physics.grab === 'function' && game.physics.grab(p)) capyJawOpen = 1;
      }
    }
    // someone (a tourist, gravity, props.js) may have taken it back
    if (capy.heldProp && capy.heldProp.held === false) capy.heldProp = null;

    // ---- DIG: hold action, standing still, on diggable ground --------
    const onStage = !!(env && typeof env.inZone === 'function' &&
                       env.inZone('operaStage', capyPosition.x, capyPosition.z));
    const diggable = !onStage && !overWater;
    const canDig = input.action && !capy.heldProp && !capySwimming && effGround &&
                   groundSpeed < 0.7 && !overWater && capyGrabTimer <= 0;
    if (canDig) {
      capyDigTimer += dt;
      if (capyDigTimer >= capyDIG_TIME) {
        capyDigTimer = -0.30;                      // cooldown before the next scoop
        if (diggable) {
          // props.js listens for this and owns the soil debris
          capyDigPayload.position = capyPosition;
          game.events.emit('capy:dig', capyDigPayload);
        }
        game.sfx(diggable ? 'rustle' : 'thud');
        game.shake(0.09);
        capyPopVel = 6;
      }
    } else if (capyDigTimer > 0) {
      capyDigTimer = 0;
    } else if (capyDigTimer < 0) {
      capyDigTimer = Math.min(0, capyDigTimer + dt);
    }
    // head stays down through the cooldown so holding E is one continuous burrow
    const digging = canDig && capyDigTimer > -0.30;

    // =================================================================
    // ANIMATION
    // =================================================================
    capyYawRate = damp(capyYawRate, clamp(rawRate, -6, 6), 10, dt);

    // ---- RENDER TRANSFORM: interpolated, not simulated ---------------
    // body.position is the last completed 60Hz tick; interpolatedPosition is
    // where the body is at THIS display instant. Rendering from the former is
    // what made the motion look jerky on any refresh rate that isn't 60.
    const ipos = body.interpolatedPosition;
    // If something outside this module teleported the body (npc.js hauling us to
    // the gate does exactly that), the interpolation history is stale and would
    // smear us across the map. Detect it and rebuild the history in place.
    const dsx = ipos.x - body.position.x, dsy = ipos.y - body.position.y, dsz = ipos.z - body.position.z;
    if (dsx * dsx + dsy * dsy + dsz * dsz > capyDESYNC2) {
      body.previousPosition.copy(body.position);
      ipos.copy(body.position);
      body.previousQuaternion.copy(body.quaternion);
      body.interpolatedQuaternion.copy(body.quaternion);
      capyRenderPos.set(ipos.x, ipos.y, ipos.z);
    }
    // ---- PREDICT, THEN CORRECT ---------------------------------------
    // Reading interpolatedPosition straight into the mesh is right at a steady
    // frame rate and WRONG at a real one. cannon's interpolation alpha is
    // (accumulator / step) AFTER the substeps have run, so when frame times
    // wobble — which they always do — some frames take two steps, some take
    // none, and the alpha is not monotonic. The rendered position therefore
    // walks forward, forward, back, forward across up to a whole physics step
    // (v/60, i.e. 7 cm at a walk and 33 cm under a condor).
    // MEASURED as the second difference of the rendered transform, in
    // millimetres per frame squared: at a steady 144 Hz the capybara reads 0.23
    // and the camera 0.006; feed the same run a +/-30% jitter on dt and they go
    // to 7.33 and 7.49. A THIRTY-FOLD increase, and the jitter case is the one
    // every player actually has.
    // The cure is not more damping — a plain low-pass lags by v/lambda, which at
    // flight speed is most of a metre of rubber band. It is to PREDICT with the
    // velocity we already know exactly, and then let the correction term mop up
    // only the sawtooth. At constant velocity the prediction is exact and this
    // filter is a no-op; the moment the target jitters, it eats the jitter.
    capyRenderPos.x += body.velocity.x * dt;
    capyRenderPos.z += body.velocity.z * dt;
    capyRenderPos.x = damp(capyRenderPos.x, ipos.x, capyRENDER_LAMBDA, dt);
    capyRenderPos.z = damp(capyRenderPos.z, ipos.z, capyRENDER_LAMBDA, dt);
    // A prediction that has fallen a long way behind is not a prediction, it is
    // a teleport nobody told us about (npc.js hauling us to the gate, a biome
    // switch, the ferry). Snap rather than glide across the map.
    const rex = capyRenderPos.x - ipos.x, rez = capyRenderPos.z - ipos.z;
    if (rex * rex + rez * rez > capyRENDER_SNAP2) { capyRenderPos.x = ipos.x; capyRenderPos.z = ipos.z; }
    // Vertical gets the same treatment, plus a stiffer filter while resting on
    // the ground: contact resolution leaves millimetres of noise in y that
    // interpolation would happily show off. Any real vertical motion — falling,
    // being carried, bobbing in the harbour — is predicted by its own velocity,
    // so this can never add lag to something the player is actually doing.
    const restingY = grounded && !capySwimming && body.velocity.y > -0.8 && body.velocity.y < 0.8;
    if (restingY) {
      capyRenderPos.y = damp(capyRenderPos.y, ipos.y, capyRENDER_Y_LAMBDA, dt);
    } else {
      capyRenderPos.y += body.velocity.y * dt;
      capyRenderPos.y = damp(capyRenderPos.y, ipos.y, capyRENDER_LAMBDA, dt);
      const rey = capyRenderPos.y - ipos.y;
      if (rey * rey > capyRENDER_SNAP2) capyRenderPos.y = ipos.y;
    }
    capyRoot.position.copy(capyRenderPos);
    // yaw is rendered from the INTENT angle, which is already dt-damped and
    // continuous — smoother than the solver's quaternion and never quantised.
    capyRoot.rotation.y = capyYaw;

    // gait — cadence locked to stride length so the feet stop skating. Driven by
    // a smoothed speed: raw groundSpeed jitters with every contact, and a jittery
    // cadence is a stuttering leg even under perfect interpolation.
    capySpeedSm = damp(capySpeedSm, groundSpeed, capySPEED_LAMBDA, dt);
    const gaitSpeed = capySpeedSm;
    const gaitRate = capySwimming ? 7.5 : clamp(Math.PI * gaitSpeed / capySTRIDE, 2.6, 34);
    const moving = gaitSpeed > 0.35 || capySwimming;
    if (moving) {
      capyLegPhase += gaitRate * dt;
      // ---- FOOTFALL, ON THE GAIT ITSELF ------------------------------
      // Fired off the leg phase rather than off a timer, so the sound is
      // locked to the frame the foot is actually down however the cadence
      // changes. Two per cycle: the capybara is a diagonal-couplet walker,
      // so its four feet land in two pairs.
      const halfCycle = Math.floor(capyLegPhase / Math.PI);
      if (halfCycle !== capyStepPhase) {
        capyStepPhase = halfCycle;
        if (!capySwimming && grounded && !carried) {
          capySfxOpts.pitch = capySurfacePitch(game, env, px, pz, body.position.y);
          // a walk whispers, a run carries — and the very first stride out of
          // a standstill is quiet rather than a slap
          capySfxOpts.volume = clamp(gaitSpeed / capyRUN, 0, 1) * 0.85 + 0.15;
          // ---- AND WHAT IT SOUNDS LIKE WHEN THE GROUND HAS WATER ON IT ----
          // The surface pitch already says what the ground is MADE of; this
          // says what is lying on it. They are two different questions and
          // folding the second into the first would have been the obvious
          // mistake — a wet cobble is not a softer cobble, it is a cobble with
          // a splash on top, so it is mixed in as its own layer inside the
          // step voice rather than by shifting the material.
          //
          // `splash()` is deliberately zero below a damp baseline: a cave
          // floor is wet and does not splash under every step, and a street in
          // a shower does.
          capySfxOpts.wet = game.weather ? game.weather.splash() : 0;
          game.sfx('step', capySfxOpts);
          // ...and at a run it kicks up whatever it is running on
          if (gaitSpeed > capyWALK * 1.05 && capyStepPhase % 2 === 0) {
            capyDigPayload.position = capyPosition;
            game.events.emit('capy:step', capyDigPayload);
          }
        }
      }
    } else {
      // unwind by the SHORTEST arc — never rewind a whole stride on stopping
      let w = capyLegPhase % (Math.PI * 2);
      if (w > Math.PI) w -= Math.PI * 2;
      capyLegPhase = damp(w, 0, 6, dt);
    }

    // stride amplitude has to read at a ~9.5 unit camera: ~53 deg at a walk,
    // ~66 deg flat out. Anything smaller vanishes at this distance.
    const swingAmp = capySwimming ? 0.42 : clamp(0.12 + gaitSpeed * 0.19, 0, 1.15);
    // 0 on the floor, 1 in the air — 0.14 s of airtime before the pose commits,
    // which is longer than any contact hiccup and shorter than the shortest hop.
    capyAirPose = damp(capyAirPose, (!grounded && !capySwimming && !carried &&
                                     capyAirTime > 0.06) ? 1 : 0, 13, dt);
    if (carried) {
      // dangling from the gardener's arms: flail, don't stand serenely
      capyLegPhase += 14 * dt;
      for (let i = 0; i < 4; i++) {
        legs[i].rotation.x = Math.sin(capyLegPhase + i) * 0.7;
        legs[i].rotation.z = damp(legs[i].rotation.z, 0, 8, dt);
      }
    } else {
      for (let i = 0; i < 4; i++) {
        if (digging && i < 2) {
          // front paws scrabble at the dirt
          legs[i].rotation.x = -0.85 + Math.sin(t * 22 + i * 2.1) * 0.55;
          legs[i].rotation.z = damp(legs[i].rotation.z, 0, 8, dt);
          continue;
        }
        const phase = capyLegPhase + ((i === 0 || i === 3) ? 0 : Math.PI);
        if (capySwimming) {
          legs[i].rotation.x = Math.sin(phase * 1.6) * swingAmp - 0.45;
          legs[i].rotation.z = (i % 2 === 0 ? 1 : -1) * 0.22;
        } else {
          // Airborne the legs stop being a gait and become a POSE: fronts reach,
          // rears trail. Cross-faded on capyAirPose so a one-frame contact blip
          // during a stair climb cannot make the legs snap.
          const walk = Math.sin(phase) * swingAmp;
          const tuck = (i < 2 ? -0.62 : 0.52) + (body.velocity.y > 0 ? -0.16 : 0.20);
          legs[i].rotation.x = lerp(walk, tuck, capyAirPose);
          legs[i].rotation.z = damp(legs[i].rotation.z, 0, 8, dt);
        }
      }
    }

    // squash & stretch spring — stiff and under-damped, so a wheek is a sharp
    // pop with an elastic overshoot instead of a gentle swell.
    // Sub-stepped: at k=300 explicit Euler is only marginally stable at a 60Hz
    // dt and outright wrong on a long frame, which read as a hitch in the pop.
    const popSteps = dt > 1 / 240 ? (dt * 240 > 8 ? 8 : Math.ceil(dt * 240)) : 1;
    const popH = dt / popSteps;
    for (let s = 0; s < popSteps; s++) {
      capyPopVel += (-capyPop * 300 - capyPopVel * 9) * popH;
      capyPop += capyPopVel * popH;
    }
    if (capyPop > 1.15) { capyPop = 1.15; if (capyPopVel > 0) capyPopVel = 0; }
    else if (capyPop < -0.5) { capyPop = -0.5; if (capyPopVel < 0) capyPopVel = 0; }

    // body bob / roll / pitch — a run is a different GAIT, not a faster walk:
    // ~2.5x the bob, ~2.3x the forward lean, ears further back, head up.
    const bobAmp = capySwimming ? 0.02
      : clamp(0.010 + gaitSpeed * 0.010, 0, 0.085) * (running ? 1.55 : 1);
    const bob = Math.abs(Math.sin(capyLegPhase)) * bobAmp + (capySwimming ? Math.sin(t * 2.3) * 0.02 : 0);
    // ---- LANDING ABSORB ----------------------------------------------
    // A hop that ends the instant the collider touches has no weight in it: the
    // animal simply stops being in the air. Real landings are absorbed by the
    // legs over a tenth of a second and then pushed back out. This is a second
    // spring, on the MODEL only — the collider is untouched, so nothing about
    // the physics, the ledge you just cleared or the task you just triggered can
    // be changed by it. Critically damped on the way back up so it never bounces.
    capyLandVel += (-capyLand * capyLAND_K - capyLandVel * capyLAND_C) * dt;
    capyLand += capyLandVel * dt;
    if (capyLand < -0.30) { capyLand = -0.30; if (capyLandVel < 0) capyLandVel = 0; }
    capyModel.position.y = -capyFOOT_Y + bob + capyLand + (capySwimming ? 0.02 : 0);
    // ---- the idle beat ----------------------------------------------------
    // Only on its feet, on land, with nothing in its mouth and nobody holding
    // it: every one of those states already owns the pose, and a capybara that
    // shakes itself while dangling from a gardener is a bug in a costume.
    const idleOk = grounded && !moving && !carried && !capySwimming && !digging &&
                   !capyClinging && capyGrabTimer <= 0 && !capy.heldProp;
    if (idleOk) {
      if (capyIdleAct < 0) {
        capyIdleT += dt;
        if (capyIdleT >= capyIdleNext) {
          // The shake is the louder one, so it is the rarer one.
          capyIdleAct = Math.random() < 0.42 ? 0 : 1;
          capyIdleP = 0;
          capyIdleT = 0;
          capyIdleNext = rand(capyIDLE_MIN, capyIDLE_MAX);
          if (capyIdleAct === 0) {
            capyEarFlick = 1;
            game.sfx('rustle', { volume: 0.22, pitch: 1.25 });
          }
        }
      } else {
        capyIdleP += dt / (capyIdleAct === 0 ? capyIDLE_DUR : capyIDLE_LOOK);
        if (capyIdleP >= 1) { capyIdleP = 0; capyIdleAct = -1; }
      }
    } else { capyIdleAct = -1; capyIdleT = 0; }
    // A raised-cosine envelope on both, so each beat starts and ends at exactly
    // zero and can never pop against the pose it is added to.
    const idleEnv = capyIdleAct >= 0 ? 0.5 - 0.5 * Math.cos(capyIdleP * Math.PI * 2) : 0;
    capyIdleRoll = damp(capyIdleRoll,
      capyIdleAct === 0 ? Math.sin(capyIdleP * Math.PI * 2 * 5) * idleEnv * 0.30 : 0, 30, dt);
    capyIdleYaw = damp(capyIdleYaw,
      capyIdleAct === 1 ? Math.sin(capyIdleP * Math.PI * 2) * idleEnv * 0.62 : 0, 9, dt);
    capyModel.rotation.z = (carried
      ? Math.sin(capyLegPhase * 0.5) * 0.12
      : clamp(capyYawRate * 0.075, -0.34, 0.34) * (running ? 1.35 : 1)) + capyIdleRoll;
    // Nose down on the way down, nose up on the way back — read off the actual
    // vertical velocity rather than off the key, so a dive that has hit the
    // bottom and levelled out LOOKS level.
    const leanTarget = capyDiving || (capySwimming && capy.depth > 0.6)
                       ? clamp(-body.velocity.y * 0.16, -0.42, 0.42)
                       : capySwimming ? -0.05 : gaitSpeed * (running ? 0.030 : 0.013);
    capyModel.rotation.x = damp(capyModel.rotation.x, leanTarget, 8, dt);
    const sqY = 1 + capyPop * 0.38;
    const sqXZ = 1 - capyPop * 0.19;
    capySquash.scale.set(sqXZ, sqY, sqXZ);

    // idle breathing on the barrel only — cross-faded so it never pops
    capyBreathAmt = damp(capyBreathAmt, moving ? 0 : 1, 4, dt);
    const breath = Math.sin(t * 1.7) * 0.02 * capyBreathAmt;
    barrel.scale.set(0.32 + breath * 0.4, 0.26 + breath * 0.7, 0.42);

    // head: dips to grab / dig, tips up to wheek
    let headTarget = 0;
    if (carried) headTarget = -0.3;
    else if (digging) headTarget = 0.62 + Math.sin(t * 13) * 0.09;
    else if (capyGrabTimer > 0) headTarget = 0.62;
    else if (capyWheekHold > 0) headTarget = -0.55;
    // at a run the head lifts against the body's forward lean — that counter-
    // pose is most of what separates the run silhouette from the walk
    else headTarget = -gaitSpeed * 0.012 - (running ? 0.13 : 0) + (capySwimming ? -0.12 : 0);
    capyHeadPitch = damp(capyHeadPitch, headTarget, carried ? 8 : 13, dt);
    head.rotation.x = capyHeadPitch;
    head.rotation.z = clamp(-capyYawRate * 0.05, -0.2, 0.2);
    // the look-around (see the idle beat). Nothing else writes the head's yaw,
    // and the mouth anchor is derived from this euler further down — which is
    // right: a capybara looking left has its mouth on the left.
    head.rotation.y = capyIdleYaw;

    if (capyWheekHold > 0) { capyWheekHold -= dt; capyJawOpen = 1; }
    // snaps open, drifts shut
    const jawTarget = capyWheekHold > 0 ? 1 : 0;
    capyJawOpen = damp(capyJawOpen, jawTarget, jawTarget > capyJawOpen ? 30 : 8, dt);
    jawHinge.rotation.x = capyJawOpen * 0.5;

    // ears: flick on an idle timer, pinned BACK at speed (negative Rx, because
    // the capybara faces +Z and Rx(+t) tips local +Y toward +Z)
    capyEarTimer -= dt;
    if (capyEarTimer <= 0) { capyEarTimer = rand(2.2, 5.5); capyEarFlick = 1; capyBlink = 0.11; }
    capyEarFlick = damp(capyEarFlick, 0, 7, dt);
    const earBack = clamp(gaitSpeed * (running ? 0.115 : 0.075), 0, 0.88) + (capySwimming ? 0.2 : 0);
    const flick = Math.sin(t * 34) * capyEarFlick * 0.5;
    earL.rotation.x = -earBack;
    earR.rotation.x = -earBack;
    earL.rotation.z = -0.18 - flick;
    earR.rotation.z = 0.18 + flick;

    // blink
    capyBlink = capyBlink > 0 ? capyBlink - dt : 0;
    const eo = capyBlink > 0 ? 0.010 : 0.050;
    eyeL.scale.set(0.046, eo, 0.042);
    eyeR.scale.set(0.046, eo, 0.042);

    // wet fur darkening (hysteresis so it doesn't strobe at the threshold)
    const wantDark = capyWetLevel > (capyWetDark ? 0.28 : 0.42);
    if (wantDark !== capyWetDark) {
      capyWetDark = wantDark;
      for (let i = 0; i < wetParts.length; i++) {
        wetParts[i].m.material = wantDark ? wetParts[i].wet : wetParts[i].dry;
      }
    }

    // ---- fx: the wheek, made visible ---------------------------------
    // The signature verb of the whole game was, visually, a squash and a
    // 0.14 camera tap. Everything it DOES happens to other people, off in the
    // middle distance, and by the time a tourist reacts the pop is over — so
    // the sound never looked like it came from anywhere. This is one expanding
    // ring on the ground under the animal, fast and faint: it lasts a third of
    // a second, it reads as "that came from HERE", and it is the same instanced
    // mesh the splash already uses, so it costs no extra draw call.
    if (capyWheekRing > 0) {
      capyWheekRing -= dt * 3.0;
      if (capyWheekRing < 0) capyWheekRing = 0;
      const a = 1 - capyWheekRing;                       // 0 -> 1 over ~0.33 s
      const s = 0.35 + a * a * 5.2;                      // eases OUT, like a pressure wave
      capyRingP.set(capyWheekX, capyWheekY, capyWheekZ);
      capyRingS.set(s, capyWheekRing * 1.4, s);
      capyRingQ.set(0, 0, 0, 1);
      capyRingM4.compose(capyRingP, capyRingQ, capyRingS);
      capyRingMesh.setMatrixAt(capyRING_COUNT, capyRingM4);
      capyRingMesh.instanceMatrix.needsUpdate = true;
    }

    // ---- fx: foam rings (one instanced draw call) --------------------
    let ringDirty = false;
    for (let i = 0; i < capyRING_COUNT; i++) {
      if (capyRingLife[i] <= 0) continue;
      capyRingLife[i] -= dt * 1.1;
      ringDirty = true;
      if (capyRingLife[i] <= 0) {
        capyRingLife[i] = 0;
        capyRingP.set(0, -999, 0);
        capyRingS.set(0.0001, 0.0001, 0.0001);
      } else {
        const grow = (1.4 - capyRingLife[i]) * 1.7;
        const s = clamp(0.3 + grow, 0.3, 2.0);   // 8-gon: past 2m it reads octagonal
        capyRingP.set(capyRingX[i], capyRingY[i], capyRingZ[i]);
        capyRingS.set(s, clamp(capyRingLife[i], 0, 1) * 3.0, s);
      }
      capyRingQ.set(0, 0, 0, 1);
      capyRingM4.compose(capyRingP, capyRingQ, capyRingS);
      capyRingMesh.setMatrixAt(i, capyRingM4);
    }
    if (ringDirty) capyRingMesh.instanceMatrix.needsUpdate = true;

    // ---- mouth anchor: outside the squash, so its world quaternion is
    //      clean for props.js's matrixWorld.decompose()
    capyMouthLocal.set(0, -0.055, 0.50).applyEuler(head.rotation).add(head.position);
    mouthAnchor.position.copy(capyMouthLocal);
    mouthAnchor.quaternion.copy(head.quaternion);

    // ---- move event + fresh world matrices for later readers ---------
    capyMovePayload.speed = groundSpeed;
    if (groundSpeed > 0.05) game.events.emit('capy:move', capyMovePayload);
    capyRoot.updateMatrixWorld(true);
  }

  capyUpdate(1 / 60);
  return capy;
}
