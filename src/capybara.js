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
// ...AND capyGRIP_SNAP IS ALSO THE BAND EDGE. Above it the damper is
// capySTOP_LAMBDA and the animal has a stopping distance; below it, it is the
// static friction the two constants above describe. See the note in the
// grounded branch of capyUpdate — the split is what makes a sprint a
// commitment, and it cannot reach a slope, because the stiff band settles at
// a/60 and no gravity in this game can put a parked animal past 0.9 m/s.
const capySKID_V = 5.2;             // m/s above which letting go LOOKS like a skid
// --- RUNNING INTO SOMETHING THAT DOES NOT MOVE ------------------------------
// See the static branch of the collide listener. capyBONK_NY keeps the floor
// out of it (a landing has its own thud, further down this file); and the gap
// is a throttle, because a compound of three spheres against one flat face
// produces several contact points on the same frame.
//
// AND THE THRESHOLD IS SET BY HOW OFTEN IT FIRES, NOT BY HOW HARD IT LOOKS.
// The first cut was 2.6 m/s and 0.22 s, and it measured as a rattle. Forty-five
// seconds of driving the animal round each chapter — sprinting, turning about
// once a second, standing still a quarter of the time (qa/mv-noise.js) — put
// Circular Quay at 23 bonks and Hong Kong at 18, which on a small deck and a
// narrow street is one every two seconds. A wall bonk that fires every two
// seconds is not a bonk, it is a wall texture.
//
// At 3.9 m/s the normal component of a WALK into a face is under the line at
// any angle, so only a run arrives; the same soak then lands the noisiest
// chapter at a bonk every five seconds and the median chapter at one every
// twelve, which is what "you ran into that" should cost.
const capyBONK_V   = 3.9;           // m/s along the contact normal
const capyBONK_NY  = 0.45;          // |n.y| above this is a floor or a ramp
const capyBONK_GAP = 0.40;          // s between bonks
// --- THE RUN-UP. See the hop, and read the note there before touching either.
// The floor is a shade over the walk (4.2), so a walking hop is untouched and
// only a genuine run leaps; the push ramps in over the 1.6 m/s above it rather
// than switching on, so there is no step in the arc at the boundary.
const capyLEAP_V    = 4.6;          // m/s over the floor before a hop is a leap
// It is an IMPULSE, added once to the velocity on the launch frame — not a
// per-frame force. The airborne speed cap spends most of it over the first
// ten frames, so what it buys is a kick off the mark (7.4 -> 10.1 m/s) and
// about 0.2 m of range, rather than a second arc. See the hop.
const capyLEAP_PUSH = 3.2;          // m/s of forward impulse at a full run
// ---- THE ANCHOR THE SNAP NEEDED, AND HOW FAR IT IS ALLOWED TO REACH -------
// See THE SNAP CANNOT SEE THE STEP THAT ALREADY HAPPENED, below. Past this the
// animal has genuinely been moved — a teleport, a rescue, a launch, a carrier
// picking it up — and the anchor is re-taken rather than dragged back to.
const capyPIN_MAX = 0.55;           // m
// ...AND HOW FAST IT IS ALLOWED TO PULL. The correction is a velocity, and a
// velocity derived from a distance over one frame is enormous: a 0.50 m nudge
// from outside asked for 26.4 m/s, ten times the walk cap, and overshot the
// anchor by 0.16 m — so a shove that should have moved the animal half a metre
// instead threw it backwards. The creep this exists to cancel is 0.02 m/s, so
// a ceiling three times the walk speed is a hundred times more than the job
// needs and still restores a genuine nudge smoothly, over a few frames.
const capyPIN_VMAX = 3.0;           // m/s
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
// --- THE PRESS IS NEVER LOST ------------------------------------------------
// An input edge lives exactly one frame. A hop asked for 60-120 ms before the
// feet arrive was therefore thrown away, and the player — who pressed the key
// and watched the animal not jump — reads that as the game dropping inputs,
// because it is. capyCOYOTE already covers the other direction (you may hop a
// moment AFTER the ledge left you); this is the same grace pointing the other
// way in time, and it is deliberately the SAME LENGTH, because an asymmetric
// forgiveness window is a forgiveness window the player cannot learn.
//
// systems.js latches the age of the press in `input.jumpBuf` / `input.actionBuf`
// — seconds since it happened, -1 when there is nothing armed — and this module
// calls `clearJumpBuf()` / `clearActionBuf()` on the frame it acts, so one press
// can never buy two hops. Everything here is written so that an ABSENT field
// reads as "no buffer" and this file behaves exactly as it did before.
const capyBUF_WINDOW  = capyCOYOTE;
// --- A REFUSED INPUT STILL GETS A BODY --------------------------------------
// Two of this controller's dead ends were silent: a hop while blown fell off
// the end of an `if` with no `else` at all, and a grab with nothing in reach
// simply returned. In both the player cannot tell "the game ignored me" from
// "I am knackered" or "that is out of reach", and only one of those is their
// fault. Both answers are deliberately CHEAP AND QUIET — a refusal is
// information, not a punishment — and both are throttled, because the player
// who gets no answer is exactly the player who mashes the key.
const capyREFUSE_GAP  = 0.55;       // s between refusals of the same kind
const capyWHIFF_DUR   = 0.10;       // s of head dip on a grab that found nothing
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
// How wet you have to be for it to be worth shaking off. Under this the coat is
// damp rather than soaked, the whole beat would be an animation about nothing,
// and — since the sky and the sprinklers both put a FLOOR under capyWetLevel —
// the animal would shake itself every four seconds for the length of a shower.
const capySHAKE_WET = 0.55;
const capySHAKE_SPRAY = 0.16;       // s between sprays of droplets during the shake
// How much of the ground's wetness ends up on the animal. Under 0.42 the fur
// never crosses capyWetDark's 0.42 threshold and a downpour leaves no mark at
// all; at 1.0 a drizzle looks identical to swimming the harbour, which throws
// away the one thing the wet coat was for. 0.72 puts a full shower plainly
// into the dark-fur state and still leaves the swim visibly wetter.
const capyRAIN_WET = 0.85;

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
// `soft` is THE SOFT WHEEK — see capyWHEEK_CALM_T. It is always a boolean, from
// the first frame, so no listener ever reads `undefined` off this payload.
const capyWheekPayload = { position: capyPosition, soft: false };
const capyDigPayload = { position: capyPosition };
const capySfxOpts = { pitch: 1, volume: 1, wet: 0 };   // reused — update() may not allocate
// The same thing, with a place. `at` is a permanent reference to the position
// mirror, which is rewritten in place every frame, so this object is built once
// and never again. See THE SOUND COMES FROM SOMEWHERE in the contract.
const capySfxAt = { pitch: 1, volume: 1, at: capyPosition };

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
// Deliberately rare — a flourish on a six-second timer is a tic.
//
// ...AND IT KNOWS WHERE IT IS STANDING NOW.
// Two beats on a 42/58 coin flip is not a personality, it is a screensaver, and
// the first one took twelve seconds of dead standing to arrive. Worse, the gate
// used to include `!capy.heldProp` — so in a game whose entire verb is CARRYING
// THINGS, picking something up switched the animal off. Both are fixed here:
// the coin flip is a weighted table whose weights are multiplied by conditions
// the world already publishes, and a full mouth is a REASON to fidget rather
// than a reason to stand to attention.
//
//   0 shake     the old one
//   1 look      the old one
//   2 shiver    weather.mood().cold — the locals huddle in Antarctica and the
//               animal never did
//   3 chew      something in your mouth
//   4 breath    low on puff: slower, deeper, and it is the only readout of
//               stamina that is not a bar in the corner
//
// (Wet has no row: a wet animal has a beat of its own already — the shake-dry
// at capySHAKE_DUR — and two systems shaking the same water off would fight.
// The timer defers to it instead.)
const capyIDLE_MIN  = 6;            // s of stillness before the first beat
const capyIDLE_MAX  = 17;
const capyIDLE_DUR  = 0.85;         // s the shake takes
const capyIDLE_LOOK = 1.9;          // s the look-around takes — slower, it is a look
const capyIDLE_DELAY = 4.0;         // seconds of nothing before the first idle beat
const capyIDLE_BASE = [0.42, 0.58, 0, 0, 0];   // the weights with nothing live
const capyIDLE_SPAN = [capyIDLE_DUR, capyIDLE_LOOK, 1.35, 1.15, 2.6];
const capyIdleW = new Float32Array(5);         // resolved weights — never allocated
let capyIdleUrge = 0;               // 0..1 how much the situation is asking for
let capyIdleT = 0;                  // s spent standing still
let capyIdleNext = 12;              // s at which the next beat is due
let capyIdleAct = -1;               // -1 none, else an index into capyIDLE_SPAN
let capyIdleP = 0;                  // 0..1 through the current beat
let capyIdleRoll = 0;               // the shake, folded into the model's roll
let capyIdleYaw = 0;                // the look, on the head alone
let capyIdlePitch = 0;              // ...and the head's own nod, on top of the pose
let capyIdleCrouch = 0;             // m of hunch, folded into the model's bob
let capyIdleEar = 0;                // 0..1 ears flattened
let capyIdleChew = 0;               // 0..1 jaw, on top of the wheek's
let capyChewT = 0;                  // s of real chewing left — see THE GRAZE in props.js
let capyIdleBreath = 0;             // 0..1 slower, deeper breathing
let capyBreathPh = 0;               // the breath's own phase, so its RATE may change
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
// ---- THE SHAKE-DRY (see capySHAKE_DUR / capySHAKE_DELAY / capyWET_FAST) ----
// Three constants that had been sitting in this file since v1, referenced by
// nothing, with a comment further down asserting that "the shake sets
// capyWetLevel down" — describing a system that did not exist. Leaving the
// water was a flat eight-second fade and the animal never once shook itself.
let capyShakePend = 0;              // s of the beat ashore left before it starts
let capyShakeP = -1;                // 0..1 through the shake, -1 when there is none
let capyShakeSpray = 0;             // s to the next spray of droplets
// ---- refusals (see capyREFUSE_GAP) ----
let capyRefuseT = 0;                // throttle on the blown hop
let capyWhiffCool = 0;              // ...and on the grab that found nothing
let capyWhiffT = 0;                 // s left of the whiffed reach's head dip
let capyWhiffPend = false;          // a grab attempt found nothing THIS frame
let capyStillT = 0;                 // s settled, mouth EMPTY — see capyWHEEK_CALM_T
let capyRestT  = 0;                 // ...and the same with something in it. See THE CALM.
let capyLoaf   = 0;                 // 0..1 sat down. See THE LOAF.
// ---- THE LOAF -------------------------------------------------------------
// 6.5 s, which is under sysCALM_FULL (8.0) on purpose: the animal sits down a
// beat BEFORE the world goes quiet around it, so the sitting reads as the cause
// of the calm rather than as a second symptom of it.
const capyLOAF_T     = 6.5;    // s of rest before it sits
const capyLOAF_LAM   = 2.2;    // damp lambda settling in; ×6 getting up
const capyLOAF_DROP  = 0.145;  // m the model sinks as the barrel meets the ground
const capyLOAF_PITCH = -0.05;  // rad of nose-up, because the front end goes down
const capyLOAF_LEG_F = -1.05;  // front legs folded under
const capyLOAF_LEG_R = 0.85;   // ...and the rears tucked forward alongside
let capyWakeT = 0;
let capyBreathAmt = 0;
let capyStageTime = 0;
let capyPlatVX = 0, capyPlatVZ = 0, capyPlatT = 0;   // the frame the floor is moving in
// WHERE THE ANIMAL WAS WHEN IT STOPPED. See THE SNAP CANNOT SEE THE STEP THAT
// ALREADY HAPPENED — this is the anchor the idle snap holds against, and it is
// carried in the floor's frame, not the world's.
let capyPinOn = false, capyPinX = 0, capyPinZ = 0;
// Armed by the stick, spent by the skid — so one release is one skid, however
// many frames the slide takes. See capySKID_V.
let capySkidArm = false;
let capyBonkAt = -9;                // game time of the last wall bonk
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
function capyClimbAt(game, x, y, z, force) {
  const api = capyBiomeApi(game);
  if (api && typeof api.climbHold === 'function') {
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
  // ---- A WALL IS A WALL, IN EVERY CHAPTER (v31) -------------------------
  // Reached ONLY on a property miss — a biome that publishes climbHold and
  // answers null has answered, and its no is final. So the three chapters that
  // authored a lattice keep exactly the lattice they authored, to the decimal,
  // and the other sixteen stop having no answer at all.
  //
  // This is the same move the dive was given in v19 and the reason it was
  // worth making: the climb shipped in chapter 11, was published by three
  // chapters, and `sysCLIMB_TAUGHT` names those same three — so the find
  // `brought-climb`, which exists to celebrate a verb TRAVELLING, was
  // unreachable by construction. Measured: 1,835 m² of climbable ground plan
  // in a game with 1,500,259 m² of it. Nought point one two per cent.
  return capyClimbProbe(game, x, y, z, force);
}

// ---- ...AND THE GENERIC HOLD IS ONE RAY AGAINST THE STATIC WORLD --------
// Cast horizontally out of the chest in the direction the animal is facing.
// A near-vertical face within reach is something to hang on to; the surface
// normal, flattened, is the hold's own normal, which is the whole of the
// contract `climbHold` already has.
//
// WHAT IT DELIBERATELY WILL NOT GRAB, and every one of these is load-bearing:
//
//   * ANYTHING WITH MASS. A bin, a crate, a deckchair. A capybara hanging off
//     a prop it could otherwise pick up is worse than no climb at all.
//   * ANYTHING THAT IS NOT STATIC. Kinematic means a ferry hull, a tram, a
//     floe, a gondola or a balloon basket — twelve of them across the game.
//     They are floors and carriers and they have a channel for that already
//     (carryFrame); a climb would fight it.
//   * PEOPLE. `userData.npc` is a walker and `userData.local` is a
//     stallholder, and both are mass-0 boxes that would otherwise read as a
//     perfectly good half-metre wall.
//   * THE CAPYBARA ITSELF, and whatever is carrying it. The ray starts inside
//     the animal's own three spheres.
//   * HEIGHTFIELDS AND PLANES. Terrain is not a building, its AABB is the
//     whole chapter, and this is the same ignore list sysCamClear keeps for
//     the same reason.
const capySHAPE_HEIGHTFIELD = (CANNON.Shape && CANNON.Shape.types &&
                               CANNON.Shape.types.HEIGHTFIELD) || 32;
const capySHAPE_PLANE = (CANNON.Shape && CANNON.Shape.types &&
                         CANNON.Shape.types.PLANE) || 2;
const capyCLIMB_REACH  = 1.15;   // m from the body centre a paw can find a face
const capyCLIMB_CHEST  = 0.10;   // m above the body centre the ray goes out at
const capyCLIMB_FLAT   = 0.40;   // |ny| above this is a roof or a ramp, not a wall
const capyCLIMB_HEAD   = 1.05;   // where the second ray looks for more wall
const capyCLIMB_TOPOUT = 0.55;   // ...and how far above the chest the top then is
const capyClimbFrom = new CANNON.Vec3();
const capyClimbTo = new CANNON.Vec3();
const capyClimbOpts = { skipBackfaces: true };
let capyClimbSelf = null, capyClimbCarry = null;
let capyClimbBest = 0, capyClimbNX = 0, capyClimbNY = 0, capyClimbNZ = 0;
let capyClimbTop = Infinity, capyClimbGot = false;
function capyClimbRayHit(res) {
  if (!res.hasHit) return;
  const b = res.body;
  if (!b || b.mass > 0 || b.isTrigger) return;
  if (b.type !== undefined && CANNON.Body && b.type !== CANNON.Body.STATIC) return;
  if (b === capyClimbSelf || b === capyClimbCarry) return;
  if (b.userData && (b.userData.npc || b.userData.local)) return;
  const t = res.shape && res.shape.type;
  if (t === capySHAPE_HEIGHTFIELD || t === capySHAPE_PLANE) return;
  if (!(res.distance < capyClimbBest)) return;
  const n = res.hitNormalWorld;
  capyClimbBest = res.distance;
  capyClimbNX = n.x; capyClimbNY = n.y; capyClimbNZ = n.z;
  // THE TOP COMES OFF THE HIT BODY, never off a global and never off Infinity.
  // `capyClimbAt` used to default `top` to Infinity when a biome did not say,
  // which for an authored lattice is fine — the lattice ends where the biome
  // says it ends. For a ray it is "this wall has no top", and a wall with no
  // top is climbed for ever, straight up past the parapet into the sky.
  capyClimbTop = (b.aabb && b.aabb.upperBound &&
                  b.aabb.upperBound.y < Infinity) ? b.aabb.upperBound.y : Infinity;
  capyClimbGot = true;
}
/** One horizontal ray at height `h`. Fills the capyClimb* statics. */
function capyClimbCast(game, x, y, z, ux, uz, h) {
  const w = game.world;
  if (!w || typeof w.raycastAll !== 'function') return false;
  capyClimbBest = Infinity; capyClimbGot = false;
  capyClimbFrom.set(x, y + h, z);
  capyClimbTo.set(x + ux * capyCLIMB_REACH, y + h, z + uz * capyCLIMB_REACH);
  try { w.raycastAll(capyClimbFrom, capyClimbTo, capyClimbOpts, capyClimbRayHit); }
  catch (e) { return false; }
  return capyClimbGot;
}
function capyClimbProbe(game, x, y, z, force) {
  // ---- ASKED FOR, OR NOT ASKED AT ALL ---------------------------------
  // The authored hooks are arithmetic and cost nothing to call every frame.
  // This is two raycasts against every static body in the chapter, so it runs
  // only when the grab key is actually down — which is the only state in which
  // the answer can be used, because `wantCling` requires it two lines below
  // the call site. `force` is for the harness, which has no keyboard.
  if (!force && !(game.input && game.input.action)) return null;
  // ---- AND YOU MAY NOT HANG OFF SOMETHING FROM UNDER THE GROUND ---------
  // Clinging overrides the floor solve outright — `body.velocity.y` is
  // ASSIGNED in the climb, not added to — so a hold offered below the terrain
  // surface holds the animal inside the hill indefinitely. Measured in Monte
  // Carlo, whose buildings are cut into the rock: a face whose collider starts
  // at y 27 under ground that is at y 28, and the whole frame was the brown
  // inside of the hillside. Two decimetres of slack, because a heightfield
  // triangle under a wall is not exact.
  const gy = capyGroundY(game, x, z);
  if (gy === gy && y < gy - 0.2) return null;
  const capy = game.capy;
  capyClimbSelf = (capy && capy.body) || null;
  const carrier = capy && capy.carriedBy;
  capyClimbCarry = (carrier && (carrier.body || carrier)) || null;
  const ux = Math.sin(capyYaw), uz = Math.cos(capyYaw);   // the way it is facing
  if (!capyClimbCast(game, x, y, z, ux, uz, capyCLIMB_CHEST)) return null;
  const ny = capyClimbNY;
  if (ny > capyCLIMB_FLAT || ny < -capyCLIMB_FLAT) return null;   // a roof or a ramp
  // Read off BEFORE the second cast, which reuses the same statics.
  const hx = capyClimbNX, hz = capyClimbNZ;
  const m = Math.sqrt(hx * hx + hz * hz);
  if (m < 1e-4) return null;
  let top = capyClimbTop;
  // ---- AND WHERE THE WALL ENDS IS MEASURED AT THE WALL --------------------
  // An AABB is the whole BODY, and several chapters merge a street into one.
  // So the top is confirmed by a second ray a metre higher: no wall up there
  // means the parapet is right here, whatever the box says, and the top-out
  // shove in the solve fires within the metre it was written for.
  if (!capyClimbCast(game, x, y, z, ux, uz, capyCLIMB_HEAD)) {
    top = Math.min(top, y + capyCLIMB_TOPOUT);
  }
  capyClimbOut.nx = hx / m;
  capyClimbOut.nz = hz / m;
  capyClimbOut.top = top;
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
    // THE OLD LADDER WAS WRITTEN AS IF z GREW TOWARD MANLY. It does not: the
    // Quay is around z 0..46 and Manly is at z = -556, so `z < 16` swallowed
    // the entire far end of the chapter and the beach, the Corso and the chip
    // shop all footfalled as hollow wharf timber. The `0.82` sand line under it
    // was unreachable code — the only way to reach it was z >= 46, which is
    // behind the apron. Half a chapter had the wrong footstep for its whole
    // life and nothing could report it, because a wrong pitch is not an error.
    // Ask the chapter where things are instead of guessing from one axis.
    const q = game.quay;
    if (q && q.inZone) {
      if (q.inZone('deck', x, z)) return 1.24;    // the ferry herself
      // corso BEFORE manly: the corso rect is inside the manly rect, so the
      // broader test would answer first and the paved street would be sand.
      if (q.inZone('corso', x, z)) return 1.0;    // paved, and roofed both sides
      if (q.inZone('manly', x, z)) return 0.82;   // the beach around it
      if (q.inZone('apron', x, z)) return 1.0;    // the paved apron at the Quay
    }
    return 1.22;                                  // the finger wharves
  }
  if (b.isActive('pasto')) {
    // the plaza is cobbled; the flanks of Galeras are not
    if (x > -24 && x < 24 && z > 8 && z < 46) return 1.0;
    return 0.82;
  }
  if (b.isActive('kyoto')) {
    const k = game.kyoto;
    // THE SAME BUG THE QUAY HAD, in the chapter directly after it. The ladder
    // below `gion`/`zen` was `if (z < -40 && z > -140) return 1.0` — an axis
    // band standing in for the torii path — and Kyoto's zones do not lie along
    // one axis. Measured: the band is true at (-84, -44), and so is
    // `inZone('bamboo')`, so **half the bamboo grove (z -78..-40 of -78..-10)
    // footfalled as granite**; and the whole of Uji — the town at (24, 176),
    // the mill, the granite spine, the stone gutter — is off the far end of the
    // band and fell through to 0.82, WHICH IS THE SAND DEFAULT. A chapter with
    // no beach in it was walking on sand for its entire second half.
    //
    // `kyoInZone` has answered 'torii', 'bamboo' and 'uji' the whole time and
    // the ladder asked for none of them. Ask the chapter where things are.
    if (k && k.inZone) {
      if (k.inZone('gion', x, z)) return 1.0;    // granite setts
      if (k.inZone('zen', x, z)) return 0.86;    // raked gravel — soft, but crunchier
      if (k.inZone('uji', x, z)) return 1.02;    // the granite spine and its gutter
      if (k.inZone('bamboo', x, z)) return 0.78; // leaf litter over soft earth
      if (k.inZone('torii', x, z)) return 1.0;   // gravel over stone steps
    }
    return 0.82;
  }
  if (b.isActive('cali')) {
    // TWO OF THIS CHAPTER'S SIX SURFACES. Measured, `inZone` answered nothing
    // at the spawn, the mirador, the lulada stand, the Gato and the Cristo, so
    // the chiva road, the mirador's timber deck and the whole paseo all
    // footfalled as the 0.82 soil default — and the chapter publishes 'cane'
    // and 'river' zones that the ladder never asked for either.
    const c = game.cali;
    if (c && c.inZone) {
      if (c.inZone('dancefloor', x, z)) return 1.24;   // a sprung board floor
      if (c.inZone('terrace', x, z)) return 1.20;      // the mirador's planks
      if (c.inZone('street', x, z)) return 1.0;
      if (c.inZone('cane', x, z)) return 0.72;         // trash and soft earth
    }
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
    // THE MORAINE HAD NO ROW, AND IT IS THE HUNDRED METRES THE PLAYER CLIMBS
    // MOST OFTEN. `iceGroundKind` has named four grounds since it was written
    // and this ladder asked for none of them, so loose glacial rubble — the
    // approach to the glacier, walked again on every run attempt — sounded
    // exactly like the moss on the lava field. It is the noisiest ground in
    // the chapter and it was the quietest.
    if (i && i.groundKind && i.groundKind(x, z) === 'moraine') return 1.12;
    return 0.82;
  }
  if (b.isActive('drift')) {
    // ONE HARD-CODED RECTANGLE FOR A CHAPTER OF THIRTY ISLANDS. The rect is
    // the jetty; everything else answered 0.80 grass — including the anvil,
    // the arch and two shoals, which are `kind: 'bare'` stone, and the orchard,
    // the crown and a pebble that are `kind: 'pale'`. So twenty-nine islands
    // out of thirty had the wrong footfall, and the table saying which was
    // which has been in drift.js since the archipelago was laid out.
    if (x > 14 && x < 32 && z > 32 && z < 36) return 1.26;   // the jetty planks
    const d = game.drift;
    if (d && typeof d.islandKind === 'function') {
      const k = d.islandKind(x, z);
      if (k === 'bare') return 1.04;      // dry stone with nothing on it
      if (k === 'pale') return 0.86;      // the crumbly pale rock
    }
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

/**
 * IS THERE A PRESS STILL ARMED?  (see capyBUF_WINDOW)
 *
 * Defensive on purpose. `input.jumpBuf` is a number in seconds since the press,
 * or -1, or — if systems.js has not published the channel at all — undefined.
 * Every one of those but "a finite number inside the window" answers false, so
 * a build without the buffer behaves exactly as this file did before it.
 */
function capyBuffered(input, key) {
  if (!input) return false;
  const v = input[key];
  return typeof v === 'number' && v === v && v >= 0 && v <= capyBUF_WINDOW;
}

/** EAT IT. Called on the frame the press is acted on, so it cannot buy two. */
function capyEatBuf(input, key) {
  if (input && typeof input[key] === 'function') input[key]();
}

/**
 * THE FOUR CHANNELS, for the animal's own verbs.
 *
 * `game.punch(a)` takes the SAME 0..1 magnitude `game.shake(a)` does and each
 * of its four channels has its own floor, so a small event stays a shake and a
 * big one becomes everything — which is precisely why the three call sites that
 * moved over needed no re-tuning. The fallback is not decoration: systems.js
 * owns `punch` and this module is constructed before it in some orders.
 */
function capyPunch(game, a) {
  if (typeof game.punch === 'function') game.punch(a);
  else if (typeof game.shake === 'function') game.shake(a);
}

// --- GAZE: THE ANIMAL LOOKS AT WHAT MATTERS ---------------------------------
// `head.rotation.y` had exactly ONE writer in this whole file — a blind
// sinusoid on an idle timer — so the capybara walked past every person, every
// prop and every set piece in seventeen chapters without once turning its head.
// Against the benchmark this game is measured on, that was the single largest
// hole in its personality, and it is a render-only one: nothing below touches
// the collider, the solve, or a number any other module reads.
//
// Three rules, and all three are about not breaking anything:
//
//   RESOLVED SLOWLY, DAMPED CONTINUOUSLY. The target is recomputed four times a
//   second — a look is not a servo — so this costs one nearestGrabbable and one
//   short list walk per quarter second and allocates nothing at all.
//
//   ADDED, NOT SUBSTITUTED. It goes on top of capyIdleYaw and the head pitch,
//   so the idle look-around simply becomes what the animal does when there is
//   nothing worth looking at.
//
//   CLAMPED, NEVER WRAPPED. A thing behind you is not looked at, at all. An
//   animal that swings its head a hundred and seventy degrees to track a bin is
//   a horror film, not a capybara — and the mouth anchor is derived from
//   head.rotation (a capybara looking left has its mouth on the LEFT), so the
//   clamp is also what stops a carried prop being flung round the animal's ear.
const capyGAZE_TICK   = 0.25;       // s between resolves
const capyGAZE_LAMBDA = 5.5;        // how fast the head gets there
const capyGAZE_YAW    = 0.55;       // rad — the neck's honest limit
const capyGAZE_PITCH  = 0.35;
const capyGAZE_CONE   = 1.30;       // rad off the nose past which nothing is looked at
const capyGAZE_PROP   = 3.5;        // m — a little past the grab path's own reach
const capyGAZE_NPC    = 8.0;        // m — somebody who has noticed you, at talking range
const capyGAZE_HEAT   = 0.15;       // alarm/wary at or under this is not "raised"
const capyGAZE_HOLD_P = 0.12;       // rad of downward glance at a thing in your mouth
const capyGAZE_EYE_H  = 0.90;       // m up a person's group origin their face is
let capyGazeT = 0;                  // s until the next resolve
let capyGazeYaw = 0, capyGazePitch = 0;      // the damped, rendered offsets
let capyGazeWantY = 0, capyGazeWantP = 0;    // ...and what they are heading for

/**
 * WHAT IS WORTH LOOKING AT, resolved into HEAD-LOCAL yaw/pitch.
 *
 * Writes capyGazeWantY / capyGazeWantP and nothing else. The priority list is
 * short and every entry is data some other system already had on hand.
 */
function capyGazeResolve(game, capy, hx, hy, hz, yaw) {
  capyGazeWantY = 0; capyGazeWantP = 0;
  // 1. WHAT IS IN YOUR MOUTH — and deliberately as a FIXED downward glance
  //    rather than as the prop's live position. The prop is pinned to the mouth
  //    anchor, the mouth anchor is derived from head.rotation, and aiming the
  //    head at it would be a control loop feeding its own output back in: the
  //    gaze would walk away from centre and take the prop with it.
  if (capy.heldProp) { capyGazeWantP = capyGAZE_HOLD_P; return; }
  let tx = 0, ty = 0, tz = 0, found = false;
  // 2. SOMETHING YOU COULD PICK UP. The grab path already asks this question.
  const ph = game.physics;
  if (ph && typeof ph.nearestGrabbable === 'function') {
    const p = ph.nearestGrabbable(capy.position, capyGAZE_PROP);
    const src = p && (p.body || p.mesh);
    const pos = src && src.position;
    if (pos) { tx = pos.x; ty = pos.y; tz = pos.z; found = true; }
  }
  // 3. SOMEBODY WHO HAS NOTICED YOU. Two registers, one answer — the Sydney and
  //    Quay humans in `game.npcs`, and the locals of the other fifteen chapters
  //    in `game.locals`, which is shared space and must be gated on the LIVE
  //    biome or the animal stares at a Venetian standing inside a glacier.
  if (!found) {
    let best = capyGAZE_NPC * capyGAZE_NPC;
    const npcs = game.npcs;
    if (npcs) {
      for (let i = 0; i < npcs.length; i++) {
        const n = npcs[i];
        if (!n || !n.group) continue;
        const a = n.alarm || 0, w = n.wary || 0;
        if ((a > w ? a : w) <= capyGAZE_HEAT) continue;
        const g = n.group.position;
        const dx = g.x - hx, dz = g.z - hz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= best) continue;
        best = d2; tx = g.x; ty = g.y + capyGAZE_EYE_H; tz = g.z; found = true;
      }
    }
    const loc = game.locals;
    const live = game.biome && game.biome.current;
    if (loc) {
      for (let i = 0; i < loc.length; i++) {
        const L = loc[i];
        if (!L || L.biome !== live) continue;
        const a = L.alarm || 0, w = L.wary || 0;
        if ((a > w ? a : w) <= capyGAZE_HEAT) continue;
        const g = L.group ? L.group.position : L;
        const gx = g.x, gy = g.y || 0, gz = g.z;
        if (!(gx === gx && gz === gz)) continue;
        const dx = gx - hx, dz = gz - hz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= best) continue;
        best = d2; tx = gx; ty = gy + capyGAZE_EYE_H; tz = gz; found = true;
      }
    }
  }
  if (!found) return;
  const dx = tx - hx, dz = tz - hz;
  const flat = Math.sqrt(dx * dx + dz * dz);
  if (flat < 0.35) return;                    // standing on top of it: no answer
  const local = capyWrapAngle(Math.atan2(dx, dz) - yaw);
  // BEHIND YOU IS NOT LOOKED AT. Clamping alone would point the head 31 degrees
  // off the nose at something directly astern, which reads as looking at
  // nothing; the cone makes "not worth turning for" its own answer.
  if (local > capyGAZE_CONE || local < -capyGAZE_CONE) return;
  capyGazeWantY = clamp(local, -capyGAZE_YAW, capyGAZE_YAW);
  // +x is DOWN on this rig (see the dig pose), so a target above the head is a
  // negative pitch.
  capyGazeWantP = clamp(-Math.atan2(ty - hy, flat), -capyGAZE_PITCH, capyGAZE_PITCH);
}

/**
 * WHICH IDLE BEAT (see capyIDLE_BASE).
 *
 * Fills capyIdleW from the two base weights plus whatever the world is
 * currently publishing, records how much of the total is live (capyIdleUrge),
 * and draws one. With nothing live this is the old 42/58 coin flip exactly.
 */
function capyIdlePick(game, capy, stamina) {
  capyIdleW[0] = capyIDLE_BASE[0];
  capyIdleW[1] = capyIDLE_BASE[1];
  let cold = 0;
  if (game.weather && typeof game.weather.mood === 'function') {
    const m = game.weather.mood();
    if (m && typeof m.cold === 'number' && m.cold === m.cold) cold = clamp(m.cold, 0, 1);
  }
  capyIdleW[2] = cold * 1.70;
  capyIdleW[3] = capy.heldProp ? 0.95 : 0;
  capyIdleW[4] = clamp((0.55 - stamina) / 0.55, 0, 1) * 1.15;
  const live = capyIdleW[2] + capyIdleW[3] + capyIdleW[4];
  capyIdleUrge = clamp(live * 0.55, 0, 1);
  const total = capyIDLE_BASE[0] + capyIDLE_BASE[1] + live;
  if (!(total > 0)) return 1;
  let r = Math.random() * total;
  for (let i = 0; i < 5; i++) { r -= capyIdleW[i]; if (r <= 0) return i; }
  return 1;
}

/**
 * ...AND HOW SOON THE NEXT ONE IS DUE.
 *
 * This is what capyIDLE_DELAY is for. It sat in this file unreferenced with the
 * comment "seconds of nothing before the first idle beat"; the schedule now
 * collapses toward it in proportion to how much the situation is asking for, so
 * an animal that is freezing, carrying something and out of puff answers in
 * about four seconds and one that is merely standing about keeps the old
 * rand(capyIDLE_MIN, capyIDLE_MAX) it always had.
 */
function capyIdleWhen() {
  return lerp(rand(capyIDLE_MIN, capyIDLE_MAX), capyIDLE_DELAY, capyIdleUrge);
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
    if (!other) return;
    const c = e.contact;
    if (!c) return;
    // ---- AND THE OTHER HALF OF THE WORLD, WHICH DOES NOT MOVE -------------
    //
    // This listener returned on `other.mass < 0.8` before anything else, and a
    // static collider is mass 0 — so EVERY collision with the world itself was
    // discarded before it was looked at. A wall, a kerb, a parked bus, a torii
    // leg, a scaffold pole: the listener was only ever a channel for things
    // hitting YOU.
    //
    // Measured with qa/mv-bonk.js — sixteen bearings out of each spawn, every
    // run whose speed collapses with the stick still hard over. Twelve impacts
    // across Sydney, Kyoto, Venice, Hong Kong and Monte Carlo, nine of them
    // losing more than two thirds of their speed (Kyoto: 7.43 -> 0.28 m/s in
    // one bearing). Zero punch(), zero shake(), no impact sound in any of the
    // twelve. The only thing the game said was footsteps.
    //
    // Loose props were always fine — physOnCollide stamps a material voice and
    // emits 'prop:impact', which systems.js turns into a spatialised thud plus
    // a speed-scaled punch. This is the static half being wired into the same
    // idea, and the three gates are what keep it from firing on the floor:
    //
    //   the normal must be MOSTLY HORIZONTAL. Every footfall and every landing
    //   is a static contact too, and a landing already has its own thud and its
    //   own punch further down this file. capyBONK_NY is the same 0.4-ish line
    //   the grounded test uses, read the other way round.
    //
    //   the closing speed ALONG THAT NORMAL must be real. Sliding along a wall
    //   is a large tangential speed and a tiny normal one, so a graze is
    //   naturally silent and only an arrival counts.
    //
    //   and it is THROTTLED, because a compound of three spheres against a flat
    //   collider produces several contact points on the same frame.
    if (other.mass === 0) {
      const nv = Math.abs(c.getImpactVelocityAlongNormal());
      if (nv < capyBONK_V) return;
      if (Math.abs(c.ni.y) > capyBONK_NY) return;
      const now = game.state.time;
      if (now - capyBonkAt < capyBONK_GAP) return;
      if (capySwimming || capyClinging || capy.carriedBy || capy.atHelm) return;
      capyBonkAt = now;
      // the same curve prop:impact uses, so a wall and a bin are one language
      capyPunch(game, clamp((nv - capyBONK_V) * 0.032, 0.03, 0.20));
      capySfxAt.volume = clamp(nv * 0.11, 0.22, 0.85);
      capySfxAt.pitch = clamp(1.20 - nv * 0.035, 0.68, 1.20);
      capySfxAt.at = capyPosition;
      game.sfx('thud', capySfxAt);
      capySfxAt.at = null;
      // squash, and a short bounce back off the face so the animal arrives
      // rather than grinding. Through capyShove, which is the one channel an
      // outside force may use — see THE THREE WAYS TO MOVE THE CAPYBARA.
      if (capyPop > -0.26) capyPop = -0.26;
      if (capyPopVel > -3.5) capyPopVel = -3.5;
      const bs = clamp(nv * 0.16, 0.5, 2.2);
      const bsign = (body === c.bi) ? 1 : -1;
      capyShove.x += c.ni.x * bs * bsign;
      capyShove.z += c.ni.z * bs * bsign;
      capyEarFlick = 1;
      return;
    }
    if (other.mass < 0.8) return;
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
    stillT: 0,                       // s settled with an EMPTY mouth (the soft wheek)
    restT: 0,                        // ...and with anything in it. THE CALM reads this.
    loaf: 0,                         // 0..1 sat down. The camera, the score and
                                     // the critters read this. See THE LOAF.
    loafAsk: 0,                      // a biome writes 1 here per frame to ASK
                                     // for the loaf where the rest test cannot
                                     // reach — a hot spring. Cleared every frame.

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
    /**
     * WHAT THE ANIMAL WOULD FIND TO HANG ON TO AT A POINT, or null.
     *
     * Nothing in src calls this; the harness does. A biome's `climbHold` can be
     * probed on a grid from outside because it is arithmetic, and the generic
     * fallback cannot — it is two rays out of the chest in the direction the
     * animal happens to be FACING, which a grid does not have. Without this
     * there is no way to measure the climbable ground plan of the sixteen
     * chapters that have just been given one, and an unmeasurable change is
     * one nobody may claim. `force` bypasses the grab-key gate, which a probe
     * with no keyboard could never satisfy.
     */
    climbAt(x, y, z, yaw) {
      const was = capyYaw;
      if (typeof yaw === 'number' && yaw === yaw) capyYaw = yaw;
      const h = capyClimbAt(game, x, y, z, true);
      capyYaw = was;
      return h ? { nx: h.nx, nz: h.nz, top: h.top } : null;
    },
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
  // ...and the jaw works when a bite is actually taken out of something. The
  // event is props.js's — this module owns the model and nothing else does, so
  // the animation for the game's newest verb lives here and the rule for WHEN
  // it happens lives over there. See THE GRAZE in props.js.
  game.events.on('capy:graze', function () {
    capyChewT = 0.85;
    capyEarFlick = 1; capyEarTimer = rand(0.8, 1.6);
  });
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
    capyLoaf = 0; capy.loaf = 0;
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

  // ---- THE SOFT WHEEK ----------------------------------------------------
  // The game's one social verb is a THREAT in most of the chapters that have
  // people in them — Sydney startles, Pasto chases, the mare in Goreme spooks —
  // and there was no quiet register at all. There is now, and it costs no input
  // latency and no new button, because the contract is ONE VOICE and because a
  // fire-on-release wheek would put a tenth of a second between the key and the
  // noise for the sake of a nuance almost nobody would find.
  //
  // The rule is instead: YOU HAVE TO SETTLE BEFORE YOU CALL. Stand still, on
  // your feet, out of the water, off a wall, with nothing in your mouth, for
  // capyWHEEK_CALM_T — and then the call comes out gentle. Anybody mid-mischief
  // gets the loud one, every time, so every listener written against the old
  // wheek keeps exactly the content it was written for.
  const capyWHEEK_CALM_T = 1.2;

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
    // Every one of these is already published on `capy` by this point in the
    // frame, so the flag is read off the same state everyone else is reading.
    // capyStillT is zeroed by any of them on its own; naming them here is so
    // that the condition is the sentence rather than a side effect of a timer.
    capyWheekPayload.soft = !!(capy.grounded && !capy.swimming && !capy.climbing &&
                               !capy.carriedBy && !capy.atHelm && !capy.heldProp &&
                               capyStillT >= capyWHEEK_CALM_T);
    game.events.emit('capy:wheek', capyWheekPayload);
    // The event, the ring, the pop, the shake and the task are all unchanged —
    // the only thing softness touches here is the voice itself, because nothing
    // outside this module owns that.
    if (capyWheekPayload.soft) {
      capySfxAt.volume = 0.62; capySfxAt.pitch = 0.94;
      game.sfx('wheek', capySfxAt);
    } else {
      game.sfx('wheek');
    }
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
    // EAT THE BUFFER (see capyBUF_WINDOW). The press has been spent on the
    // throw; leaving it armed would let the retry below pick the prop straight
    // back up on the very next frame, which is the one way an input buffer can
    // make a game worse rather than better.
    capyEatBuf(game.input, 'clearActionBuf');
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
    const ph = game.physics;
    if (ph && typeof ph.nearestGrabbable === 'function' &&
        ph.nearestGrabbable(capyPosition, capyGRAB_RADIUS)) {
      capyGrabTimer = capyGRAB_WINDUP;
      // the press has been spent — see capyBUF_WINDOW
      capyEatBuf(game.input, 'clearActionBuf');
      return;
    }
    // ---- AND A REACH THAT FOUND NOTHING IS STILL A REACH -------------------
    // This used to be `return`, and that was the whole of it: no animation, no
    // sound, nothing at all. Deferred rather than answered here, because the
    // very same press may be about to start a DIG one screenful below, and a
    // press that has already been answered does not need answering twice.
    capyWhiffPend = true;
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
    // ...and square to the bow. The head's yaw is the one euler this pose never
    // wrote, so whatever the animal happened to be looking at as it stepped
    // aboard stayed frozen on its neck for the whole voyage — and now that
    // something is usually looking at something, that is every voyage.
    head.rotation.y = damp(head.rotation.y, 0, 9, dt);
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
    // The wheel owns the whole pose, so everything the walk controller may have
    // been in the middle of is stood DOWN rather than paused — otherwise the
    // capybara steps off the ferry mid-shiver, or with its head still turned to
    // a bollard eleven metres astern. capyStillT stays at zero because being at
    // the helm is not settling, and a wheek from the wheel is not a soft one.
    capyStillT = 0; capyRestT = 0;
    capy.stillT = 0; capy.restT = 0; // ...and the calm reads the published ones
    capyLoaf = 0; capy.loaf = 0; capy.loafAsk = 0;   // ...and the loaf. See THE LOAF.
    capyShakePend = 0; capyShakeP = -1;
    capyWhiffT = 0; capyWhiffPend = false;
    capyIdleAct = -1; capyIdleT = 0;
    capyIdleRoll = 0; capyIdleYaw = 0; capyIdlePitch = 0;
    capyIdleCrouch = 0; capyIdleEar = 0; capyIdleChew = 0; capyIdleBreath = 0;
    capyGazeYaw = 0; capyGazePitch = 0; capyGazeWantY = 0; capyGazeWantP = 0;
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
      // THE ANIMAL'S OWN VERBS GET THE FOUR CHANNELS TOO. `game.punch` appeared
      // ZERO times in this file: a bin knocked over by a tourist got the lens
      // kick, the freeze and the rumble, and the capybara hitting the harbour
      // got a bare camera shake. Same 0..1 magnitude, four letters, no
      // re-tuning — each channel has its own floor, so a small entry is still
      // only a shake and going in off the Opera House podium is everything.
      capyPunch(game, 0.18);
      body.velocity.y *= 0.15;
    } else if (!wantSwim && capySwimming) {
      capySwimming = false;
      // ---- ...AND ARM THE SHAKE (see capySHAKE_DELAY) --------------------
      // On the transition only. Whether it ever RUNS is decided further down,
      // against the stick and the ground: an animal hauled out of the harbour
      // is rarely standing on anything on the frame it stops swimming.
      if (capyWetLevel > capySHAKE_WET) capyShakePend = capySHAKE_DELAY;
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
    // THE PRESS IS NEVER LOST (see capyBUF_WINDOW). The edge is one frame long;
    // the buffer keeps it alive for as long as the coyote window keeps the
    // ledge alive, so a hop asked for just before the feet arrive is a hop.
    const jumpNow = input.jumpPressed || capyBuffered(input, 'jumpBuf');
    if (jumpNow && canHop) {
      capyEatBuf(input, 'clearJumpBuf');       // spent — one press, one hop
      const v0 = capySwimming ? capySWIM_HOP : capyJUMP_V;
      if (body.velocity.y < v0) body.velocity.y = v0;
      // ---- THE RUN-UP (v34) ------------------------------------------------
      // A hop carries whatever horizontal speed it already had, so a sprinting
      // hop travels 5.3 m against a walk's 3.0 — but the APEX and the AIRTIME
      // were identical, measured at 1.37 m and 0.717 s in eighteen of nineteen
      // chapters. So the run-up bought range only in proportion to the speed,
      // and never bought a gap.
      //
      // THE ONE THING THIS MAY NOT DO IS CHANGE THE HEIGHT. Eighteen chapters
      // of geometry are sized against that 1.37 m and a flatter arc would make
      // a ledge somewhere unreachable, which is the worst class of regression
      // this game can have. So the trade is not height-for-reach: it is purely
      // additive and purely horizontal, and the apex and the airtime come out
      // of qa/mv-feel.js unchanged to the last centimetre.
      //
      // ---- ...AND IT IS AN IMPULSE, SO IT IS APPLIED ONCE -----------------
      //
      // THIS WENT THROUGH capyShove AND capyShove IS NOT AN IMPULSE CHANNEL.
      // Read its own doc comment: it "takes a VELOCITY INCREMENT ... so calling
      // it every frame builds to a steady state against the decay". It is a
      // FORCE channel, and it only ever settles because something opposes it —
      // on the ground, the grip damper at lambda 60. The whole value is added
      // to the velocity every frame, and the velocity already carries what was
      // added last frame, so the only thing standing between it and a runaway
      // is the damper.
      //
      // In the air there is no damper. The airborne bleed is
      // capySTOP_LAMBDA * 0.15, which is nothing, and the speed cap cannot help
      // because the cap is WIDENED by the live shove. So a one-shot 3.2 m/s
      // push, handed to a channel that re-integrates it for the whole of a
      // 0.717 s hop, compounded. Measured on the Sydney lawn, a sprinting hop:
      //
      //     push 0.0   7.4 m/s flat for the whole arc      5.42 m
      //     push 3.2   7.4 -> 10.6 -> 20.3 -> 25.4 m/s    14.80 m
      //
      // Fourteen point eight metres and three and a half times the run speed,
      // out of a number that says 3.2. It is the one caller that shoves on the
      // exact frame the feet leave the floor, which is why it is the one that
      // blew up and a bow wave did not.
      //
      // So it goes straight onto the velocity, ONCE. The note on external
      // forces says a bare write is deleted by the speed cap, and that is true
      // of the GROUND path, where the damper is lambda 60; the airborne cap
      // bleeds at lambda 3, which over one hop leaves a third of the push and
      // spends the rest — the arc decays instead of holding, which is what a
      // leap should do anyway. capyShove is left to the sandstorms and the bow
      // waves it was written for, unchanged.
      //
      // Added in the PLATFORM's frame, which is what lvx/lvz already are:
      // body.velocity is local + platform, so a local increment is the right
      // thing to add to it and a hop off a moving ferry keeps the deck.
      //
      // Gated on the speed the animal ACTUALLY HAS over the floor, not on the
      // run key: a capybara shoved off a roof at nine metres a second has a
      // run-up whatever its fingers are doing, and one holding shift against a
      // wall has not. Measured in the platform's frame, so a hop taken while
      // standing still on a moving ferry deck is a standing hop.
      //
      // ...and it goes along the TRAVEL, not along the nose. They are the same
      // thing in a straight line and they are not the same thing coming out of
      // a turn, and the leap belongs to the momentum.
      if (!capySwimming) {
        const lvx = body.velocity.x - platVX, lvz = body.velocity.z - platVZ;
        const lsp = Math.sqrt(lvx * lvx + lvz * lvz);
        if (lsp > capyLEAP_V) {
          const k = capyLEAP_PUSH * clamp((lsp - capyLEAP_V) / 1.6, 0, 1) / lsp;
          body.velocity.x += lvx * k;
          body.velocity.z += lvz * k;
        }
      }
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
    } else if (jumpNow && capyStamBlown && !capySwimming && !capy.carriedBy &&
               !capyClinging && capyRefuseT <= 0) {
      // ---- BEING KNACKERED IS NOT THE SAME AS BEING IGNORED ---------------
      // There was no `else` here at all: out of puff, Space did literally
      // nothing, and "the game dropped my input" and "the animal is spent" look
      // identical from the outside. Three cheap things, none of which touches
      // the solve: the ears go, a small negative pop (the crouch it could not
      // spring out of), and a low, quiet gasp. Throttled, because the player
      // who gets no answer is exactly the player who mashes the key.
      capyRefuseT = capyREFUSE_GAP;
      capyEarFlick = 1;
      if (capyPop > -0.12) capyPop = -0.12;
      if (capyPopVel > -2) capyPopVel = -2;
      capySfxAt.volume = 0.30; capySfxAt.pitch = 0.80;
      game.sfx('gasp', capySfxAt);
    }
    if (capyRefuseT > 0) capyRefuseT -= dt;
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
        // ...and a forty-metre arrival is the loudest thing this animal does,
        // so it goes on the same channel a falling bin already had. Same
        // magnitude, same curve; punch's floors decide how much of it lands.
        if (fall > 7) capyPunch(game, clamp((fall - 7) * 0.02, 0, 0.12));
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
      capySkidArm = true;                // the stick is down; a release can skid
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
      // ---- ...AND THERE ARE TWO BANDS, WHICH IS WHAT THE NOTE AT THE TOP OF
      //      THIS FILE HAS ALWAYS SAID AND WHAT THE CODE NEVER DID ----------
      //
      // capyGRIP_LAMBDA is commented `idle, grounded` and it was running at
      // EVERY speed, so the number that exists to hold a parked capybara on the
      // flank of Galeras was also the number that stopped a sprint. Measured,
      // Sydney, full sprint, stick released:
      //
      //     frame 1   v 2.72 m/s   travelled 0.123 m
      //     frame 2   v 1.00 m/s   travelled 0.169 m
      //     frame 3   v 0.00 m/s   travelled 0.185 m
      //
      // 7.4 m/s to a dead stop in three frames and eighteen centimetres — a
      // sixth of the animal's own body length, at about fifteen gravities. The
      // capySTOP_LAMBDA at the top of the file, the one NAMED for this, was
      // referenced nowhere on the ground path: its only two uses in this file
      // are the airborne bleed at capySTOP_LAMBDA * 0.15.
      //
      // So: above walking pace this is a DECELERATION and below it it is static
      // friction, which is the design the comment describes. It is a `min`, not
      // a lerp, for two reasons — it can only ever SOFTEN the damper, so no
      // surface gets grippier than it was; and on ice `grip` is already well
      // under capySTOP_LAMBDA, so the slide is untouched to the last decimal.
      //
      // THE BAND EDGE IS PROVABLY SAFE ON A SLOPE, which is the whole worry.
      // The stiff band settles at v = a/60, so for gravity alone to carry a
      // parked animal out of it and into the soft band it would need a
      // downhill acceleration of 54 m/s^2. The gravity in this game is 24, so
      // it cannot happen on any slope, at any angle, anywhere. Galeras still
      // holds, and so does the anti-creep pin below, which only ever runs
      // inside the snap.
      const sp2now = vx * vx + vz * vz;
      const brake = sp2now > capyGRIP_SNAP * capyGRIP_SNAP
        ? Math.min(grip, capySTOP_LAMBDA) : grip;
      // ---- ...AND A SKID IS A THING YOU CAN SEE ---------------------------
      // One-shot, on the frame the player lets go of a genuine run, and it uses
      // the two channels this file already has rather than inventing a third:
      // a small negative pop (the animal digging its heels in) and one puff of
      // the same dust a hard landing kicks up. Gated on capySKID_V so a walk
      // never does it, and on capySkidArm so it fires once per stop rather than
      // every frame of the slide.
      if (capySkidArm && slip < 0.35 && sp2now > capySKID_V * capySKID_V) {
        capySkidArm = false;
        if (capyPop > -0.14) capyPop = -0.14;
        if (capyPopVel > -2.4) capyPopVel = -2.4;
        capyDigPayload.position = capyPosition;
        game.events.emit('capy:land', capyDigPayload);
        capySfxOpts.volume = 0.30; capySfxOpts.pitch = 1.5;
        game.sfx('rustle', capySfxOpts);
      }
      vx = damp(vx, 0, brake, dt);
      vz = damp(vz, 0, brake, dt);
      if (slip < 0.35 && vx * vx + vz * vz < capyGRIP_SNAP * capyGRIP_SNAP) {
        vx = 0; vz = 0;
        // ---- THE SNAP CANNOT SEE THE STEP THAT ALREADY HAPPENED ----------
        //
        // THIS IS WHY A PARKED CAPYBARA SLIDES DOWN EVERY SLOPE IN THE GAME.
        //
        // world.step runs BEFORE this module, so by the time the snap decides
        // the animal is stationary the solver has already given it
        // g*sin(theta)*dt of down-slope velocity AND INTEGRATED THAT INTO THE
        // POSITION. Setting the velocity to zero afterwards erases the evidence
        // and keeps the displacement. Every frame. For ever.
        //
        // MEASURED, and the arithmetic closes to three decimals — this is not
        // a hypothesis:
        //   Son Doong spawn, heightfield slope 0.055 (and the analytic slopeAt
        //     agrees, so unlike Venice the collision floor is not lying):
        //     predicted 24*0.055/60 = 0.0220 m/s, measured 0.0226
        //   the doline, 0.0475:  predicted 0.0190, measured 0.0190
        //   (30, -70), 0.175:    predicted 0.0700, measured 0.0674
        // and it is a FIXED-STEP quantity, which is the clincher: ticking at
        // 1/120 and 1/240 gives the identical 0.0228 m/s, and 1/30 gives
        // 0.0371. A real slide would scale with time, not with the step.
        //
        // It is not one chapter. Over sixty seconds, no input, velocity reading
        // exactly 0.000 and the loaf at 1.0 the whole way: Manly beach 13.36 m
        // into the sea, Antarctica spawn 3.12 m, Palawan beach 3.65 m, Pasto
        // 3.04 m, the cave 1.34 m. Two previous batches looked at four of those
        // and wrote them up as five separate chapter faults.
        //
        // The fix has to be a POSITION, because static friction IS a position
        // and this module deliberately never assigns one. So it is expressed
        // the only other way: remember where the animal was when it stopped,
        // and hand back exactly the velocity that returns it. To first order
        // the next step’s own creep is cancelled by the correction and the net
        // displacement is zero — bounded, not linear.
        //
        // The anchor RIDES THE FLOOR: platVX/platVZ is the frame the animal is
        // standing in, so a capybara asleep on a moving ferry is pinned to the
        // deck and not to the harbour.
        if (capyPinOn) {
          capyPinX += platVX * dt; capyPinZ += platVZ * dt;
          const ex = body.position.x - capyPinX, ez = body.position.z - capyPinZ;
          if (ex * ex + ez * ez > capyPIN_MAX * capyPIN_MAX) {
            capyPinX = body.position.x; capyPinZ = body.position.z;
          } else if (dt > 1e-4) {
            // ---- AND IT IS A PULL, NOT A CATAPULT ------------------------
            // -ex/dt is exact for the creep, which is a fraction of a
            // millimetre a frame, and it is violent for anything else: this
            // branch also catches every position write from OUTSIDE under
            // capyPIN_MAX — a rescue nudge, a solver push, a prop landing on
            // the animal — and answered a 0.50 m displacement with 26.4 m/s
            // for one frame, which overshot by 0.16 m and read as being
            // thrown. Capped, it restores over a handful of frames instead,
            // and the creep is so far under the cap that its own correction
            // is unchanged to the last decimal.
            let cvx = -ex / dt, cvz = -ez / dt;
            const cs = Math.sqrt(cvx * cvx + cvz * cvz);
            if (cs > capyPIN_VMAX) { const k = capyPIN_VMAX / cs; cvx *= k; cvz *= k; }
            vx = cvx; vz = cvz;
          }
        } else {
          capyPinOn = true;
          capyPinX = body.position.x; capyPinZ = body.position.z;
        }
      } else {
        capyPinOn = false;
      }
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

    // ---- THE SHAKE-DRY (see capySHAKE_DUR / capySHAKE_DELAY / capyWET_FAST)
    // The three constants at the top of this file that were referenced nowhere,
    // and the beat the comment beside the rain floor had been claiming existed.
    //
    // RENDER-ONLY, and reusing what is already here rather than inventing a new
    // pose channel: it drives capyIdleRoll — the model's one roll writer, the
    // same one the idle shake goes through — on the same raised-cosine envelope
    // idle act 0 uses, so it cannot pop against whatever pose it lands in. The
    // only simulated quantity it touches is how fast the coat dries.
    //
    // AND IT NEVER INTERRUPTS THE PLAYER. It waits for the stick to be centred
    // and the keys to be up, and one frame of either — or one toe back in the
    // water — cancels it outright. The worst possible version of this feature
    // is one that plays a second of animation over somebody walking away.
    const dryStill = grounded && !capySwimming && !capyClinging && !carried &&
                     !capy.atHelm && mag < 0.02 && groundSpeed < 0.35 &&
                     !input.action && !input.jump;
    if (!dryStill) {
      capyShakePend = 0; capyShakeP = -1;
    } else if (capyShakeP >= 0) {
      capyShakeP += dt / capySHAKE_DUR;
      capyShakeSpray -= dt;
      if (capyShakeSpray <= 0) {
        capyShakeSpray = capySHAKE_SPRAY;
        // the droplets, through the pool props.js already owns and already
        // routes to whichever biome is live
        if (game.physics && typeof game.physics.dust === 'function') {
          game.physics.dust(px, body.position.y + 0.10, pz, 3);
        }
      }
      if (capyShakeP >= 1) capyShakeP = -1;
    } else if (capyShakePend > 0) {
      capyShakePend -= dt;
      if (capyShakePend <= 0) {
        capyShakePend = 0;
        capyShakeP = 0;
        capyShakeSpray = 0;
        capyEarFlick = 1;
        capySfxAt.volume = 0.50; capySfxAt.pitch = 1.15;
        game.sfx('rustle', capySfxAt);
      }
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
      // ...and THIS is what capyWET_FAST was always for: a shake gets most of
      // the harbour off in a second, and the remaining eight-second fade is
      // what a coat does after that rather than instead of it.
      const wetK = capyShakeP >= 0 ? capyWET_FAST : 1;
      capyWetLevel = clamp(capyWetLevel - capyWET_DECAY * wetK * dt, 0, 1);
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
    // ---- ...AND SO IS STANDING IN SOMETHING THE PLACE IS SPRAYING ---------
    // The same argument as the rain immediately above, one scale down and one
    // step more embarrassing: the Botanic Gardens have had a working sprinkler
    // since v1, its whole job is to soak a TOURIST, and a capybara could stand
    // in the arc of it indefinitely and come out with a dry coat. The wet fur,
    // the shake and the drips were all there; nothing local could reach them.
    //
    // `soaking(x, z)` is an optional biome hook of exactly the same shape as
    // groundSlip and surfacePitch — 0..1, absent from every biome that has no
    // opinion — and it is a FLOOR like the sky's, so it can never dry an animal
    // that has just climbed out of the harbour.
    const wetHere = capyAskNum(game, 'soaking', px, pz, 0);
    if (wetHere > capyWetLevel) capyWetLevel = clamp(wetHere, 0, 1);
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
    // ---- SETTLING (see capyWHEEK_CALM_T) ----------------------------
    // Not "am I still this frame" but "how long have I been". Every one of
    // these is a way of being busy, and any of them resets the clock, so the
    // soft register can only ever be reached deliberately.
    //
    // ---- ...AND THERE ARE TWO OF THEM, WHICH IS ONE MORE THAN THERE WAS ----
    // `capyRestT` is the same list with `heldProp` taken out of it, and the
    // reason it exists is that carrying something is not a way of being busy —
    // it is a way of standing there. THE CALM (systems.js) and THE GRAZE
    // (props.js) both want "how long has this animal been doing nothing", and
    // both were measured against the wrong one: a capybara that had picked up
    // a sandwich could never reach a settled state at all, so the whole calm
    // field collapsed the moment you took anything into your mouth and the
    // graze — whose entire precondition is standing still holding food — could
    // not fire in any circumstance whatsoever.
    //
    // `capyStillT` KEEPS ITS ORIGINAL MEANING TO THE LETTER. It is the soft
    // wheek's, its list has not changed, and an empty mouth is part of what
    // that register means. Two names because they are two questions.
    // ...AND NEITHER CLOCK MAY RUN BEFORE THE PLAYER HAS THE ANIMAL. The world
    // ticks behind the title card, and nothing on that list is true of a
    // capybara nobody is driving yet — so both clocks used to accrue the whole
    // time the card was up. Measured: six seconds on the menu put `capyRestT`
    // at 6.83 and the loaf at 0.54 BEFORE the first frame of play, and pressing
    // start put it at 1.00 within a second. Every new player's first sight of
    // this animal was it already sitting down, with the camera eased wide and
    // the score gone soft — the one gesture in the game that is supposed to be
    // earned by holding still, given away before they touched a key. It only
    // shows in Sydney: every other chapter is arrived at through a teleport,
    // and teleport zeroes both (see capyTeleport). Sydney is not travelled to.
    const capyBusy = mag > 0.02 || groundSpeed > 0.35 || !grounded ||
                     capySwimming || capyClinging || carried || capyDiving ||
                     !game.state.started;
    if (capyBusy || capy.heldProp) capyStillT = 0; else capyStillT += dt;
    if (capyBusy) capyRestT = 0; else capyRestT += dt;
    // Published because THE CALM is built on them and systems.js owns that.
    // How long this animal has been doing nothing is the one input that whole
    // field has, and re-deriving it over there would be a second copy of the
    // list above, free to drift from this one. See game.calm() in systems.js.
    capy.stillT = capyStillT;
    capy.restT = capyRestT;

    // ---- THE LOAF (v23) ---------------------------------------------------
    // STILLNESS AS A VERB. This game rewards being settled — the calm field,
    // the soft wheek, the graze, the critters' flee radius all read it — and
    // the animal itself did not do one thing differently for it. You stood
    // there and were told, by a number you cannot see, that you were being
    // still. So: hold still long enough and it sits down.
    //
    // ON capyRestT, NEVER ON capyStillT. The two are one entry apart and the
    // entry is `heldProp`: stillT is zeroed by having anything in your mouth,
    // correctly, because that is what the soft wheek means. Reading it here
    // would mean the loaf collapses the moment you pick anything up — which is
    // exactly the bug the calm field and the graze both shipped with, twice.
    //
    // NO NEW BUTTON. The control scheme is settled and the wheek and the
    // whistle are one voice; this is a thing the animal does when you stop
    // asking it to do anything, which is the only input this verb can have.
    //
    // ---- ...AND A PLACE MAY ASK FOR IT (see capy.loafAsk) ----------------
    // One chapter in seventeen has a task whose entire content is sitting
    // still, and it is in a POOL — where capySwimming is true, which is on the
    // capyBusy list, so the animal could never have loafed in the one place the
    // game explicitly asks it to. Rather than take swimming off that list
    // (which would have the animal sitting down mid-crossing in five chapters),
    // a biome may ask, per frame. It is re-asked every frame and cleared here,
    // so a chapter that stops asking cannot leave the animal sat down.
    const ask = capy.loafAsk > 0;
    capy.loafAsk = 0;
    const loafWant = (ask || (!capyBusy && !capy.atHelm && capyRestT >= capyLOAF_T)) ? 1 : 0;
    // Asymmetric, like the calm it belongs to: slow to settle, quick to get up.
    // A capybara that took two seconds to stand up would feel like a bug.
    capyLoaf = damp(capyLoaf, loafWant, loafWant > capyLoaf ? capyLOAF_LAM : capyLOAF_LAM * 6, dt);
    if (capyLoaf < 0.0015 && loafWant === 0) capyLoaf = 0;
    capy.loaf = capyLoaf;

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
    } else if (!talonsHere && !capy.heldProp && capyGrabTimer <= 0 &&
               capyBuffered(input, 'actionBuf')) {
      // THE PRESS IS NEVER LOST, the grab side of it (see capyBUF_WINDOW). A
      // click made a tenth of a second before the prop came into reach stays
      // armed, so walking into the thing is what fires it, and capyTryGrabStart
      // eats the buffer the moment it takes.
      //
      // THE RELEASE SIDE IS DELIBERATELY NOT BUFFERED. Throwing what you are
      // carrying is never something you asked for slightly early, and a buffer
      // on it would empty the animal's mouth on the frame after a grab.
      capyTryGrabStart();
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
        // the third of the animal's own verbs to move onto the four channels —
        // same magnitude, and at 0.09 punch's floors leave it exactly the small
        // shake it has always been
        capyPunch(game, 0.09);
        capyPopVel = 6;
      }
    } else if (capyDigTimer > 0) {
      capyDigTimer = 0;
    } else if (capyDigTimer < 0) {
      capyDigTimer = Math.min(0, capyDigTimer + dt);
    }
    // head stays down through the cooldown so holding E is one continuous burrow
    const digging = canDig && capyDigTimer > -0.30;

    // ---- ...AND THE ANSWER TO A REACH THAT FOUND NOTHING ------------------
    // Resolved here rather than inside capyTryGrabStart, because `canDig` is
    // the question that had to be asked first: a press that starts a burrow has
    // already been answered, and answering it twice is a tic. Nor is it an
    // answer while clinging or diving, where the same key means hold on and go
    // down and a refusal would be a lie.
    if (capyWhiffPend) {
      capyWhiffPend = false;
      if (!canDig && !capyClinging && !capyDiving && capyWhiffCool <= 0) {
        capyWhiffCool = capyREFUSE_GAP;
        capyWhiffT = capyWHIFF_DUR;
        capySfxAt.volume = 0.24; capySfxAt.pitch = 1.35;
        game.sfx('rustle', capySfxAt);
      }
    }
    if (capyWhiffCool > 0) capyWhiffCool -= dt;
    if (capyWhiffT > 0) capyWhiffT -= dt;

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
          // ...and the paddle folds away into the loaf too, or an animal
          // "sitting still" in a hot spring is still swimming for its life.
          legs[i].rotation.x = lerp(Math.sin(phase * 1.6) * swingAmp - 0.45,
                                    i < 2 ? capyLOAF_LEG_F : capyLOAF_LEG_R, capyLoaf);
          legs[i].rotation.z = (i % 2 === 0 ? 1 : -1) * 0.22 * (1 - capyLoaf);
        } else {
          // Airborne the legs stop being a gait and become a POSE: fronts reach,
          // rears trail. Cross-faded on capyAirPose so a one-frame contact blip
          // during a stair climb cannot make the legs snap.
          const walk = Math.sin(phase) * swingAmp;
          const tuck = (i < 2 ? -0.62 : 0.52) + (body.velocity.y > 0 ? -0.16 : 0.20);
          // ...and the LOAF is a third pose on the same cross-fade. It cannot
          // fight the air tuck: capyLoaf is only ever non-zero when the animal
          // has been on the ground and doing nothing for capyLOAF_T, and the
          // first frame off the ground zeroes capyRestT, so capyAirPose and
          // capyLoaf cannot both be up.
          legs[i].rotation.x = lerp(lerp(walk, tuck, capyAirPose),
                                    i < 2 ? capyLOAF_LEG_F : capyLOAF_LEG_R, capyLoaf);
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
    // Only on its feet, on land, and not in the middle of doing something else:
    // every one of those states already owns the pose, and a capybara that
    // shakes itself while dangling from a gardener is a bug in a costume.
    //
    // `!capy.heldProp` IS NO LONGER ONE OF THEM. It used to be, which meant
    // that in a game about carrying things, picking one up switched the whole
    // personality off — see capyIDLE_BASE. A mouthful is a beat, not a mute.
    //
    // Gated on the INTENT as well as on the resulting speed, so a beat ends on
    // the frame the stick moves rather than a fifth of a second later when the
    // gait notices, and stood down entirely while the shake-dry has the roll.
    const idleOk = grounded && !moving && mag < 0.02 && !carried && !capySwimming &&
                   !digging && !capyClinging && capyGrabTimer <= 0 &&
                   capyWheekHold <= 0 && capyWhiffT <= 0 &&
                   capyShakeP < 0 && capyShakePend <= 0;
    if (idleOk) {
      if (capyIdleAct < 0) {
        capyIdleT += dt;
        if (capyIdleT >= capyIdleNext) {
          capyIdleT = 0;
          capyIdleP = 0;
          if (capyWetLevel > capySHAKE_WET) {
            // WET DEFERS. There is already a beat for this and it is a better
            // one; arming it here is what gives a rained-on animal the shake
            // that used to be reachable only by climbing out of the harbour.
            capyShakePend = capySHAKE_DELAY;
            capyIdleNext = rand(capyIDLE_MIN, capyIDLE_MAX);
          } else {
            capyIdleAct = capyIdlePick(game, capy, capyStam);
            capyIdleNext = capyIdleWhen();
            // Every one of these is quiet and none is more than once per beat,
            // which is at least capyIDLE_DELAY apart even at full urge.
            if (capyIdleAct === 0) {
              capyEarFlick = 1;
              game.sfx('rustle', { volume: 0.22, pitch: 1.25 });
            } else if (capyIdleAct === 2) {
              capyEarFlick = 1;
              game.sfx('rustle', { volume: 0.16, pitch: 1.45 });
            } else if (capyIdleAct === 3) {
              game.sfx('rustle', { volume: 0.15, pitch: 0.85 });
            } else if (capyIdleAct === 4) {
              game.sfx('gasp', { volume: 0.16, pitch: 0.72 });
            }
          }
        }
      } else {
        capyIdleP += dt / capyIDLE_SPAN[capyIdleAct];
        if (capyIdleP >= 1) { capyIdleP = 0; capyIdleAct = -1; }
      }
    } else { capyIdleAct = -1; capyIdleT = 0; }
    // A raised-cosine envelope on every beat, so each one starts and ends at
    // exactly zero and none of them can pop against the pose it is added to.
    // The shake-dry rides the SAME envelope on the SAME channel — it is the one
    // beat that is allowed to run outside the idle timer, and this is why that
    // is safe (see capySHAKE_DUR).
    const idleEnv = capyIdleAct >= 0 ? 0.5 - 0.5 * Math.cos(capyIdleP * Math.PI * 2) : 0;
    const dryEnv = capyShakeP >= 0 ? 0.5 - 0.5 * Math.cos(capyShakeP * Math.PI * 2) : 0;
    let idleRollWant = 0;
    if (capyIdleAct === 0) idleRollWant = Math.sin(capyIdleP * Math.PI * 2 * 5) * idleEnv * 0.30;
    else if (capyIdleAct === 2) idleRollWant = Math.sin(capyIdleP * Math.PI * 2 * 11) * idleEnv * 0.10;
    if (capyShakeP >= 0) idleRollWant += Math.sin(capyShakeP * Math.PI * 2 * 7) * dryEnv * 0.36;
    capyIdleRoll = damp(capyIdleRoll, idleRollWant, 30, dt);
    capyIdleYaw = damp(capyIdleYaw,
      capyIdleAct === 1 ? Math.sin(capyIdleP * Math.PI * 2) * idleEnv * 0.62 : 0, 9, dt);
    capyIdlePitch = damp(capyIdlePitch,
      capyIdleAct === 3 ? Math.sin(capyIdleP * Math.PI * 2 * 3) * idleEnv * 0.07
      : capyIdleAct === 4 ? idleEnv * 0.10
      : capyIdleAct === 2 ? idleEnv * 0.06 : 0, 9, dt);
    capyIdleCrouch = damp(capyIdleCrouch, capyIdleAct === 2 ? idleEnv * 0.045 : 0, 8, dt);
    capyIdleEar = damp(capyIdleEar, capyIdleAct === 2 ? idleEnv : 0, 8, dt);
    capyIdleChew = damp(capyIdleChew,
      capyIdleAct === 3 ? (0.5 - 0.5 * Math.cos(capyIdleP * Math.PI * 2 * 6)) * idleEnv : 0, 14, dt);
    capyIdleBreath = damp(capyIdleBreath, capyIdleAct === 4 ? idleEnv : 0, 5, dt);
    // the huddle, on the bob the line above already wrote — render only
    capyModel.position.y -= capyIdleCrouch;
    // ...and the loaf, on the same channel and for the same reason: the
    // COLLIDER is untouched, so sitting down cannot change what you are
    // standing on, what you can reach or what task you are inside.
    // ...and less of it in the water, where buoyancy already owns the height
    // and a full 14.5 cm would put the animal's eyes under the surface.
    capyModel.position.y -= capyLoaf * capyLOAF_DROP * (capySwimming ? 0.30 : 1);
    capyModel.rotation.z = (carried
      ? Math.sin(capyLegPhase * 0.5) * 0.12
      : clamp(capyYawRate * 0.075, -0.34, 0.34) * (running ? 1.35 : 1)) + capyIdleRoll;
    // Nose down on the way down, nose up on the way back — read off the actual
    // vertical velocity rather than off the key, so a dive that has hit the
    // bottom and levelled out LOOKS level.
    const leanTarget = capyDiving || (capySwimming && capy.depth > 0.6)
                       ? clamp(-body.velocity.y * 0.16, -0.42, 0.42)
                       : capySwimming ? -0.05 : gaitSpeed * (running ? 0.030 : 0.013);
    capyModel.rotation.x = damp(capyModel.rotation.x, lerp(leanTarget, capyLOAF_PITCH, capyLoaf), 8, dt);
    const sqY = 1 + capyPop * 0.38;
    const sqXZ = 1 - capyPop * 0.19;
    capySquash.scale.set(sqXZ, sqY, sqXZ);

    // idle breathing on the barrel only — cross-faded so it never pops.
    // ON ITS OWN PHASE, not on `t`, because idle act 4 SLOWS IT: sin(t * rate)
    // with a rate that changes is a phase jump the size of the elapsed session,
    // and integrating the rate instead is continuous by construction. With
    // capyIdleBreath at zero this is 1.7 rad/s and 0.02 of amplitude, which is
    // what it always was, offset by a constant nobody can see.
    capyBreathAmt = damp(capyBreathAmt, moving ? 0 : 1, 4, dt);
    capyBreathPh += (1.7 - capyIdleBreath * 0.75) * dt;
    if (capyBreathPh > Math.PI * 2) capyBreathPh -= Math.PI * 2;
    const breath = Math.sin(capyBreathPh) * (0.02 + capyIdleBreath * 0.020) * capyBreathAmt;
    barrel.scale.set(0.32 + breath * 0.4, 0.26 + breath * 0.7, 0.42);

    // head: dips to grab / dig, tips up to wheek
    let headTarget = 0;
    if (carried) headTarget = -0.3;
    else if (digging) headTarget = 0.62 + Math.sin(t * 13) * 0.09;
    else if (capyGrabTimer > 0) headTarget = 0.62;
    // a reach that found nothing is still a reach: a short dip on the same
    // channel the wind-up uses, damped in and out, so it cannot pop
    else if (capyWhiffT > 0) headTarget = 0.34;
    else if (capyWheekHold > 0) headTarget = -0.55;
    // at a run the head lifts against the body's forward lean — that counter-
    // pose is most of what separates the run silhouette from the walk
    else headTarget = -gaitSpeed * 0.012 - (running ? 0.13 : 0) + (capySwimming ? -0.12 : 0);
    capyHeadPitch = damp(capyHeadPitch, headTarget, carried ? 8 : 13, dt);
    // ---- GAZE (see capyGAZE_TICK) -----------------------------------------
    // Suppressed wherever the head is not the thing the player is reading, or
    // where another system already owns it: under the surface on purpose, on a
    // wall (where the animal is facing the wall by construction), and in
    // somebody's arms. The want is held between resolves and DAMPED every
    // frame, so the cadence is invisible.
    const gazeOk = !capyDiving && !capyClinging && !carried && !capy.atHelm;
    capyGazeT -= dt;
    if (capyGazeT <= 0) {
      capyGazeT = capyGAZE_TICK;
      if (gazeOk) {
        capyGazeResolve(game, capy, capyRenderPos.x, capyRenderPos.y + 0.16,
                        capyRenderPos.z, capyYaw);
      } else { capyGazeWantY = 0; capyGazeWantP = 0; }
    }
    if (!gazeOk) { capyGazeWantY = 0; capyGazeWantP = 0; }
    capyGazeYaw = damp(capyGazeYaw, capyGazeWantY, capyGAZE_LAMBDA, dt);
    capyGazePitch = damp(capyGazePitch, capyGazeWantP, capyGAZE_LAMBDA, dt);
    // ADDED to the pose, never in place of it — see the gaze block up top.
    head.rotation.x = capyHeadPitch + capyGazePitch + capyIdlePitch;
    head.rotation.z = clamp(-capyYawRate * 0.05, -0.2, 0.2);
    // the look-around (see the idle beat) plus whatever is worth looking at.
    // Nothing else writes the head's yaw, and the mouth anchor is derived from
    // this euler further down — which is right: a capybara looking left has its
    // mouth on the left. That is also why the gaze is clamped and coned rather
    // than wrapped, and why a held prop resolves to a glance and not a target.
    head.rotation.y = capyIdleYaw + capyGazeYaw;

    if (capyWheekHold > 0) { capyWheekHold -= dt; capyJawOpen = 1; }
    // snaps open, drifts shut
    const jawTarget = capyWheekHold > 0 ? 1 : 0;
    capyJawOpen = damp(capyJawOpen, jawTarget, jawTarget > capyJawOpen ? 30 : 8, dt);
    // ...plus the chew, which is a small working of the jaw ON TOP of the
    // wheek's, not a second writer of it — and plus the REAL one, which is a
    // bite actually being taken out of something (see THE GRAZE in props.js).
    // Three terms summed rather than three writers of the same value: the idle
    // chew is a mime and this one is not, and a player holding a sandwich is
    // entitled to both at once.
    if (capyChewT > 0) capyChewT -= dt;
    const chewNow = capyChewT > 0
      ? (0.5 - 0.5 * Math.cos(capyChewT * Math.PI * 2 * 7)) * clamp(capyChewT / 0.3, 0, 1)
      : 0;
    jawHinge.rotation.x = capyJawOpen * 0.5 + capyIdleChew * 0.16 + chewNow * 0.22;

    // ears: flick on an idle timer, pinned BACK at speed (negative Rx, because
    // the capybara faces +Z and Rx(+t) tips local +Y toward +Z), and flattened
    // down and out by the shiver beat — which is the same thing the locals do
    // in the cold chapters, and which the animal itself had never done.
    capyEarTimer -= dt;
    if (capyEarTimer <= 0) { capyEarTimer = rand(2.2, 5.5); capyEarFlick = 1; capyBlink = 0.11; }
    capyEarFlick = damp(capyEarFlick, 0, 7, dt);
    const earBack = clamp(gaitSpeed * (running ? 0.115 : 0.075), 0, 0.88) +
                    (capySwimming ? 0.2 : 0) + capyIdleEar * 0.25;
    const flick = Math.sin(t * 34) * capyEarFlick * 0.5;
    const earDown = capyIdleEar * 0.34;
    earL.rotation.x = -earBack;
    earR.rotation.x = -earBack;
    earL.rotation.z = -0.18 - flick - earDown;
    earR.rotation.z = 0.18 + flick + earDown;

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
