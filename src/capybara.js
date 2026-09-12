import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matSelf, TASKS, rand, randInt, clamp, damp, lerp, waterYAt } from './shared.js';

// ===========================================================================
// AGENT B — THE CAPYBARA
// Low-poly mesh, procedural rig, snappy acceleration controls, compound-sphere
// physics body, grab / wheek / dig / swim. Everything prefixed `capy`.
// ===========================================================================

// --- dimensions ------------------------------------------------------------
const capyR = 0.34;                 // collision sphere radius
const capyFOOT_Y = 0.34;            // resting body-centre height on flat ground
// M10: THE WET FOOTFALL. `game.weather.splash()` was the only input to the step
// voice's wet layer and it is a pure function of the rain, so a capybara walking
// up a beach with the North Atlantic running off it played dry sand. The band
// this was written for — walking on submerged ground — does not exist in this
// game's geometry; see the long note at the footfall. Coming OUT of the water
// does, in every chapter that has any.
const capyWADE_DRIP = 4.0;          // s of wet footfalls after leaving the water
const capyWADE_IN = 0.55;           // ...and standing in it, where that happens at all
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
// ...and a PERSON is not a wall — see the barge branch of the collide listener.
// A third of the wall's floor, because shouldering somebody at a walking pace
// is the joke and 3.9 m/s is nearly a run.
const capyBARGE_V  = 1.30;          // m/s along the contact normal
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

// ---- THE SLIDE (v44) -------------------------------------------------------
// A capybara at a flat run, told to get down, should get down. It is the single
// most capybara thing the animal could not do, and every chapter has ground to
// do it on.
//
// IT IS NOT A NEW MOVEMENT MODEL. A slide IS being slippery on purpose, and
// this file already has a fully-solved, fully-measured model of being on
// slippery ground — the glacier. So the slide does exactly one thing to the
// simulation: it raises `slip`. Everything else falls out of machinery that has
// been in the game since chapter 7 and has been tuned against a real hill —
// the grip damper softens (capyGRIP_ICE), the steering authority drops
// (capySLIP_CTRL), the speed ceiling lifts (capySLIP_CAP), gravity gets to do
// the work on a gradient, and THE CARVE APPLIES, so a player who has done
// `glacier-run` slides better everywhere for the rest of the game. None of
// that had to be written, decided or re-tuned, and none of it can drift away
// from the glacier's version because it IS the glacier's version.
//
// Three rules keep it honest:
//   1. YOU HAVE TO BE MOVING to start one. It is a way of carrying speed, not
//      a way of making it — otherwise it is a second run button.
//   2. IT CANNOT BE PUMPED. The entry kick is once per slide and there is a
//      cooldown after one ends, so tapping the key down a hill is slower than
//      holding it.
//   3. IT ENDS ITSELF. Below capySLIDE_OUT the animal gets up, so the state
//      cannot be held as a cheaper walk.
const capySLIDE_MIN  = 3.30;        // m/s of ground speed needed to go down
const capySLIDE_OUT  = 1.55;        // ...and the speed it gets back up at
const capySLIDE_SLIP = 0.86;        // the slip a belly on the ground is worth
const capySLIDE_KICK = 1.35;        // m/s of shove into the slide, once, on entry
const capySLIDE_MINT = 0.28;        // s it always lasts, so a tap still reads
const capySLIDE_COOL = 0.34;        // s before another can be started
const capySLIDE_AIR  = 0.45;        // s of airtime a slide survives (a lip, a kerb)
const capySLIDE_DROP = 0.20;        // m the model settles by
const capySLIDE_TILT = 0.16;        // rad of nose-down it takes with it
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
// ---- B9: hold to put it down, item 4a ------------------------------------
// 0.35 s, which is the number item 4a asks for and is comfortably longer than
// a click — the grab wind-up above is 0.10 s and was measured against a 60 ms
// tap and found to be shorter than one. Anything under about a quarter of a
// second here would make ordinary throws into put-downs.
const capyPUT_HOLD  = 0.35;
// ...and "while stationary". Walking speed is 4.2 m/s (measured — the authored
// figure in the friction note), so this is a shuffle.
const capyPUT_STILL = 0.9;   // m/s

// ---- B10: CHARGE THE THROW, item 4b ---------------------------------------
//
// MEASURED FIRST, and two of item 4b's three numbers moved.
//
// "Pitch from the camera's elevation" cannot be built: `game.input` carries
// x, z, run, action, honk, whistle, jump, slide and camYaw, and NO PITCH OF
// ANY KIND. The player can orbit the boom and never raise or lower it, and the
// resting elevation measured over eight seconds is 29.3-29.8 degrees — half a
// degree of breathing. Reading the throw's pitch off it would read a constant.
// So the charge sets the RANGE and the facing sets the bearing, and the thing
// that makes it aimable is the mark on the ground rather than an angle.
//
// "5-11 m/s" was written without the gravity. `world.gravity.y` is -24, three
// times earth, and the present tap-throw leaves at 7.09 m/s (5.12 across, 4.90
// up — a 43.7 degree launch, near enough the optimum) and lands a sun hat at
// 1.65 m. Eleven metres a second at this gravity is a five-metre throw. The
// charge therefore scales the whole launch vector, and the top of the range is
// set by the distance it has to reach rather than by a speed somebody guessed.
const capyCHG_TIME  = 0.85;   // s of holding to reach a full charge
const capyCHG_MIN   = 0.18;   // s before it is a charge at all rather than a tap
const capyCHG_MAX_K = 2.15;   // × the tap's launch vector at full charge
// The mark is drawn by systems.js, which owns the scene overlay and the beacon
// this borrows its shape from; capybara.js owns the ballistics and publishes
// the point. See capy.aim.
// 0.22 and not 0.10, judged from the render: below about a fifth of a charge
// a sun hat's mark lands 1.2 m out, which from the resting boom's 29 degrees
// is BEHIND THE ANIMAL'S OWN BODY. It was drawn, and it was not visible.
const capyCHG_MARK_MIN = 0.22;  // charge below which no mark is drawn

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
// GONE (D2). It said "metres of ground per half gait cycle (~= foot arc)" and
// it was a constant, while the foot arc it claimed to equal is 2 * capyLEG_R *
// sin(swingAmp) and swingAmp is speed-dependent — so it was right at a sprint
// and three times too long at a creep. The stride is derived where the swing
// is now; see the D2 block above capyLEG_R.
// --- solver-friendly tuning (velocity space only — we never write position) --
const capyGROUND_KP = 9;            // floor recovery gain, metres of gap -> m/s
const capyGROUND_SLOP = 0.02;       // penetration we simply ignore (real contacts own it)
const capyGROUND_VMAX = 3.0;        // cap on the corrective rise so it can't launch
const capyVOID_Y = -3;              // below this we genuinely fell out of the world
// ---- ...AND THE HALF-METRE VERSION OF IT, WHICH IS THE ONE THAT HAPPENS ----
// capyVOID_Y catches an animal that has fallen OUT of the world. The failure
// players actually report is thirty centimetres of it: something puts the body
// inside a solid — a stall collapsing on you, a vehicle, a corner whose collider
// does not agree with its picture — and the contact equation pushes it out
// through the nearest face, which under a building floor is DOWNWARDS. What is
// left is a stalemate that never resolves: the backstop below asks for a rise
// every frame, the contact push puts it straight back, and the animal stands
// under the pavement with grounded === true and a permanent 0.85 m/s of upward
// velocity going nowhere. Measured in Cali, Hanoi, Kowloon, Manly and Rio.
//
// The tell is not the depth, it is that THE CORRECTION IS NOT WORKING: the
// backstop has been asking for the same rise for capySTUCK_T and the body has
// not moved. Falling does not trigger it, because a falling body is moving; and
// standing on anything at all does not, because the gap is then <= 0.
const capySTUCK_GAP = 0.22;         // m below the floor before we start counting
const capySTUCK_MOVE = 0.05;        // m of vertical travel that says it is not stuck
const capySTUCK_T = 0.45;           // s of not moving before we put it back
// ...and two corrections to the above, both measured (qa/px-stuck.js, and the
// 168-point settle scan in qa/px-stuck-scan.js).
//
// THE MOVEMENT TEST HAS TO BE LOW-PASSED, because the failure it is watching
// for OSCILLATES. Under the Pasto plaza the backstop and the contact push trade
// blows at 0.159 m per frame pair — three times capySTUCK_MOVE — so the frame
// delta reset the timer on EVERY frame and the animal walked nine metres under
// the cobbles with the safety net never once arming. A one-pole filter at this
// lambda converges on the mean of a two-frame square wave to about 4 mm, while
// still tracking any genuine climb or descent inside the 0.45 s window.
const capySTUCK_LP = 6;             // 1/s, the filter on body Y
// AND THE GAP ALONE CANNOT TELL THE TWO FAILURES APART. Standing under a plaza
// and standing on a riverbank whose lattice disagrees with its law both read as
// "below the floor, on a contact, not moving". The settle scan says the honest
// disagreement is small — p95 0.038 m, p99 0.157 m over 168 points in six
// chapters — so capySTUCK_GAP at 0.22 is not the problem and does not need
// raising. What separates them is whether anything is OVERHEAD; see
// capyLidAbove. Past this depth we stop asking, because no lattice error in the
// game is a metre and something has gone properly wrong.
const capySTUCK_DEEP = 1.0;         // m under the law that is stuck whatever is above
const capySTUCK_LID = 2.6;          // m of headroom the lid ray looks through
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
// ---- A SANITY CLAMP MUST BE ABOVE THE FASTEST HONEST CARRIER (X8) ---------
// This was 12, and Monte Carlo's cars do 26.5. So the roof of a car on the
// pit straight handed its passenger a frame of 12 while the roof itself did
// 26.5, and the animal left over the back at fourteen and a half metres a
// second — which is a car length every sixth of a second.
//
// It did not read as broken, and that is the interesting part: the ride mostly
// SURVIVED, because monBuildCars puts four sixteen-centimetre rails round the
// cockpit and the solver simply shoved the animal along against the back one.
// A declared frame that is short by 14.5 m/s was being made up by penetration
// recovery. Measured, three legs of four seconds each, before and after:
//
//   clamp 12   leg 1 held  8/40 samples   mean speed deficit 6.40 m/s
//              leg 2 held 40/40                              1.95
//              leg 3 held 40/40                              0.68
//   clamp 30   leg 1 held 40/40                              0.16
//              leg 2 held 40/40                              0.09
//              leg 3 held 40/40                             -0.32
//
// 30 is a sanity clamp again rather than a speed limit: qa/px-carriers.js
// walked all nineteen chapters and the fastest moving kinematic body in the
// game is Monaco's 26.5, with the next fastest — Circular Quay's ferry — at
// 8.6. Nothing legitimate is within three and a half metres a second of this
// number, and main.js's 90 m/s cap is still the guard against a real runaway.
const capyPLAT_VMAX = 30;           // sanity clamp on inherited platform speed
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
// How far up the shin the ankle band reaches. It is a GEOMETRY number as well
// as a shading one: the shin carries a vertex ring at exactly this height so
// the band has an edge to end on, and the coat reads the same constant back.
const capyANKLE_H = 0.06;
// The shin, hand-authored (R4) rather than a CylinderGeometry: same 6 sides,
// same taper, same 0.32, plus the one extra ring 6 cm off the sole that the
// ankle band needs somewhere to live. See capyLegGeo.
const capyGeoLeg = capyLegGeo(0.100, 0.068, 0.29, 6, capyANKLE_H);
const capyGeoRing = new THREE.CylinderGeometry(1, 1, 0.05, 8, 1, true);
// The wardrobe's three. A unit disc (hat brims, bands, lenses), a unit dome
// (crowns, hoods, helmets) and a unit box are between them every costume in the
// game, which is the point of building them here: ten hats that each allocate
// their own cylinder are ten geometries for one shape.
const capyGeoDisc = new THREE.CylinderGeometry(1, 1, 1, 12);
const capyGeoDome = new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.52);
const capyGeoBox = new THREE.BoxGeometry(1, 1, 1);
// The two feet (R4). The foot WAS the unit box, scaled — the same 0.145 x 0.05
// x 0.175 these keep — and the front and the hind one differ in exactly one
// thing, which is the number of toes: four in front, three behind, which is the
// real animal. See capyFootGeo.
const capyFOOT_W = 0.145, capyFOOT_H = 0.05, capyFOOT_D = 0.175;
const capyGeoFootF = capyFootGeo(capyFOOT_W, capyFOOT_H, capyFOOT_D, 4, 0.012, 0.022);
const capyGeoFootR = capyFootGeo(capyFOOT_W, capyFOOT_H, capyFOOT_D, 3, 0.012, 0.022);

// ---------------------------------------------------------------------------
// THE HULL (R2) — ONE BODY, NOT A STACK OF SEVEN BALLS.
//
// The animal was a barrel, a saddle, a rump and four shoulder blobs. Seven
// ellipsoids, and from the side the top line was three arcs with two creases in
// them, where a capybara has ONE line rising from the withers to the highest
// point of the animal, which is over the HIPS and not over the ribs. That line
// is the species read at playing distance; the stack read as a bag of oranges,
// and no amount of shading fixes a shape.
//
// `capyHULL` is that line as a table of stations. Each row is one slice across
// the animal; each slice is `capyHULL_D`, a flattened D — flat along the top,
// widest a third of the way down, tucked under. Twelve sides, and no more on
// purpose: a smooth section is a smooth animal and this game does not have one.
//
// Three things ride on it being a TABLE and not a mesh:
//
//   1. The wardrobe's shells are built from the same table, inflated
//      (`capyHullFit`), so a jacket cannot quietly stop being proud of a body
//      whose shape has changed. Before this, both shells were ellipsoids fitted
//      by hand to the barrel, and the hull's hip — 1 cm higher than the saddle
//      ever was — came straight through the back of the dinner jacket.
//   2. The coat (R1) is a function of MODEL-SPACE POSITION, so the hull's
//      vertices are painted by the same `capyCoatAt` as everything else and not
//      one number of the gradient had to be re-authored for a new shape.
//   3. The stations are readable. The proportions of this animal are now five
//      rows of four numbers instead of seven ellipsoids' worth of centres and
//      radii that only compose in the render.
//
// Model space, feet at y = 0. The geometry is authored about a PIVOT low in the
// body (`capyHULL_PIVOT`) so the idle breath scales it the way a chest actually
// expands: up and out, not down through the ribs and into the floor.
const capyHULL = [
  // z,     half-width, top y, bottom y
  [0.46, 0.15, 0.580, 0.370],   // chest, closed off INSIDE the skull box
  [0.34, 0.27, 0.660, 0.220],   // shoulder front; buries the skull's rear face
  [0.10, 0.32, 0.700, 0.170],   // deepest station — this one is the barrel
  [-0.15, 0.31, 0.720, 0.180],  // the top line is still rising here
  [-0.38, 0.28, 0.735, 0.240],  // over the hips: the HIGHEST point of the animal
  [-0.55, 0.19, 0.615, 0.355],  // the rump, closing...
  [-0.60, 0.105, 0.545, 0.410]  // ...onto the tail, BLUNTLY. See the note.
];
const capyHULL_PIVOT = [0, 0.20, -0.05];
// The right half of the section, from top centre round to bottom centre. `u` is
// the fraction of the half-width, `v` the fraction of the height from the
// station's bottom to its top. The left half is this walked backwards, so the
// ring closes on itself and the winding is the same all the way round.
const capyHULL_D = [
  [0.00, 1.000],
  [0.55, 0.975],
  [0.93, 0.850],
  [1.00, 0.600],   // widest a third of the way down
  [0.80, 0.240],
  [0.35, 0.030],
  [0.00, 0.000]
];
const capyHULL_N = (capyHULL_D.length - 1) * 2;

// ---- THE SEATS (N1) --------------------------------------------------------
//
// The single most-shared fact about this species is that other animals sit on
// it, and until now the one animal in this game nothing sat on was the
// capybara. `capy.back(i, out)` is where a passenger goes; systems.js owns who
// is sitting there (see THE PERCH) and every chapter goes on drawing its own
// animal exactly as it did.
//
// THREE SEATS, ALL AFT OF THE EARS. The ears reach 0.278 and the skull top is
// 0.18 above the muzzle line, so anything forward of about z = 0.25 is a hat
// and not a passenger — and a hat is the wardrobe's job. These three sit along
// the top line of the hull between the shoulder and the hips, which is the one
// part of this animal that reads from every bearing including the resting
// lens's own three-quarter rear.
//
// THE HEIGHTS ARE READ OFF `capyHULL`, NOT AUTHORED. A seat written as a
// number goes inside the animal the first time somebody changes its shape —
// which has happened once already this month (R2 raised the shoulder 11 cm and
// buried both lapels of a costume that had been fitted by hand). `+ capySEAT_H`
// is the only authored part: how far a foot stands off the fur.
const capySEAT_Z = [0.06, -0.16, -0.38];
const capySEAT_H = 0.015;         // m a passenger's feet stand off the coat

/** One station, interpolated along the table. Clamped at both ends. */
function capyHullAt(z) {
  const t = capyHULL;
  if (z >= t[0][0]) return t[0].slice();
  const n = t.length;
  if (z <= t[n - 1][0]) return t[n - 1].slice();
  for (let i = 1; i < n; i++) {
    if (z < t[i][0]) continue;
    const a = t[i - 1], b = t[i];
    const k = (a[0] - z) / (a[0] - b[0]);
    return [z, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k,
            a[3] + (b[3] - a[3]) * k];
  }
  return t[n - 1].slice();
}

/**
 * The stations between two z, with both ends interpolated onto the table. This
 * is how a costume shell gets the body's own shape: take the slice of the
 * animal the garment covers, inflate it, and it is proud everywhere by
 * construction rather than everywhere the author happened to check.
 */
function capyHullFit(zFrom, zTo) {
  const rows = [capyHullAt(zFrom)];
  for (let i = 0; i < capyHULL.length; i++) {
    const z = capyHULL[i][0];
    if (z < zFrom && z > zTo) rows.push(capyHULL[i].slice());
  }
  rows.push(capyHullAt(zTo));
  return rows;
}

/**
 * Rows of stations into a flat-shaded body.
 *
 * NON-INDEXED, so `computeVertexNormals` gives every triangle its own face
 * normal — which is not only the flat-shaded look. The rim in shared.js is a
 * Fresnel on an INTERPOLATED normal, so a shared vertex normal that points
 * somewhere between two faces makes both of them rim as though they were edge
 * on. That is measurable, it is what made the old nose pad render pale, and a
 * per-face normal is immune to it.
 *
 * `dw` / `dTop` / `dBot` inflate the section: outward, upward, and up-from-
 * underneath — a jacket rides ABOVE the belly, so its bottom is raised rather
 * than dropped.
 */
function capyHullGeo(rows, dw, dTop, dBot) {
  const R = rows.length, N = capyHULL_N;
  const px = capyHULL_PIVOT[0], py = capyHULL_PIVOT[1], pz = capyHULL_PIVOT[2];
  const ring = [], mid = [];
  for (let r = 0; r < R; r++) {
    const st = rows[r];
    const hw = st[1] + (dw || 0), top = st[2] + (dTop || 0), bot = st[3] + (dBot || 0);
    const a = [];
    for (let i = 0; i < N; i++) {
      const j = i < capyHULL_D.length ? i : N - i;
      const s = i < capyHULL_D.length ? 1 : -1;
      const d = capyHULL_D[j];
      a.push(s * d[0] * hw - px, bot + d[1] * (top - bot) - py, st[0] - pz);
    }
    ring.push(a);
    mid.push([-px, (top + bot) * 0.5 - py, st[0] - pz]);
  }
  const tris = (R - 1) * N * 2 + N * 2;
  const pos = new Float32Array(tris * 9);
  let o = 0;
  function put(a, i, b, j, c, k) {
    pos[o++] = a[i * 3]; pos[o++] = a[i * 3 + 1]; pos[o++] = a[i * 3 + 2];
    pos[o++] = b[j * 3]; pos[o++] = b[j * 3 + 1]; pos[o++] = b[j * 3 + 2];
    pos[o++] = c[k * 3]; pos[o++] = c[k * 3 + 1]; pos[o++] = c[k * 3 + 2];
  }
  for (let r = 0; r < R - 1; r++) {
    const a = ring[r], b = ring[r + 1];
    for (let i = 0; i < N; i++) {
      const n = (i + 1) % N;
      put(a, i, a, n, b, i);
      put(a, n, b, n, b, i);
    }
  }
  // The two ends. Fanned from the station's mid-height, which is inside the D
  // at every station because the widest point is below it.
  const f = ring[0], bk = ring[R - 1], cf = mid[0], cb = mid[R - 1];
  for (let i = 0; i < N; i++) {
    const n = (i + 1) % N;
    put(cf, 0, f, n, f, i);      // front: outward is +z
    put(cb, 0, bk, i, bk, n);    // back: outward is -z
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * THE MUZZLE (R3) — THE SAME BRICK, WITH THE LIGHT PUT BACK ON IT.
 *
 * The snout was a plain box 0.325 x 0.20 x 0.26 and the single biggest species
 * tell on the animal, and a plain box has exactly two values on it from any
 * angle: a lit top and a shaded front. A real muzzle is deep and blunt and the
 * interesting thing about it is the EDGE where those two meet, which is where
 * the light changes. So: the same footprint, a 3.5 cm chamfer at 30 degrees
 * along the top front edge, and 2.5 cm off the two front vertical edges.
 *
 * The underside stays square, and that is load-bearing rather than tidy: the
 * jaw is a solid box tucked flush under this one and inset 1.25 cm a side, and
 * a chamfer that ran to the bottom would put the jaw's front corners OUTSIDE
 * the muzzle and open a seam in a closed mouth. The corner cut therefore ramps
 * in over the first 3.5 cm above the underside.
 *
 * Built as four horizontal rings rather than a solved polyhedron, because every
 * feature here is a function of height: the corner cut ramps in with y and the
 * top chamfer pulls the front face back with y. Forty-four triangles, four of
 * them degenerate where the corner cut is still zero.
 */
function capyMuzzleGeo(w, h, d, cham, bevel, ramp) {
  const X = w * 0.5, Y = h * 0.5, Z = d * 0.5;
  const drop = cham * Math.tan(Math.PI / 6);       // 30 degrees off the top face
  const rows = [
    [-Y, 0, Z],                  // the underside: square, for the jaw
    [-Y + ramp, bevel, Z],       // ...and the corner cut is fully in by here
    [Y - drop, bevel, Z],
    [Y, bevel, Z - cham]         // the top face, pulled back by the chamfer
  ];
  const N = 6, R = rows.length;
  const ring = [];
  for (let r = 0; r < R; r++) {
    const y = rows[r][0], c = rows[r][1], zf = rows[r][2];
    ring.push([-X, y, -Z, X, y, -Z, X, y, zf - c, X - c, y, zf,
               -(X - c), y, zf, -X, y, zf - c]);
  }
  const tris = (R - 1) * N * 2 + (N - 2) * 2;
  const pos = new Float32Array(tris * 9);
  let o = 0;
  function put(a, i, b, j, c, k) {
    pos[o++] = a[i * 3]; pos[o++] = a[i * 3 + 1]; pos[o++] = a[i * 3 + 2];
    pos[o++] = b[j * 3]; pos[o++] = b[j * 3 + 1]; pos[o++] = b[j * 3 + 2];
    pos[o++] = c[k * 3]; pos[o++] = c[k * 3 + 1]; pos[o++] = c[k * 3 + 2];
  }
  for (let r = 0; r < R - 1; r++) {
    const a = ring[r], b = ring[r + 1];
    for (let i = 0; i < N; i++) {
      const n = (i + 1) % N;
      put(a, i, b, i, a, n);
      put(a, n, b, i, b, n);
    }
  }
  const lo = ring[0], hi = ring[R - 1];
  for (let i = 1; i < N - 1; i++) {
    put(lo, 0, lo, i, lo, i + 1);          // underside: outward is -y
    put(hi, 0, hi, i + 1, hi, i);          // top face: outward is +y
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * THE NOSE PAD (R3) — AND WHY THE OLD ONE RENDERED PALE.
 *
 * MEASURED (`qa/pad-why.js`, in-frame A/B on the pad's own visibility, so the
 * "muzzle" sample is literally the pixels the pad was covering):
 *
 *   albedo, pad against muzzle .......... 0.256
 *   RENDERED, from the resting lens ..... 1.120   — the pad is BRIGHTER
 *   fraction of the pad's pixel that is
 *     ADDED after the albedo ............ 0.731   (the muzzle's is 0.049)
 *
 * Three quarters of a dark brown nose was light the shader ADDS — the rim in
 * shared.js, which goes onto `outgoingLight` and therefore does not care how
 * dark the material under it is. The pad collected so much of it because it was
 * a four-sided TAPERED cylinder squashed to 0.30 in z: a four-segment cylinder
 * puts its vertex normals on the CORNERS, 45 degrees off the face they belong
 * to, and the squash levers them further round still, so the rim's Fresnel saw
 * every face as near edge-on and lit the lot. A colour cannot fix that. Nothing
 * in the palette can: at that additive fraction, black renders at 69 grey
 * levels.
 *
 * So the pad is now a hand-authored plate wrapping the muzzle's front-top edge,
 * non-indexed and flat, with HONEST face normals — and on `matSelf`, so it is
 * inside the animal's own rim budget rather than the scenery's, and with
 * `vertexColors` so its top run can be taken down the 0.70 that answers the
 * extra sun an up-facing surface gets. The profile is authored in the (y, z)
 * plane and extruded across; `d` is how far it stands off the muzzle.
 */
function capyPadGeo(prof, w) {
  const n = prof.length;
  const tris = n * 2 + (n - 2) * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  let o = 0;
  function v(s, i) {
    // sRGB intent in the table, linear in the buffer — the same conversion
    // every other number in the coat goes through. See capyCoatK.
    const k = capyCoatK(prof[i][2] === undefined ? 1 : prof[i][2]);
    col[o] = k; col[o + 1] = k; col[o + 2] = k;
    pos[o++] = s * w; pos[o++] = prof[i][0]; pos[o++] = prof[i][1];
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    v(1, i); v(1, j); v(-1, i);
    v(1, j); v(-1, j); v(-1, i);
  }
  for (let i = 1; i < n - 1; i++) {
    v(1, 0); v(1, i + 1); v(1, i);
    v(-1, 0); v(-1, i); v(-1, i + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * THE FOOT (R4) — THE SAME FOOTPRINT, WITH TOES CUT INTO IT.
 *
 * A foot was `capyGeoBox` scaled to 0.145 x 0.05 x 0.175: a slab, twelve
 * triangles, and from every camera in the game a rectangle. In the loaf — the
 * pose the animal spends most of its life in and the one it is most often
 * photographed in — the four feet are the closest parts of the animal to the
 * lens and the only ones at eye level, so a slab there is the most visible
 * missing detail on the model.
 *
 * Built in PLAN and extruded, because everything this shape has to say is in
 * plan: the outline is a polygon in x/z with the front edge notched, and the
 * only thing that happens in y is the chamfer along the top rear edge, where
 * the foot meets the shin. `toes` tips and `toes - 1` valleys between them, the
 * outer two tips being the corners — so four toes needs three notches and not
 * four, which is the count a foot actually has between its toes.
 *
 * Front feet four toes, hind three; that is the real animal, and it is the
 * cheapest species tell left on the model. Thirty-two triangles on a front
 * foot, twenty-four on a hind one.
 *
 * NON-INDEXED, per-face normals, for the reason THE HULL's comment gives: the
 * rim is a Fresnel on an interpolated normal and a shared vertex normal at the
 * point of a toe would rim the whole toe as though it were edge on.
 */
function capyFootGeo(w, h, d, toes, notch, cham) {
  const X = w * 0.5, Y = h * 0.5, Z = d * 0.5;
  // The plan outline, wound front-left -> front-right -> rear-right ->
  // rear-left, which is +x then -z: that order fans to a +y normal (see below).
  const plan = [];
  for (let i = 0; i < toes * 2 - 1; i++) {
    // Even i is a toe tip at the full length, odd i a valley cut back by
    // `notch`. The tips are spread evenly across the width and the outer two
    // ARE the corners, because a foot's outer toes are its edges.
    const k = i * 0.5;
    plan.push(i % 2 ? [-X + w * (k / (toes - 1)), Z - notch]
                    : [-X + w * (k / (toes - 1)), Z]);
  }
  plan.push([X, -Z], [-X, -Z]);
  const P = plan.length;
  // ...and the top ring is the same outline with the two rear corners pulled
  // forward, which is the chamfer: a foot's top rear edge is where the shin
  // lands on it, and a square corner there is a step in the silhouette.
  const lo = [], hi = [];
  for (let i = 0; i < P; i++) {
    const rear = i >= P - 2;
    lo.push(plan[i][0], -Y, plan[i][1]);
    hi.push(plan[i][0], Y, plan[i][1] + (rear ? cham : 0));
  }
  const tris = (P - 2) * 2 + P * 2;
  const pos = new Float32Array(tris * 9);
  let o = 0;
  function put(a, i, b, j, c, k) {
    pos[o++] = a[i * 3]; pos[o++] = a[i * 3 + 1]; pos[o++] = a[i * 3 + 2];
    pos[o++] = b[j * 3]; pos[o++] = b[j * 3 + 1]; pos[o++] = b[j * 3 + 2];
    pos[o++] = c[k * 3]; pos[o++] = c[k * 3 + 1]; pos[o++] = c[k * 3 + 2];
  }
  for (let i = 1; i < P - 1; i++) {
    put(lo, 0, lo, i + 1, lo, i);          // the sole: outward is -y
    put(hi, 0, hi, i, hi, i + 1);          // the top: outward is +y
  }
  for (let i = 0; i < P; i++) {
    const n = (i + 1) % P;
    put(lo, i, lo, n, hi, n);
    put(lo, i, hi, n, hi, i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * THE SHIN (R4) — AND WHY THE ANKLE BAND NEEDED A NEW ONE.
 *
 * The band R4 asks for is six centimetres of darker fur at the bottom of a
 * shin, painted through the coat's `color` attribute. A `CylinderGeometry`
 * CANNOT CARRY IT: with `heightSegments` 1 it has vertex rings at its two ends
 * and nowhere else, so a vertex colour that is meant to change 6 cm off the
 * ground has no vertex to change at and the band comes out as a full-length
 * gradient up the whole leg. Raising `heightSegments` to get one ring adds
 * three more nobody wants (6 radial segments x 8 extra bands = 48 triangles a
 * leg, for one line).
 *
 * So: a tapered tube with EXACTLY the rings it needs — the sole, the ankle, and
 * the top — and no top cap, because the top of a shin is 11 cm inside the hull
 * and has never been drawn. Twenty-eight triangles against the cylinder's
 * twenty-four, and the same 6 sides. Per-face normals, which the cylinder did
 * not have either: a 6-segment cylinder's vertex normals sit on its corners,
 * 30 degrees off the faces, and rim accordingly.
 *
 * AND THE TAPER TURNED ROUND. It was 0.078 at the top and 0.10 at the BOTTOM —
 * a leg that flares at the ankle, and an ankle 20 cm across on a foot 14.5 cm
 * wide. With the foot a slab that was invisible; with a foot that has toes cut
 * into it, the shin's bottom cap swallowed them from behind and dug into the
 * ground beside them. 0.100 to 0.068, which is the way round a leg goes, puts
 * the ankle INSIDE the footprint. The shin is 0.29 rather than 0.32 for the
 * same reason: it now stops 2 cm inside the top of the foot instead of ending
 * flush with the sole, where it was coplanar with it.
 */
function capyLegGeo(rTop, rBot, h, seg, split) {
  const ys = [-h * 0.5, -h * 0.5 + split, h * 0.5];
  const ring = ys.map(y => {
    const t = (y + h * 0.5) / h, r = rBot + (rTop - rBot) * t, a = [];
    for (let i = 0; i < seg; i++) {
      const th = (i / seg) * Math.PI * 2;
      a.push(-Math.sin(th) * r, y, Math.cos(th) * r);
    }
    return a;
  });
  const tris = (ring.length - 1) * seg * 2 + (seg - 2);
  const pos = new Float32Array(tris * 9);
  let o = 0;
  function put(a, i, b, j, c, k) {
    pos[o++] = a[i * 3]; pos[o++] = a[i * 3 + 1]; pos[o++] = a[i * 3 + 2];
    pos[o++] = b[j * 3]; pos[o++] = b[j * 3 + 1]; pos[o++] = b[j * 3 + 2];
    pos[o++] = c[k * 3]; pos[o++] = c[k * 3 + 1]; pos[o++] = c[k * 3 + 2];
  }
  for (let r = 0; r < ring.length - 1; r++) {
    const a = ring[r], b = ring[r + 1];
    for (let i = 0; i < seg; i++) {
      const n = (i + 1) % seg;
      put(a, i, b, i, a, n);
      put(a, n, b, i, b, n);
    }
  }
  const sole = ring[0];
  for (let i = 1; i < seg - 1; i++) put(sole, 0, sole, i, sole, i + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// THE COAT (R1) — WHERE THE ANIMAL IS DARK AND WHERE IT IS PALE.
//
// The subject of this game was ONE flat brown from every angle. Nine meshes
// carrying `PALETTE.capy`, six carrying `capyDark`, three carrying `capyLight`,
// and nothing between them but the facet lighting — so from the playing camera
// the animal read as a brown mass with a lighter line under it, and the only
// thing separating its back from its flank was which way the facet happened to
// face the sun. A real capybara is not one colour: the guard hair along the
// midline is near-black, the flank is a warm red-brown, and the throat and
// belly are yellow-brown where the skin shows through. The gradient is
// VERTICAL, not front-to-back.
//
// This is the cheapest possible way to buy that, and it is the way the crowd
// has been drawn since P5: a `color` attribute on the geometry and
// `vertexColors: true` on the material. No texture (the contract forbids one),
// no second material, no second mesh, NO NEW DRAW CALL — the same meshes are
// submitted, carrying three more floats per vertex. The one real cost is one
// extra shader program: `vertexColors` is part of three's own program cache
// key, so the animal's six materials stop sharing the scenery's compiled
// program and compile one of their own, once, at boot. That is a compile, not
// a draw, and the rim is untouched — same `matSelf`, same uniform pair, same
// `customProgramCacheKey`.
//
// FOUR THINGS ABOUT HOW.
//
//  1. IT IS A FUNCTION OF MODEL-SPACE POSITION, not hand-painted vertices.
//     Every vertex is transformed up into `capyModel`'s frame (feet at y = 0,
//     +z forward) and asked where it is on the animal. That is the whole
//     reason it is written this way, and R2 collected on it: seven blobs
//     became one hand-authored hull and the hull got the same coat by calling
//     the same function, with no number in this block re-authored.
//  2. THE GEOMETRY HAS TO BE CLONED FIRST. `capyGeoBlob` is shared by the
//     the belly, the tail, the ears and both cheeks — a colour attribute
//     written on the shared buffer would paint the ears with the belly's
//     gradient. Cloned per part, once, at create. Same for the shin and the
//     two feet, which are one buffer each for two legs.
//  3. THE NUMBERS ARE sRGB AND THE MULTIPLY IS LINEAR. The vertex colour
//     multiplies the material's albedo in the LINEAR working space, and "0.80
//     of the brown" is a number a person reasons about in sRGB. 0.80 handed
//     straight to the shader renders as 0.90 — a change nobody can see, and
//     the exact shape of a polish task that measures as nothing. The three
//     gradient stops are converted through THREE.Color, which does that
//     conversion for a living; the three multipliers that have no single base
//     colour (they land on `capy`, `capyLight` AND `capyDark`) go through the
//     same transfer written as a power.
//  4. EVERY MESH WEARING A FUR MATERIAL MUST GET THE ATTRIBUTE. `vertexColors`
//     with no `color` attribute is not a warning and not a fallback: WebGL
//     hands the shader the default generic attribute, which is BLACK. So the
//     pass is a traverse that finds meshes by MATERIAL, rather than a list of
//     names that the next person to add a whisker will forget to join.
// ---------------------------------------------------------------------------

// A gradient stop as a linear multiplier on the fur. Derived from the palette
// rather than written out twice: the spine renders AS `capySpine`.
function capyCoatOf(hex) {
  const a = new THREE.Color(hex), b = new THREE.Color(PALETTE.capy);
  return [a.r / b.r, a.g / b.g, a.b / b.b];
}
/** An sRGB-intent multiplier as the linear one that renders as it. See 3. */
function capyCoatK(m) { return Math.pow(m, 2.4); }
function capyCoat3(a, r, g, b) {
  return [a[0] * capyCoatK(r), a[1] * capyCoatK(g), a[2] * capyCoatK(b)];
}

// ---------------------------------------------------------------------------
// A COAT REDISTRIBUTES LIGHT. IT DOES NOT REMOVE IT — and the first version of
// this one did, which is a P1 regression and not a shading opinion.
//
// The obvious build is: the flank is `capy` unchanged, and the gradient hangs
// off it. But the gradient is ONE WIDE DARKENING (the whole dorsal surface,
// which from a camera 35 degrees above and behind is most of the animal)
// against two small brightenings — a belly half hidden under the animal and a
// throat 4 cm across. Its area-weighted mean is well below 1, so it does not
// redistribute the animal's light, it removes 4.6% of it. Measured, coat off
// to on, mean luminance over the animal's own pixels:
//
//     sydney 104.6 -> 100.2    cali 106.5 -> 101.2
//     sahara 121.1 -> 115.1    antarctic 124.3 -> 119.2
//
// Against a bright ground that is free contrast (Sydney's lawn 41.1 -> 45.8,
// the Sahara 55.0 -> 61.4). Against a DARK one it is the animal walking toward
// the background: Cali 23.5 -> 17.9, and Cali is the weakest silhouette in the
// game. P1's whole subject is that the animal must be findable on the ground
// it is standing on, and no gradient is worth a quarter of that.
//
// No shape of gradient raises contrast in every chapter — a darker animal
// helps on light ground and hurts on dark, and the reverse — so the target is
// not "better everywhere", it is NEUTRAL: change the variance, leave the mean.
// `capyFlank` is `capy` warmed by the 7.7% that does that, and every stop is
// quoted against IT rather than against `capy`. See qa/coat-silh.js, which
// measures both states in one frame, in one chapter, under one sun.
const capyCOAT_FLANK = capyCoatOf(PALETTE.capyFlank);    // capy x 1.077
const capyCOAT_SPINE = capyCoatOf(PALETTE.capySpine);    // flank x 0.80 0.74 0.70
const capyCOAT_THROAT = capyCoatOf(PALETTE.capyThroat);  // flank x 1.12 1.08 1.00
const capyCOAT_BELLY = capyCoat3(capyCOAT_FLANK, 1.10, 1.06, 0.98);  // underside
const capyCOAT_NOOK = capyCoat3(capyCOAT_FLANK, 0.78, 0.74, 0.72);   // creases
const capyCOAT_EAR = capyCoat3(capyCOAT_FLANK, 0.70, 0.66, 0.64);    // ear cup
const capyCOAT_ANKLE = capyCoat3(capyCOAT_FLANK, 0.82, 0.82, 0.82);  // the ankle

function capyCoat01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
function capyCoatMix(out, to, w) {
  if (w <= 0) return;
  if (w > 1) w = 1;
  out[0] += (to[0] - out[0]) * w;
  out[1] += (to[1] - out[1]) * w;
  out[2] += (to[2] - out[2]) * w;
}

/**
 * A BAND (R6): an annulus segment with a rectangular section, swept from
 * `from` to `to` about the local z axis. It is the shape a collar, a cuff or a
 * hood's ruff actually is, and the game had no way to draw one: `capyGeoRing`
 * is an OPEN TUBE, which from dead ahead is edge on and renders as a hairline,
 * and `capyGeoDisc` is solid and would cover the face it is meant to frame.
 *
 * It takes an angular range because the one place that wants it has to keep a
 * gap: a ruff that runs the whole way round crosses the jaw.
 *
 * Non-indexed with per-face normals, for the rim's sake (see THE HULL). The
 * winding was checked before it was drawn rather than after, by summing the
 * signed volume of the closed mesh: 0.0054745 against an analytic 0.0059020
 * for the true annulus segment, the 7% being what eight flat segments lose.
 */
function capyBandGeo(rIn, rOut, depth, seg, from, to) {
  const D = depth * 0.5;
  const prof = [[rOut, D], [rOut, -D], [rIn, -D], [rIn, D]];
  const S = [];
  for (let i = 0; i <= seg; i++) {
    const a = from + (to - from) * (i / seg), ca = Math.cos(a), sa = Math.sin(a);
    const ring = [];
    for (let k = 0; k < 4; k++) ring.push(ca * prof[k][0], sa * prof[k][0], prof[k][1]);
    S.push(ring);
  }
  const tris = seg * 8 + 4;
  const pos = new Float32Array(tris * 9);
  let o = 0;
  function put(a, i, b, j, c, k) {
    pos[o++] = a[i * 3]; pos[o++] = a[i * 3 + 1]; pos[o++] = a[i * 3 + 2];
    pos[o++] = b[j * 3]; pos[o++] = b[j * 3 + 1]; pos[o++] = b[j * 3 + 2];
    pos[o++] = c[k * 3]; pos[o++] = c[k * 3 + 1]; pos[o++] = c[k * 3 + 2];
  }
  for (let i = 0; i < seg; i++) {
    const a = S[i], b = S[i + 1];
    for (let k = 0; k < 4; k++) {
      const n = (k + 1) % 4;
      put(a, k, b, n, b, k);
      put(a, k, a, n, b, n);
    }
  }
  const f = S[0], e = S[seg];
  put(f, 0, f, 1, f, 2); put(f, 0, f, 2, f, 3);      // the two cut ends
  put(e, 0, e, 2, e, 1); put(e, 0, e, 3, e, 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

/**
 * THE COAT, at one point in model space. `limb` drops the two terms that
 * belong to the body's underside — a shin runs from y 0.00 to 0.32 and would
 * otherwise come out paler in the middle than at either end, which is the one
 * thing a leg must never do.
 */
function capyCoatAt(x, y, z, limb, out) {
  const ax = x < 0 ? -x : x;
  out[0] = capyCOAT_FLANK[0]; out[1] = capyCOAT_FLANK[1]; out[2] = capyCOAT_FLANK[2];
  if (!limb) {
    // THE UNDERSIDE, as a BAND and not a ramp: it comes in below y 0.30 and is
    // released again below y 0.16, because under the belly there is no belly.
    capyCoatMix(out, capyCOAT_BELLY,
                capyCoat01((0.30 - y) / 0.10) * capyCoat01((y - 0.10) / 0.06));
    // THE THROAT — the palest 4 cm on the animal, under the jaw's front.
    capyCoatMix(out, capyCOAT_THROAT,
                capyCoat01((z - 0.50) / 0.10) * capyCoat01((0.40 - y) / 0.08));
    // THE LEG ROOTS. R1 hung this crease on the four shoulder blobs, through
    // the `nook` mechanism, because four blobs is what there was. R2 dissolved
    // them into the hull and the crease came here instead — which is where it
    // always belonged, because it is a fact about a PLACE on the animal and not
    // about a part. Four soft wells low under the body where a leg goes in, and
    // the belly's own four corners pick them up for free.
    //
    // `limb` skips it: a shin's top already takes the same shade from its own
    // nook, and two writers on one crevice is twice as dark as either meant.
    const rx = ax - 0.15;
    for (let i = 0; i < 2; i++) {
      const rz = z - (i ? -0.28 : 0.28);
      capyCoatMix(out, capyCOAT_NOOK,
                  capyCoat01((0.19 - Math.sqrt(rx * rx + rz * rz)) / 0.11) *
                  capyCoat01((0.44 - y) / 0.12));
    }
  }
  // THE SPINE. Full within 10 cm of the dorsal centreline, gone by 20. The
  // roadmap said 6 cm and 10, and both numbers were wrong for the same reason,
  // which only the render showed:
  //
  //  - AT 10 IT IS A SEAM, NOT A BAND. The body puts its next vertex line in
  //    from the centre at |x| 0.18 (capyHULL_D's second row, on a 0.32 half
  //    width; it was an 8x6 sphere's |x| 0.11 when this was measured), so a
  //    band that ends at 0.10 has one vertex line inside it at most and reads
  //    as a crease in the model rather than a marking on the animal.
  //  - AND IT LEAVES THE HEAD BEHIND. The skull is a BOX: the only vertices on
  //    its top face are the four corners at |x| 0.18. A band that stops at 0.17
  //    darkens the back and cannot touch the skull, and the head comes out a
  //    brighter block sitting in front of a darker back — which is the exact
  //    two-tone the coat is supposed to remove. 0.20 catches those corners at a
  //    quarter weight, and the z term below turns that into a gradient that
  //    fades away toward the muzzle.
  //
  // The peak is unchanged by either; only the width is. Only on the back
  // (y 0.52 up) and only BEHIND the shoulder (gone by z 0.35), so it dies out
  // across the skull rather than running down the face — a capybara's face is
  // uniform, and a stripe between the eyes is a badger.
  capyCoatMix(out, capyCOAT_SPINE,
              capyCoat01((0.20 - ax) / 0.10) * capyCoat01((y - 0.52) / 0.10) *
              capyCoat01((0.35 - z) / 0.25));
}

/**
 * THE CREVICE SHADE. One mechanism, three uses: the inner face of a shoulder
 * blob, the top of a shin and the cup of an ear are all a surface that faces
 * INTO something and therefore never sees the sky. `nook` is that direction in
 * the part's own local frame; the weight is the squared cosine, because a
 * crevice is a crevice and not half the part.
 */
function capyCoatNook(out, dx, dy, dz, nook, to) {
  const d = dx * nook[0] + dy * nook[1] + dz * nook[2];
  if (d <= 0) return;
  capyCoatMix(out, to, d * d);
}

/**
 * THE ANKLE BAND (R4). The bottom of a shin, in the SHIN'S OWN frame and not
 * the animal's — which is the whole reason it is a tag and not another term in
 * capyCoatAt. A leg swings: model-space y at the foot end of a shin is 0.32 at
 * rest, 0.19 in the loaf and anything at all mid-stride, so a band written as a
 * height on the animal would slide up and down the leg as the animal walked.
 * A band written as a height on the LEG cannot.
 *
 * It is a hard edge and not a ramp — an ankle is a joint, not a gradient — and
 * the shin carries a vertex ring at exactly `capyANKLE_H` so it has one.
 */
function capyCoatAnkle(out, y, band) {
  capyCoatMix(out, band.to || capyCOAT_ANKLE,
              capyCoat01((band.y - y) / (band.fade || 0.004)));
}

// Shared buffers: anything in here has to be cloned before it can carry a coat.
// The two feet are here for the same reason the shin is — two legs each — even
// though nothing outside the animal uses them.
const capyGeoShared = new Set([capyGeoBlob, capyGeoBead, capyGeoLeg,
                               capyGeoRing, capyGeoDisc, capyGeoDome,
                               capyGeoBox, capyGeoFootF, capyGeoFootR]);
const _coatM4 = new THREE.Matrix4();
const _coatV = new THREE.Vector3();
const _coatRGB = [1, 1, 1];

/**
 * Paint the coat into every mesh under `root` whose material is one of the fur
 * set. Returns the number of meshes painted, so a probe can tell "the coat is
 * subtle" from "the coat never ran".
 *
 * Per-part intent rides on `mesh.userData.coat`, set at the point the part is
 * built because that is where the reader is: `{ flat: true }` for the handful
 * of fur-material parts that are not fur (a whisker, an eye's catchlight),
 * `{ limb: true }` for the legs, `{ nook: [x, y, z], to: [...] }` for a crease.
 */
function capyPaintCoat(root, furMats) {
  let painted = 0;
  root.traverse(function (o) {
    if (!o.isMesh || !o.geometry || !furMats.has(o.material)) return;
    if (capyGeoShared.has(o.geometry)) o.geometry = o.geometry.clone();
    const pos = o.geometry.attributes.position;
    if (!pos) return;
    const tag = o.userData.coat || null;
    const col = new Float32Array(pos.count * 3);
    // model space, NOT the mesh's own: walk the rest-pose transforms up to root
    _coatM4.identity();
    for (let n = o; n && n !== root; n = n.parent) {
      n.updateMatrix();
      _coatM4.premultiply(n.matrix);
    }
    for (let i = 0, o3 = 0; i < pos.count; i++, o3 += 3) {
      if (tag && tag.flat) { col[o3] = 1; col[o3 + 1] = 1; col[o3 + 2] = 1; continue; }
      _coatV.fromBufferAttribute(pos, i);
      // The local direction is the crevice's axis. Every coated part is a
      // sphere, a cylinder or a box centred on its own origin, so the
      // normalised local position is the outward direction on all three.
      let dx = _coatV.x, dy = _coatV.y, dz = _coatV.z;
      const L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
      dx /= L; dy /= L; dz /= L;
      _coatV.applyMatrix4(_coatM4);
      capyCoatAt(_coatV.x, _coatV.y, _coatV.z, tag && tag.limb, _coatRGB);
      if (tag && tag.nook) {
        capyCoatNook(_coatRGB, dx, dy, dz, tag.nook, tag.to || capyCOAT_NOOK);
      }
      // ...and the band is read off the part's own LOCAL y, before the matrix
      // above touched it, which is why it is taken from `pos` again rather than
      // from _coatV.
      if (tag && tag.band) capyCoatAnkle(_coatRGB, pos.getY(i), tag.band);
      col[o3] = _coatRGB[0]; col[o3 + 1] = _coatRGB[1]; col[o3 + 2] = _coatRGB[2];
    }
    o.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    painted++;
  });
  return painted;
}

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

// ---- THE ANIMAL ON THE HILL ------------------------------------------------
// Seventeen chapters publish a terrain law and until now the ONLY thing that
// read it for the model was the walking speed above. rotation.x was a speed
// lean, rotation.z was a turn roll, and neither had ever heard of the ground:
// the animal was held rigidly horizontal at a fixed height above its body
// centre while the hill under its nose and its tail went their own ways.
//
// Measured, before this existed, with the four drawn feet against the drawn
// ground on walkable slopes (qa/b4-pose.js): 45 cm between the highest and the
// lowest foot in Pasto, 41 in Antarctica, 40 in Monte Carlo.
//
// THE DIRECTION IS THE OPPOSITE OF THE ONE THAT WAS REPORTED. The collider is
// a chain of three spheres and on a slope it rests on the UPHILL one, so the
// body centre sits high and the animal FLOATS — mean +0.28 m in Monte Carlo,
// +0.27 in Rio. It reads as sinking because the downhill feet hang in the air
// while the uphill end is buried in the hillside. Pasto is the one chapter
// that genuinely sinks, and that is not this: its drawn ground sits above its
// collider (see block 3, and pastoBuildTerrainMesh).
//
// SET capyPOSE_TERRAIN TO 0 TO TURN THE WHOLE THING OFF. This is the one
// change in the integrity pass that alters how the animal is DRAWN in all
// nineteen chapters at once, so it is the one that gets a switch.
const capyPOSE_TERRAIN = 1;         // 0 disables pitch, roll and lift together
const capyPOSE_LOOK  = 0.45;        // m fore and aft the ground is read over
const capyPOSE_WIDE  = 0.30;        // m to either side
const capyPOSE_MAX   = 0.62;        // rad, ~35 deg — a cliff edge is not a pose
const capyPOSE_LIFT  = 0.45;        // m, the most the model may be dropped
const capyPOSE_RAISE = 0.12;        // ...and the most it may be raised to bridge
const capyPOSE_LAMBDA = 5;          // near the rate the idle channels damp at
// How far the body may sit from where the terrain law predicts before the pose
// stops believing it is standing on terrain at all. Standing on a crate, a
// raft, a roof or a boulder puts the body a long way above the law, and a pose
// driven by the hill UNDER the roof would tilt the animal on a flat surface.
// Faded rather than switched, because a hard gate on a faceted world flickers.
const capyPOSE_TRUST = 0.25;        // m of disagreement that still reads as 1
const capyPOSE_DOUBT = 0.60;        // ...and where it has faded to nothing
// The trust gets a filter of its OWN, and slower than the pose it scales. Its
// input is the body's height above the law, which carries every millimetre of
// contact noise the solver leaves behind; ungated, that noise multiplied the
// whole pose on and off and the animal twitched. MEASURED, before this line
// existed: Goreme's roll went from 0.34 to 11.4 milliradians per frame squared
// with spikes at 78, and Cali's pitch spiked at 75.
const capyPOSE_TRUST_LAMBDA = 4;
let capyPosePitch = 0;              // rad, terrain pitch, damped
let capyPoseRoll  = 0;              // rad, terrain roll, damped
let capyPoseLift  = 0;              // m, model-only drop onto the hillside
let capyPoseTrust = 0;              // 0..1, damped
// The last gradient the law gave a straight answer for, HELD. A frame off the
// ground, a frame inside a doorway, a frame where a sample lands off the edge
// of the world: zeroing the gradient on any of those makes the target snap to
// level and back, which is the same twitch by another route. The gate is the
// trust, and the trust fades.
let capyPoseGF = 0, capyPoseGX = 0, capyPoseRise = 0;
let capyPoseSupY = 0;               // out-param of capyPoseFit, see below

/**
 * THE SLOPE A STIFF ANIMAL ACTUALLY TAKES ACROSS THREE HEIGHTS.
 *
 * A central difference is the obvious estimator and it is wrong at a break of
 * slope, which is most of what a built chapter is made of. Monte Carlo, at the
 * lip of a terrace: the law is dead flat for 1.2 m ahead and falls 1.38 m in
 * 1.2 m behind. The central difference calls that a 33 degree slope and tips
 * the animal backwards into a drop it is standing at the top of — measured, it
 * came out at 32 degrees of pitch AND 32 of roll on ground that is level.
 *
 * A rigid body does not average the ground. It rests on the UPPER CONVEX HULL
 * of the profile under its footprint, so with three samples the answer is the
 * supporting line: the lowest straight line through the middle sample or the
 * two outer ones that still lies above all three.
 *
 *   convex here (a crest, a lip) — it rests on the MIDDLE sample, and the
 *     slope is whichever of the two half-slopes is nearest level, or level if
 *     they straddle it. A symmetric crest comes out level, which is right; the
 *     Monte Carlo lip comes out at 0.004, which is also right.
 *   concave here (a dip, a gutter) — it BRIDGES, resting on the two outer
 *     samples, and both the slope and the height come from them.
 *
 * Writes the supporting line's height at the centre to capyPoseSupY, because
 * two return values and no allocation is worth one module-scope scratch.
 */
function capyPoseFit(hB, h0, hF, L) {
  const sB = (h0 - hB) / L, sF = (hF - h0) / L;
  if (sB > sF) {
    capyPoseSupY = h0;
    return sF > 0 ? sF : (sB < 0 ? sB : 0);
  }
  capyPoseSupY = (hB + hF) * 0.5;
  return (sB + sF) * 0.5;
}
let capyLean = 0;                   // the SPEED lean, kept on its own variable
                                    // so the terrain pitch can be added beside
                                    // it rather than damped into it
// ---------------------------------------------------------------------------
// CONTACT, ANTICIPATION, FOLLOW-THROUGH (D2) — and the numbers behind them.
//
// Three faults, all of them invisible in a still and all of them one number:
//
//   CONTACT. `capySTRIDE` was a CONSTANT 0.62 m of ground per half cycle, and
//   the swing amplitude that actually moves the feet is speed-dependent — so
//   the constant was only ever right at a sprint. At 1 m/s the legs produce
//   about 0.18 m of arc and the cadence was being computed as though they
//   produced 0.62, which is three times too slow and about 0.4 m of skate per
//   step. npc.js has derived a person's cadence from their own swing since the
//   crowd got three builds and a child in it; this is that arithmetic brought
//   back to the animal the camera is pointed at.
//
//   ANTICIPATION. Takeoff seeded a positive pop — the comment even said
//   "stretch out of the crouch" and there was no crouch. A negative seed with
//   a positive velocity puts the compression INSIDE the existing k=300 spring:
//   it passes back through zero in about 23 ms and overshoots to the same
//   stretch peak it always had, so the hop gains an anticipation and loses
//   nothing. Nothing about the collider or the arc changes.
//
//   FOLLOW-THROUGH. The lean was `speed * k`, so a stop merely faded and a deck
//   turning under the animal moved a statue. Speed says where the body IS;
//   acceleration says what it is DOING, and it is the second one that reads as
//   weight.
// ---------------------------------------------------------------------------
const capyLEG_R    = 0.30;    // hip pivot to the sole — see capyGeoLeg and the foot
const capyGAIT_MAX = 48;      // rad/s. The old 34 was a ceiling under the old
                              // stride; the derived one asks for 42 at a sprint.
const capyGAIT_MIN_STRIDE = 0.02;   // paMove's floor, for paMove's reason
const capyHOP_CROUCH = -0.26; // the anticipation dip: 10 % of the body height
const capyHOP_VEL    = 8.0;   // ...and the kick out of it. MEASURED at 120 Hz
                              // rather than solved: the spring is damped (zeta
                              // 0.26), so the peak is about 72 % of the
                              // undamped amplitude and the closed form is a
                              // third too generous. 8.0 puts the stretch peak
                              // at 0.35, which is where takeoff always had it.
const capyHOP_POP    = 0.30;  // an in-progress stretch this big or bigger wins
const capyACCEL_CLAMP = 25;   // m/s^2 — a contact spike is not an acceleration
const capyACCEL_LEAN  = 0.010;
const capyDECK_LEAN   = 0.012;
const capyEAR_LAG_L   = 14;   // how fast the ears catch up with the body
const capyEAR_LAG_K   = 0.030;// rad per m/s of the difference
const capyEAR_LAG_MAX = 0.34;
let capyGaitRate = 0, capySwingAmp = 0, capyStride = 0;
let capySpeedPrev = 0, capyAccelSm = 0, capyLeanTgt = 0;
let capyDeckVX = 0, capyDeckVZ = 0, capyDeckAX = 0, capyDeckAZ = 0;
let capyEarLag = 0;


const capyMouthLocal = new THREE.Vector3();
const capyPosition = new THREE.Vector3(capySPAWN.x, capySPAWN.y, capySPAWN.z);
const capyVelocity = new THREE.Vector3();
// RENDER transform — interpolated + lightly filtered. Never used for gameplay.
const capyRenderPos = new THREE.Vector3(capySPAWN.x, capySPAWN.y, capySPAWN.z);
const capyBackV = new THREE.Vector3();   // scratch for capy.back() — see THE SEATS
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
// `fall` is m/s of descent and is read by props.js to size the dust cloud.
// It is on the payload rather than recomputed there because the only place
// that knows how hard the arrival was is the frame that ended it.
const capyDigPayload = { position: capyPosition, fall: 0 };
// The barge. One object, reused, like every other payload in this file: the
// collide listener can fire several times a second and a fresh literal per
// contact is garbage in the hot path. `rec` is whichever of npc.js's two
// record shapes the collider carried — a cast member or a local — and npc.js
// is the only thing that reads it.
const capyBargePayload = { rec: null, speed: 0, x: 0, z: 0 };
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
// ---- THE LANDING RING (P7) ---------------------------------------------
// A hard arrival threw six particles of dust and shook the camera, and the
// dust is behind the animal by the time you look at it. The ring is the one
// mark that says WHERE — the same argument, and the same instanced mesh, as
// the wheek ring above it. `capyLandRing` is the clock and `capyLandK` is
// how hard it was, so a five-metre drop and a forty-metre one do not draw
// the same circle.
let capyLandRing = 0, capyLandK = 0, capyLandX = 0, capyLandY = 0, capyLandZ = 0;
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
let capyStuckT = 0, capyStuckY = 0, capyStuckLP = 0; // see capySTUCK_T: the under-the-floor stalemate
// THE SLIDE. `capySlideT` is how long this one has run, `capySlideAir` how long
// we have forgiven being off the ground, `capySlideCool` the lockout after one
// ends, and `capySlideW` the 0..1 the pose and the readers are damped on.
let capySliding = false, capySlideT = 0, capySlideAir = 0, capySlideCool = 0, capySlideW = 0;
let capySlideSpray = 0;             // s to the next puff off the belly
// WHAT THE BELLY IS ON, published for the scrape (F3b). capySurfacePitch is a
// handful of rectangle tests and is cheap, but it was written to run on a
// FOOTFALL — seven times a second at a sprint — and the scrape needs it every
// frame, which is an order of magnitude more. So it is sampled on a slow timer
// instead: a slide that crosses from sand onto boardwalk takes far longer than
// capySLIDE_SURF_T to do it, and nothing else can change the answer.
const capySLIDE_SURF_T = 0.2;       // s between samples while sliding
let capySlideSurf = 0.82, capySlideSurfT = 0;
let capyStuckN = 0, capyStuckAge = 9; // consecutive rescues, and s since the last one
let capyPop = 0;
let capyPopVel = 0;
let capyEarTimer = 2;
let capyEarFlick = 0;
let capyBlink = 0;
// ---- THE EARS POINT AT THINGS, AND THE NOSE WORKS (v54) ------------------
// `capyEarTurn` is a SIGNED bearing, -1 (hard left) to +1 (hard right), and
// it decays to zero on its own: an ear that stays cocked is a stuck pose, not
// a reaction. It is set by the npc:* events, which all carry the person the
// noise came from, so the animal turns its ears toward whoever just shouted
// before its head catches up — which is what ears are for and is the only
// part of this animal that can react to something behind it.
//
// `capySniff` is a one-shot 0..1 that pulses the nose pad and flicks the
// whiskers forward. It fires near something worth smelling and on a slow idle
// timer, so a capybara standing still is never completely inert.
let capyEarTurn = 0;
let capySniff = 0, capySniffT = 3;
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
let capyPutN = 0;             // presses armed for a put-down
let capyPutDone = 0;          // ...and the ones that ended in a vessel
let capyPutT = -1;            // >= 0 while the action key is being held for a put-down
let capyPutTgt = null;        // the vessel it was armed against

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
let capyNap    = 0;                 // 0..1 asleep. See THE NAP.
// NOT capyWakeT — that name is already the boat WAKE on the water, twenty
// lines into the swim block, and shadowing it would have silently stopped the
// rings from spawning. The same shape as the B15 name clash that broke a
// feature eleven hundred lines away.
let capyNapWake = 0;                // s since somebody last pressed something
// THE PURR (F4). Fires while the animal is actually sat, not while it is on
// its way down: 0.6 is past the point the pose has committed, so the sound and
// the picture agree. See sfxPurr in systems.js.
const capyPURR_AT = 0.6;
let capyPurrT = 3;                  // s to the next one; rewound on standing up
// ---- THE LOAF -------------------------------------------------------------
// 6.5 s, which is under sysCALM_FULL (8.0) on purpose: the animal sits down a
// beat BEFORE the world goes quiet around it, so the sitting reads as the cause
// of the calm rather than as a second symptom of it.
const capyLOAF_T     = 6.5;    // s of rest before it sits
const capyLOAF_LAM   = 2.2;    // damp lambda settling in; ×6 getting up
const capyLOAF_DROP  = 0.145;  // m the model sinks as the barrel meets the ground
const capyLOAF_PITCH = -0.05;  // rad of nose-up, because the front end goes down
// THE LEG ANGLES IN THE LOAF, RE-DERIVED (R4) AGAINST THE DRAWN GROUND.
// They were -1.05 and 0.85, and qa/r4-pre.js measured what that draws: the
// front feet 0.9 cm under the ground (fine — that is a foot resting on it) and
// THE REAR FEET 14.6 cm UNDER IT, with 13.4 cm of shin under it as well. The
// loaf drops the model 14.5 cm and the rear legs trail back and down into the
// hole it makes. Both angles now put the SOLE on the ground: with the ankle
// below holding the foot level, the sole sits 0.175 m under the hip, and
//     0.295·cos a + 0.03·sin a = 0.15
// solves at -0.837 forward and 1.234 back. See THE LOAF SITS ON ITS HOCKS.
const capyLOAF_LEG_F = -0.837; // front legs folded under, soles down
const capyLOAF_LEG_R = 1.234;  // ...and the rears stretched back onto the hock
const capyLOAF_TUCK_Z = 0.05;  // m the rear hips walk forward, so the feet tuck
// ---- THE NAP (N4) ----------------------------------------------------------
//
// A FOURTH REST TIER ON THE SAME TIMER. The ladder is: settled (capyRestT
// running), the calm (systems.js opens the camera and closes the score), the
// loaf at 6.5 s (it sits down), and now this. Every one of them is a reading of
// the ONE number that says how long this animal has been doing nothing, which
// is why there is no new gate and no new busy list to drift from the old one.
//
// THE SECOND MOST-SHARED FACT about this species is a capybara asleep in a hot
// spring with a tangerine on its head, and the whole reason the word "cozy"
// attaches to it. The game rewarded stillness three times and then stopped:
// past the loaf a player who left it running got the same frame for an hour.
//
// TWENTY SECONDS AFTER IT SITS DOWN, not twenty from cold: the loaf is the
// gesture that says "I have stopped", and the nap is what happens if nobody
// interrupts it. Slow in and quick out on the loaf's own asymmetry, and quicker
// than the loaf both ways — an animal that took four seconds to wake up would
// feel like input lag.
const capyNAP_T     = 26.0;   // s of rest before it is asleep (the loaf is 6.5)
const capyNAP_LAM   = 0.85;   // in; ×9 waking, because a wake is a response
const capyNAP_DROP  = 0.045;  // m more than the loaf: the chin goes down
const capyNAP_HEAD  = 0.34;   // rad the head drops onto the paws
const capyNAP_HZ    = 0.125;  // breath, asleep. Half the loaf's again.
const capyNAP_Y     = 0.023;  // ...and deeper, which is the whole tell
const capyNAP_EAR   = 0.30;   // rad the ears go down and out
const capyNAP_PITCH = -0.02;  // rad on top of the loaf's nose-up
// s the nap is held off by a key press. Long enough that a player tapping
// through a card cannot watch the animal doze between presses, short enough
// that putting the controller down goes straight back to the mode.
const capyNAP_WAKE  = 2.5;

// ---------------------------------------------------------------------------
// BREATH, SETTLE AND TAIL (R5) - THE THREE THINGS AN ANIMAL DOES WHEN IT IS
// DOING NOTHING.
//
// THE BREATH MOVED NODE (R2 left it on the hull and said so). It is one term
// in the writer that already owns the body's scale, rather than a second
// writer on a child of it, and that is not tidiness: capySquash's origin is
// the FOOT PLANE (capyModel puts the soles at y = 0), so a scale there is a
// scale about the ground. The feet cannot leave it, the whole outline moves,
// and the head and the back rise together the way a ribcage makes them.
// On the hull it was about the belly line and only the barrel moved.
//
// Rates are Hz here and integrated as rad/s below, because the RATE CHANGES
// (idle act 4 slows it, the loaf slows it further) and sin(t * rate) with a
// moving rate is a phase jump the size of the session. See capyBreathPh.
const capyBREATH_HZ      = 0.28;   // at rest on its feet
const capyBREATH_HZ_LOAF = 0.20;   // ...and slower once it has sat down
const capyBREATH_Y       = 0.010;  // of the animal's height, on the y scale
const capyBREATH_Y_LOAF  = 0.016;  // ...deeper in the loaf, which is the point
const capyBREATH_X       = 0.006;  // a chest goes up more than it goes out
// m/s of gait at which the breath is fully gone. The old gate was the binary
// `moving` (0.35 m/s), which is a step; this is the (1 - speed) the hand-off
// asked for, normalised, so it fades out over the first stride instead.
const capyBREATH_STILL   = 1.20;
let capyBreath = 0;                 // published on animAudit

// THE SETTLE. Not a second trigger on the landing: it is a LAGGED FOLLOWER of
// the absorb spring the model already runs, which is what makes it arrive
// after that spring bottoms out rather than with it (measured: 86 ms after).
// Its own variable, added to head.rotation.x: capyHeadPitch belongs to the
// gaze and the pose, and a nod written there would be fought by the damp on
// the next frame.
//
// THE GAIN IS AGAINST THE LANDING THE PLAYER ACTUALLY MAKES. capyLand's clamp
// is -0.30 m, and 0.20 rad/m off that clamp is the hand-off's 0.06 rad, but a
// plain hop from standing only takes the spring to -0.09: measured, that gain
// draws a nod of 0.6 degrees, which is nothing on the one landing this game
// makes a hundred times an hour. 0.60 rad/m puts the ordinary hop AT 0.06 rad
// AT 0.06 rad DRAWN, which is not the same as 0.06 rad asked for: this is a
// LAGGED follower and a lambda-9 filter never reaches a target that is gone in
// 80 ms. Measured, 0.60 rad/m draws 0.033 and 1.10 draws the 0.06. The cap is
// on the TARGET and keeps a forty-metre arrival from snapping the head down.
const capyNOD_K   = 1.10;
const capyNOD_MAX = 0.16;   // rad
const capyNOD_LAM = 9;
let capyHeadNod = 0;

// THE TAIL. 0.7 Hz of sway on the same rest weight as the breath, and a flick
// on the wheek. See the pivot in the rig: a 5 cm sphere centred on itself
// cannot be flicked at all.
const capyTAIL_HZ    = 0.7;
const capyTAIL_SWAY  = 0.05;   // rad
const capyTAIL_KICK  = 0.25;   // rad, on the wheek
const capyTAIL_LAM   = 6;      // ...decaying at
let capyTailFlick = 0;
let capyTail = 0;              // published on animAudit
let capyWakeT = 0;
let capyBreathAmt = 0;
let capyStageTime = 0;
let capyPlatVX = 0, capyPlatVZ = 0, capyPlatT = 0;   // the frame the floor is moving in
// ...and the BODY that floor is. Held across a hop for the same reason the
// frame is: a capybara half a metre above a ferry's deck is still on the ferry,
// and the camera must not spend the hop cutting its boom against the wheelhouse.
let capyRideBody = null, capyRideT = 0;
const capyRIDE_HOLD = 1.20;         // s of no contact before the deck is let go
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

// ===========================================================================
// WHAT THE PLACES TAUGHT YOU — nine skills, and they TRAVEL.
// ===========================================================================
// Ten chapters hand over a costume (see THE WARDROBE); the other nine hand over
// a MOVE. The costume is the chapter's joke and stays in it; a skill is a thing
// the animal learned and keeps, which is the rule this codebase already holds
// for the dive and the climb — a verb is a property of the world, and the
// chapter that teaches it is not the only chapter that affords it.
//
// That is also what makes the back half of the journey feel different from the
// front: by Hanoi you have Andean lungs, Kyoto's feet, Cali's ear, Iceland's
// edges, Marrakech's wall-kick, the Drift's glide, Kowloon's reach, a herd, and
// right of way. None of it is a number on a screen.
//
// THREE OF THEM WIDEN THE REACH ENVELOPE ON PURPOSE — the vault, the seed and
// the mantle — and that is the point of them. The other six do not touch it at
// all, and NOTHING here changes the jump apex: eighteen chapters of geometry
// are sized against 1.37 m, and see the long note in the hop for why that is
// the worst regression this game can have. The vault is a NEW launch, not a
// bigger one; the seed only ever slows a descent and can never gain height;
// the mantle only finishes a reach that was already within a hop of the ledge.
//
// systems.js owns which are on (`sysSKILLS`) and writes them here every frame.
// Unknown names are ignored rather than added, so a renamed task goes quiet.
const capySkill = {
  lungs: false,     // ch2  Pasto      — altitude: deeper wind, quicker recovery
  quiet: false,     // ch4  Kyoto      — soft feet: the world takes longer to mind
  beat: false,      // ch5  Cali       — on the two: a step on the beat carries
  carve: false,     // ch7  Iceland    — steering authority on ground that slides
  vault: false,     // ch8  Marrakech  — one kick off a wall per airtime
  seed: false,      // ch9  the Drift  — hold the hop key falling and you drift
  mantle: false,    // ch11 Kowloon    — catch the ledge you just missed
  herd: false,      // ch15 Pantanal   — wheek and they fall in behind you
  float: false,     // ch15 Pantanal   — ...and the loaf works on water
  flow: false,      // ch19 Hanoi      — hold a line and the world gives way
};
// ---- the vault ----
const capyVAULT_V     = 5.4;        // m/s of rise off the wall (0.9 of a hop)
const capyVAULT_PUSH  = 4.2;        // m/s away from the face
const capyVAULT_MINY  = -7.5;       // no kick once you are falling faster than this
let capyVaultUsed = false;          // one per airtime, spent until the feet land
// ---- the seed ----
const capySEED_V      = -1.85;      // m/s of descent while drifting
const capySEED_LAM    = 9.0;        // how fast the flare brings the fall to it
const capySEED_FLARE  = 0.40;       // s of easing before the rate is simply assigned
const capySEED_CTRL   = 0.62;       // air control while drifting (vs capyAIR_CONTROL)
const capySEED_ARM    = 0.22;       // s of falling before the key means "drift"
let capySeedT = 0;                  // s the drift has been open
// ---- the mantle ----
const capyMANTLE_UP   = 0.62;       // m above the feet a lip may be and still be caught
const capyMANTLE_DOWN = -0.30;      // ...and below, for a lip you are already level with
const capyMANTLE_V    = 4.4;        // m/s of pull-up
const capyMANTLE_FWD  = 2.6;        // m/s over the lip once you are up
const capyMANTLE_COOL = 0.45;       // s before another one, so it cannot ladder
let capyMantleT = 0;                // s of pull-up left to run
let capyMantleCool = 0;
// ---- on the two ----
const capyBEAT_WIN    = 0.16;       // beats either side of the one that counts
const capyBEAT_PUSH   = 2.35;       // m/s along the travel, horizontal only
let capyBeatFlash = 0;              // 0..1, render-only: the animal answers
// ---- the flow ----
const capyFLOW_V      = 1.5;        // m/s below which you are not going anywhere
const capyFLOW_TURN   = 1.15;       // rad of accumulated wobble that breaks it
const capyFLOW_LAM    = 0.9;        // per second the wobble bleeds off
let capyFlowDither = 0;
let capyFlowYawWas = 0;
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
// ---- THE CLIMB HAS A POSE NOW (D8) ---------------------------------------
// `capyClingT` was declared "for the pose" in v31 and never read by anything,
// and the pose a clinging animal got was THE AIR TUCK — because clinging sets
// grounded = false, and the tuck is what not-grounded means everywhere else in
// this file. So the one verb in the game that is about holding on to a wall
// was drawn as the one thing that is definitely not touching anything.
//
// Same shape as capyAirPose and blended on top of it, because they are two
// answers to the same question and the wall's is the right one: a cross-fade
// rather than a branch, so a hold that flickers at the top of a lattice cannot
// snap the legs.
let capyClimbPose = 0;              // 0..1 render blend into the climb
const capyCLIMB_LAM   = 12;         // how fast the pose commits. ~0.25 s.
const capyCLIMB_RATE  = 3.6;        // rad/s of the reach cycle, both diagonals
const capyCLIMB_PITCH = 0.85;       // rad of nose-up. 49 deg: belly to the wall.
const capyCLIMB_F     = -1.02;      // front legs, reached up the face
const capyCLIMB_R     = 0.34;       // ...and rears, trailing under
const capyCLIMB_SWING = 0.40;       // rad of reach either side of those
const capyCLIMB_SPLAY_F = 0.30;     // rad of elbow-out, which is what makes it
const capyCLIMB_SPLAY_R = 0.18;     // read as GRIPPING rather than as standing
// ---- ...AND THE CARRY HAS THREE OF THEM (D8) -----------------------------
// `carried` used to mean one thing: fourteen radians a second of four-legged
// flail, for ever. It is correct for the two seconds a Sydney gardener has
// hold of you and wrong for both of the other carriers in this game — the
// condor, which has you in its talons for up to a minute, and Palawan's manta,
// which you are RIDING. A capybara pedalling the air on the back of a manta
// ray is the tell that this branch never knew who was holding it.
//
// So a carrier publishes `hold` and this reads it. See capyCarryHold.
let capyCarryT = 0;                 // s in the current carry
let capyCarrier = null;             // ...and who by, to notice a change
let capyHangSway = 0;               // the slow swing under the talons
let capyCarryPh = 0;                // the flail's OWN phase — see AND THE FLAIL
const capyHANG_FLAIL = 1.2;         // s of kicking before it gives up
const capyHANG_LAM   = 1.9;         // ...and how fast it settles after that
const capyHANG_F     = 0.34;        // trailing legs: fronts forward of vertical
const capyHANG_R     = -0.26;       // ...rears behind it
const capyHANG_SWAY  = 0.13;        // rad of body roll, at 0.31 Hz
const capyRIDE_LEG   = 0.62;        // gripping a manta: legs out and braced
const capyRIDE_SPLAY = 0.34;
// ---- THE FACE (D8) --------------------------------------------------------
// The crowd got one in P5 and the star did not: one static brow box, and a
// stack of authored state — the whiffed reach, the refused hop, the wheek, the
// loaf and the fall — drawn nowhere above the neck.
//
// Same law as npcFace, and deliberately the same numbers, because a capybara
// and a tourist being surprised by the same thing should be surprised by the
// same amount. What is NOT shared is the function: the crowd has one eye node
// and a fringe, this has two beads in two rotated sockets, and forcing one
// routine to draw both would be four branches in a per-frame path for the sake
// of not writing twelve lines twice. (Same argument localsChat makes.)
let capyMood = 0;                   // -1 cross/sleepy .. +1 wide-eyed
const capyEYE_WIDE  = 1.55;         // how much taller a wide eye is
const capyEYE_SHUT  = 0.12;         // ...and how flat a shut one is
const capyBROW_UP   = 0.030;        // m the brow lifts when the eyes go wide
const capyBROW_DN   = 0.016;        // ...and drops when they narrow
const capyBROW_TILT = 0.40;         // rad of inner-end-down at full cross
const capyBROW_LIFT = 0.17;         // ...and of inner-end-up at full surprise
// ASYMMETRIC, and it is the whole of why a mood reads as a reaction: 15 into
// it (about 70 ms) and 3.2 out of it (about 300 ms). A symmetric filter makes
// every expression a slow swell, which reads as the animal thinking rather
// than as the animal being startled.
const capyMOOD_IN   = 15;
const capyMOOD_OUT  = 3.2;
// ---- THE ONE THING THE FACE HAS AN OPINION ABOUT (F2) ---------------------
// See the face block in the tick. 1.2 s is a beat and not a state: long enough
// to land under a bubble that is 1.7 s at its shortest, short enough that a
// square full of chases does not pin the face open. Under the wheek's 0.85 on
// purpose — this is the animal noticing what it has done, not doing it.
const capyMOOD_SMUG = 0.60;
const capySMUG_DUR  = 1.2;         // s
let capySmugT = 0;
const capyBLINK_DUR = 0.11;         // s, and it is a TRIANGLE — see capyFacePose
// PHOTOGRAPHED AT SEVEN TIMES, WHICH IS THE ONLY WAY TO SITE A 7 CM BAR.
// 0.064 sits them on the crest of the brow ridge, level with the ear roots;
// 0.050 overlaps the eye, which is a 9 cm bead. 0.060 clears its top edge and
// still lands inside the brow mass (which spans 0.05..0.19 and is the shelf a
// brow belongs on). qa/crop.cjs exists because of this decision.
const capyBROW_Y    = 0.060;        // m above the eye bead, at rest
let capyLand = 0, capyLandVel = 0;  // the landing absorb spring (render only)
// ---- THE FOOT PLANTS (L3, E2) ---------------------------------------------
// The gait was a pendulum: legs[i].rotation.x = sin(phase) * amp, stance and
// swing the same arc, so the foot never planted and never lifted — at nine
// metres it read as windscreen wipers. A walking leg is two things: a STANCE,
// the slow sixty per cent where the sole is on the ground and the leg sweeps
// back linearly as the body goes over it, and a SWING, the fast forty where
// the foot comes off, the shin shortens and the toes trail. capyGait writes
// the angle and publishes the lift per leg; the shin is shortened about the
// hip by scaling the leg group, which is what lifts the foot. The bob peaks at
// mid-stance now, not mid-swing. See capyGait.
const capyGAIT_STANCE = 0.60;   // share of the cycle the foot is down
const capyGAIT_SHIN = 0.16;     // how much the shin shortens at the top of the swing
const capyGAIT_TOE = 0.42;      // rad the toes trail at the top of the swing
const capyLegLift = [0, 0, 0, 0];
/** The leg angle for a cycle fraction u (0..1), amplitude amp; writes lift. */
function capyGait(u, amp, i) {
  if (u < capyGAIT_STANCE) {
    capyLegLift[i] = 0;
    return amp * (1 - 2 * (u / capyGAIT_STANCE));            // +amp -> -amp, linear
  }
  const s = (u - capyGAIT_STANCE) / (1 - capyGAIT_STANCE);   // 0..1 through the swing
  capyLegLift[i] = Math.sin(s * Math.PI);
  return -amp * Math.cos(s * Math.PI);                       // -amp -> +amp, smooth
}
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
 * WHERE TO PUT AN ANIMAL THAT IS UNDER THE FLOOR, given that straight up is
 * usually back inside the thing that put it there.
 *
 * Popping it to terrainHeight and nothing else turns a permanent bury into a
 * half-second cycle — up, pushed down, up — which is not a fix, it is a
 * flicker. Most biomes publish navBlocked() off their own static boxes (see
 * makeSolidIndex), and that is exactly the question being asked here: is there
 * room to stand. Ring search outward, nearest first, and fall back to straight
 * up for the chapters that do not answer, where straight up is still better
 * than staying under the pavement.
 *
 * AND navBlocked IS NOT THE WHOLE QUESTION. makeSolidIndex deliberately reports
 * a box whose top is within solidRISE of the ground as NOT blocked — "a kerb, a
 * deck, a road: walk on it" — which is right for navigation and useless here,
 * because the thing that most often has an animal underneath it is exactly a
 * deck. Measured in Manly and the Sahara: the ring search said the spot was
 * clear, the rescue put the animal straight back under the same floor, and the
 * whole thing became a cycle instead of a fix.
 *
 * So `n` is the number of times this has already fired without the animal
 * getting free, and it drives a spiral: golden angle so successive attempts
 * never repeat a heading, radius growing about a metre a go. A pocket that
 * navBlocked cannot see is escaped by walking out of it, and two seconds is the
 * worst case anywhere.
 *
 * Writes into `out`. Deliberately coarse: eight headings and four radii is
 * thirty-two calls, once, on a frame that has already gone wrong.
 */
function capyFreeSpot(game, x, z, n, out) {
  out.x = x; out.z = z;
  if (n > 0) {
    // nothing the biome can see is wrong here, and yet here we are again
    const th = n * 2.399963;                    // golden angle
    const r = Math.min(1.4 + n * 1.1, 6.5);
    out.x = x + Math.cos(th) * r;
    out.z = z + Math.sin(th) * r;
    return out;
  }
  const api = capyBiomeApi(game);
  if (!api || typeof api.navBlocked !== 'function') return out;
  try {
    if (!api.navBlocked(x, z, capyR)) return out;
    for (let ri = 1; ri <= 4; ri++) {
      const r = ri * 1.4;
      for (let a = 0; a < 8; a++) {
        const th = a * Math.PI / 4;
        const nx = x + Math.cos(th) * r, nz = z + Math.sin(th) * r;
        if (api.navBlocked(nx, nz, capyR)) continue;
        out.x = nx; out.z = nz;
        return out;
      }
    }
  } catch (e) { /* a biome that throws gets the straight-up rescue */ }
  return out;
}
const capyFreeXZ = { x: 0, z: 0 };

/**
 * IS THERE A LID OVER THIS ANIMAL? The one thing that separates being wedged
 * under a building from standing on ground the terrain law disagrees with.
 *
 * Both look identical to every cheaper test, and this was measured rather than
 * guessed (qa/px-stuck.js). Under the Pasto plaza the animal has THREE upward
 * static contacts on every frame, `grounded` is true throughout, and a downward
 * ray finds floor at its feet — while it sits 0.49-0.75 m under the analytic
 * terrain, walking around beneath the cobbles. So a contact test says "fine", a
 * downward ray says "fine", and both would switch off the rescue that case
 * exists for. On the Uji bank the animal is ALSO standing on a real collider
 * with the law well above it, and there the same signals are telling the truth.
 *
 * The difference is overhead: a plaza has a slab over it and a riverbank has
 * sky. One upward ray, and only ever cast on the frames the law already thinks
 * we are under the floor, so it costs nothing the rest of the time.
 *
 * Skips the ground itself (heightfield and plane), triggers, anything dynamic,
 * and people — walking under someone is not being trapped.
 */
const capyLidFrom = new CANNON.Vec3(), capyLidTo = new CANNON.Vec3();
const capyLidOpts = { skipBackfaces: false };
let capyLidGot = false, capyLidSelf = null;
function capyLidRayHit(res) {
  if (!res.hasHit || capyLidGot) return;
  const b = res.body;
  if (!b || b.mass > 0 || b.isTrigger || b === capyLidSelf) return;
  if (b.type !== undefined && CANNON.Body && b.type !== CANNON.Body.STATIC) return;
  if (b.userData && (b.userData.npc || b.userData.local)) return;
  const t = res.shape && res.shape.type;
  if (t === capySHAPE_HEIGHTFIELD || t === capySHAPE_PLANE) return;
  capyLidGot = true;
}
function capyLidAbove(game, body, reach) {
  const w = game.world;
  if (!w || typeof w.raycastAll !== 'function') return false;
  capyLidGot = false; capyLidSelf = body;
  capyLidFrom.set(body.position.x, body.position.y + 0.05, body.position.z);
  capyLidTo.set(body.position.x, body.position.y + reach, body.position.z);
  try { w.raycastAll(capyLidFrom, capyLidTo, capyLidOpts, capyLidRayHit); }
  catch (e) { return false; }
  return capyLidGot;
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
 *
 * THE THIRD ARGUMENT IS WHOSE DEPTH IT IS (X8). Manly's bore is a surface
 * thing and an animal that is UNDER it gets almost none of the push — but that
 * has to be asked as "how deep is the body being pushed", not read off the
 * player from inside the chapter, because props.js calls the same hook for
 * every floating prop on that beach. See manFlowAt.
 */
const capyFlowOut = { x: 0, z: 0 };
function capyFlowAt(game, x, z) {
  capyFlowOut.x = 0; capyFlowOut.z = 0;
  const api = capyBiomeApi(game);
  if (!api || typeof api.flow !== 'function') return capyFlowOut;
  const capy = game && game.capy;
  const f = api.flow(x, z, capy ? (capy.depth || 0) : 0);
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
 * declared `localWater: true`, and this asked `waterHeightAt(x, z)` instead.
 *
 * ---- AND THE FLAG IS GONE (X8) -------------------------------------------
 * The gate was the bug. Four chapters that never set it — Kyoto, Monte Carlo,
 * Circular Quay and Cali — have a waterHeightAt that differs from their
 * waterLevel by up to 63 cm, so the animal solved against a datum the props
 * floating beside it were not using. Kyoto had already worked around it by
 * rewriting its own published waterLevel every frame. One resolver now, in
 * shared.js, with no flag in it: see waterYAt.
 *
 * Built exactly the way slip, wind, the current, the climb and the dive were
 * built: the solve stays here, and a chapter with no swell answers its own
 * waterLevel from waterHeightAt, so the two paths are identical to the last
 * decimal. Everything that already reads this — the swim threshold,
 * the float target, the clamber ceiling, the wake rings — becomes correct on a
 * wave for free, because all five were already expressed as offsets from
 * "wherever the water is" rather than as world heights.
 */
function capyWaterY(env, x, z) {
  return waterYAt(env, x, z, -0.5);
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
// MEASURED against the fall speeds this animal actually reaches: a step off
// a kerb is under 3, a bench is about 4.5, the dust threshold is 5.5, and a
// forty-metre arrival is past 25. 3.2 puts a ring under anything that felt
// like a drop and under nothing that felt like a step.
const capyLAND_RING_V = 3.2;        // m/s of descent that earns a ring
const capyLAND_RING_RATE = 4.2;     // 1/s — about a quarter of a second
const capyGAZE_SPEAK  = 14;         // m — how far off a line still turns the head
const capySNIFF_R     = 2.6;        // m — close enough that a smell is the reason
const capySNIFF_DUR   = 0.34;       // s — a sniff, not a yawn
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
  // 1b. SOMEBODY IS TALKING. This outranks a loose bottle, and it is the
  //    entry that was missing: the list below answers "who has NOTICED me",
  //    which is a different question from "who is speaking" and gets the
  //    wrong person whenever a shopkeeper says something from behind a
  //    counter without being startled by anything. npcSpeaker() is already
  //    gated on the live biome, so this needs no gate of its own.
  if (typeof game.npcSpeaker === 'function') {
    const sp = game.npcSpeaker();
    if (sp) {
      const dx = sp.x - hx, dz = sp.z - hz;
      if (dx * dx + dz * dz < capyGAZE_SPEAK * capyGAZE_SPEAK) {
        tx = sp.x; ty = sp.y + capyGAZE_EYE_H; tz = sp.z; found = true;
      }
    }
  }
  // 2. SOMETHING YOU COULD PICK UP. The grab path already asks this question.
  const ph = game.physics;
  // ...and only if nobody is speaking. Without this guard the entry above is
  // written and then overwritten on the same call, which is a priority list
  // that has no priority in it.
  if (!found && ph && typeof ph.nearestGrabbable === 'function') {
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

/**
 * A part cut from the BODY'S OWN TABLE (R2) — the animal itself, and both of
 * the two costume shells that have to stay proud of it. `dw` / `dTop` / `dBot`
 * are the margin: out, up, and up from underneath. Always at the hull's pivot,
 * so a shell and the body it covers share one origin and cannot drift.
 */
function capyHullPart(parent, material, rows, dw, dTop, dBot) {
  const m = new THREE.Mesh(capyHullGeo(rows, dw, dTop, dBot), material);
  m.position.set(capyHULL_PIVOT[0], capyHULL_PIVOT[1], capyHULL_PIVOT[2]);
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
  //   mFur   = capy       -> the hull, the head, the muzzle, the brow, cheeks
  //   mBelly = capyLight  -> belly underside ONLY
  //   mDark  = capyDark   -> legs, jaw, ears, tail
  //   mNose / mEye        -> tiny accents (mouth interior, brows, eyes)
  // THE SIX THAT MAKE THE SILHOUETTE TAKE THE ANIMAL'S OWN RIM (P1). matSelf is
  // mat() with the rim's uniforms swapped for the capybara's pair — same
  // program, different numbers — because the scenery's rim is tuned to sculpt
  // the scenery and the animal's job is to be findable against it. Measured, the
  // silhouette is 4.5 levels of grey against Cali's lawn. See sysSELF.
  //
  // The two accents stay on mat(): the nose pad and the eyes are interior
  // detail a centimetre across, they are never on the outline, and a private
  // material each would be two more clones for nothing.
  //
  // ALL SIX CARRY THE COAT (R1), and all six have to: the soak swaps a mesh
  // from its dry material to its wet twin, and a twin without `vertexColors`
  // would drop the gradient the moment the animal got in the water — while a
  // twin WITH it and a mesh without the attribute would render black. The
  // pairing is the invariant, not the individual flag. `_rimWants` is true for
  // this option set, so the animal keeps its own rim; and these are built, not
  // cloned, because a clone loses the rim hook.
  const mFur = matSelf(PALETTE.capy, { vertexColors: true });
  const mFurWet = matSelf(PALETTE.capyDark, { vertexColors: true });
  const mBelly = matSelf(PALETTE.capyLight, { vertexColors: true });
  const mBellyWet = matSelf(PALETTE.capy, { vertexColors: true });
  const mDark = matSelf(PALETTE.capyDark, { vertexColors: true });
  const mDarkWet = matSelf(PALETTE.capyNose, { vertexColors: true });
  const mNose = mat(PALETTE.capyNose);
  const mEye = mat(PALETTE.capyEye);
  // ...AND A SEVENTH, FOR THE NOSE PAD ALONE (R3). The note above says the two
  // accents stay on `mat()` because they are never on the outline, and for the
  // eyes that is still true. It was wrong about the pad, and measurably so: the
  // rim is a Fresnel on the normal, not a thing that happens at the silhouette,
  // and 73% of the old pad's pixel was rim added on top of its albedo — off the
  // SCENERY's rim, which is not tuned for a 9 cm feature on the subject. Same
  // program as the other six (same cache key, `vertexColors` and all), so this
  // is a uniform change and not a draw call. Deliberately NOT in `capyFurMats`:
  // the pad carries its own authored colours and the coat must not paint over
  // them. See capyPadGeo.
  const mNosePad = matSelf(PALETTE.capyNose, { vertexColors: true });
  // The set the coat pass finds its meshes by. See capyPaintCoat, note 4.
  const capyFurMats = new Set([mFur, mFurWet, mBelly, mBellyWet, mDark, mDarkWet]);
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

  // --- the body: ONE hull (R2) ----------------------------------------
  // What used to be five meshes here and four more at the legs. See THE HULL.
  // Positioned at the table's pivot rather than the origin, because the idle
  // breath scales this node and a chest expands upward from the belly line, not
  // symmetrically about the middle of the animal and down into the floor.
  const hull = new THREE.Mesh(capyHullGeo(capyHULL, 0, 0, 0), mFur);
  hull.name = 'capyHull';   // named for the probes; nothing in src reads it
  hull.position.set(capyHULL_PIVOT[0], capyHULL_PIVOT[1], capyHULL_PIVOT[2]);
  hull.castShadow = true;
  capySquash.add(hull);
  wetParts.push({ m: hull, dry: mFur, wet: mFurWet });
  // the ONLY capyLight on the animal: the belly underside. Narrow enough that
  // it emerges as a low band along the underside instead of a mottled patch.
  const belly = capyAddPart(capySquash, capyGeoBlob, mBelly, 0, 0.245, -0.04, 0.245, 0.105, 0.30);
  wetParts.push({ m: belly, dry: mBelly, wet: mBellyWet });
  // THE TAIL HAS A PIVOT NOW (R5), and it needs one before it can have a
  // writer: this nub is a 5 cm sphere that was centred on itself, and rotating
  // a sphere about its own centre moves nothing but which way its facets face.
  //
  // THE PIVOT IS INSIDE THE BODY, which is where a tail's root joint is and
  // also the only place it can be and still show. On the rear cap the arm is
  // 3.9 cm and the hand-off's 0.25 rad moves the nub 9.7 mm, which is nothing;
  // at z -0.50, inside the hull (whose section there runs y 0.32 to 0.65), the
  // arm is 11.7 cm and the same 0.25 rad moves it 29 mm. The nub's own
  // position in the animal is unchanged either way: 0.520 - 0.020 and
  // -0.500 - 0.115.
  const tailPivot = new THREE.Group();
  tailPivot.position.set(0, 0.520, -0.500);
  capySquash.add(tailPivot);
  const tail = capyAddPart(tailPivot, capyGeoBlob, mDark, 0, -0.020, -0.115, 0.050, 0.055, 0.045);

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

  // blunt bevelled muzzle, 90% of skull width — the single biggest species
  // tell, and the same 0.325 x 0.20 x 0.26 footprint it has always had. See
  // capyMuzzleGeo for what the three chamfers are and which one is structural.
  const snout = new THREE.Mesh(
    capyMuzzleGeo(0.325, 0.20, 0.26, 0.035, 0.025, 0.035), mFur);
  snout.name = 'capyMuzzle';
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
  // THE PROFILE, in the pad's own space (the pivot is INSIDE the muzzle, at
  // head 0, 0.02, 0.34, so the sniff swells the pad outward from under the skin
  // instead of sliding a slab off the face). Rows are [y, z, sRGB multiplier]:
  // down the muzzle's front face, round the 30 degree chamfer, back along the
  // top — and then the two inner points that close it against the muzzle.
  //
  // The multiplier is the answer to the up-facing surfaces taking the sun
  // square on: the run over the top is 0.70, the chamfer 0.88, the front 1.00.
  const nosePad = new THREE.Mesh(capyPadGeo([
    [-0.045, 0.166, 1.00],   // the front face, bottom of the pad
    [0.005, 0.166, 1.00],    // ...up to just under the chamfer
    [0.020, 0.163, 0.88],    // onto the chamfer
    [0.0402, 0.128, 0.72],   // ...and over its top edge
    [0.041, 0.086, 0.70],    // back along the top face
    [0.034, 0.086, 0.70],    // inner: on the top face
    [-0.045, 0.159, 1.00]    // inner: on the front face
  ], 0.064), mNosePad);
  nosePad.name = 'capyPad';
  nosePad.position.set(0, 0.02, 0.34);
  nosePad.castShadow = true;
  head.add(nosePad);
  // TWO NOSTRIL PRICKS, AND THEY ARE ON TOP (R3). They were on the front face,
  // which is the one place a capybara's are not: the nostrils sit on the top
  // surface with the eyes and the ears in the same plane above them, which is
  // why an animal that is swimming shows those three things and nothing else.
  // It is also the read the game actually gets — the resting lens looks DOWN.
  capyAddPart(head, capyGeoBead, mEye, 0.036, 0.062, 0.445, 0.018, 0.010, 0.014);
  capyAddPart(head, capyGeoBead, mEye, -0.036, 0.062, 0.445, 0.018, 0.010, 0.014);

  // EYES — dark beads set into the outer-front corners of the brow, angled
  // outward-and-forward so BOTH catch the light from a three-quarter front
  // view instead of hiding on a side plane, and far enough forward that the
  // shoulder can never be mistaken for one.
  const eyeSockL = new THREE.Group();
  eyeSockL.position.set(0.128, 0.128, 0.265);
  eyeSockL.rotation.y = 0.62;
  head.add(eyeSockL);
  // 8x6, not the 6x4 bead (R3). At the contract's cap and no further, and the
  // reason is the catchlight below rather than the eye itself: a 6x4 sphere's
  // top band is FOUR facets, so a highlight put on the upper front of it lands
  // on one facet and switches between two as the head turns. It is also the one
  // part of this animal the lens is on at every arrival.
  const eyeL = capyAddPart(eyeSockL, capyGeoBlob, mEye, 0, 0, 0.056, 0.046, 0.050, 0.042);
  // A catchlight is not fur. It borrows mBelly for the value and must not
  // borrow the coat with it, or the palest thing on the animal picks up the
  // throat's lift and stops reading as a highlight.
  //
  // MOVED, not enlarged (R3). The roadmap asked for 0.42 of the eye, up on its
  // front-upper shoulder. The direction was the good half of that and the size
  // was not: at 0.42 a 6x4 bead is a visible polyhedron standing a quarter of
  // the eye's radius off it, and it renders as a pale SPIKE between the brow
  // and the eye instead of a highlight on one. So: the same 0.30 and the same
  // 6% of protrusion the old one had, swung round onto the upper front where
  // the resting lens can see it. The old highlight was visible from the front
  // and from nowhere else, and the front is not where this game is played.
  capyAddPart(eyeL, capyGeoBead, mBelly, 0.135, 0.452, 0.597, 0.30, 0.30, 0.30)
    .userData.coat = { flat: true };
  const eyeSockR = new THREE.Group();
  eyeSockR.position.set(-0.128, 0.128, 0.265);
  eyeSockR.rotation.y = -0.62;
  head.add(eyeSockR);
  const eyeR = capyAddPart(eyeSockR, capyGeoBlob, mEye, 0, 0, 0.056, 0.046, 0.050, 0.042);
  capyAddPart(eyeR, capyGeoBead, mBelly, -0.135, 0.452, 0.597, 0.30, 0.30, 0.30)
    .userData.coat = { flat: true };

  // THE CHEEK (R3). One small mass under and behind each eye, and it does two
  // things a bigger change could not. It gives the eye a LOWER EDGE to sit on —
  // a bead on a flat plane is a dot, a bead on a ledge is an eye — and in
  // profile it breaks what was a dead straight line from the ear to the end of
  // the muzzle into a skull and a snout, which is the shape of a head.
  const cheekL = capyAddPart(head, capyGeoBlob, mFur, 0.150, 0.045, 0.235, 0.048, 0.050, 0.090);
  const cheekR = capyAddPart(head, capyGeoBlob, mFur, -0.150, 0.045, 0.235, 0.048, 0.050, 0.090);
  wetParts.push({ m: cheekL, dry: mFur, wet: mFurWet });
  wetParts.push({ m: cheekR, dry: mFur, wet: mFurWet });

  // ---- BROWS (D8) ---------------------------------------------------------
  // Two bars, one per eye, IN THE SOCKETS — so each one inherits its eye's
  // outward yaw for free and is over that eye from every angle, which two bars
  // parented to the skull are not once the head turns.
  //
  // A capybara does not have eyebrows and this is not an attempt at one: it is
  // the same 5 cm nose cube decision the crowd's faces are built on. At the six
  // metres this game is played at the ONLY channels above the neck that read
  // are the eye's aperture and a dark bar's angle, and the bar has to be big
  // enough to be a bar. 7.4 cm long on a 37 cm skull.
  //
  // `capyBROW_Y` is the rest height and lives here because the node being moved
  // cannot also be the thing that remembers where it started — npcFace's own
  // note, and the reason its `f` carries `browY`.
  const browL = capyAddPart(eyeSockL, capyGeoBead, mNose, 0, capyBROW_Y, 0.058,
                            0.074, 0.019, 0.030);
  const browR = capyAddPart(eyeSockR, capyGeoBead, mNose, 0, capyBROW_Y, 0.058,
                            0.074, 0.019, 0.030);
  /**
   * THE ONE WRITER ON THE EYES AND THE BROWS. See THE FACE.
   *
   * `mood` is -1..1 and `blink` is 0..1 closed. Called from exactly two places
   * — the main pose and the helm pose — because two functions writing one
   * scale is the trap this repo has paid for twice already, and the helm's
   * answer is simply mood 0.
   *
   * The brows sit in the eye SOCKETS, which are rotated ±0.62 about y and are
   * therefore mirror images of one another: a mirror maps a local rotation
   * about z by +φ to −φ, so the two ends want opposite signs to read
   * symmetrically. Same line npcFace ends on, for a different reason.
   */
  function capyFacePose(mood, blink) {
    const up = mood > 0 ? mood : 0;
    const dn = mood < 0 ? -mood : 0;
    const open = (1 + up * (capyEYE_WIDE - 1)) * (1 - blink * (1 - capyEYE_SHUT));
    // a wide eye is a little wider as well as taller, or it reads as a slot
    const w = 0.046 * (1 + up * 0.16);
    eyeL.scale.set(w, 0.050 * open, 0.042);
    eyeR.scale.set(w, 0.050 * open, 0.042);
    const y = capyBROW_Y + up * capyBROW_UP - dn * capyBROW_DN;
    browL.position.y = y;
    browR.position.y = y;
    const tilt = dn * capyBROW_TILT - up * capyBROW_LIFT;
    browL.rotation.z = -tilt;
    browR.rotation.z = tilt;
  }
  /**
   * A TRIANGLE, NOT A STEP. The blink was a two-state flag — the eye was a flat
   * plate for the whole 110 ms and then a bead again — which at 60 Hz is seven
   * frames of a dead-looking animal and no frames of an eyelid moving. Shut in
   * half the window and open again in the rest, which is what npcBlink has done
   * for the crowd since P5.
   */
  function capyBlinkK() {
    if (capyBlink <= 0) return 0;
    const k = 1 - capyBlink / capyBLINK_DUR;
    return k < 0.5 ? k * 2 : (1 - k) * 2;
  }

  // WHISKERS (v54).
  //
  // The muzzle carried a nose pad, two nostril pricks and nothing else, and it
  // is the part of this animal the camera is pointed at for most of the game.
  //
  // They are DELIBERATELY oversized — 8 mm square and 19 cm long, where a real
  // capybara's are hair. A 2 mm whisker is sub-pixel at the six metres this is
  // played at, and an accurate one would be a thing that exists in the file and
  // nowhere on the screen. Same decision as the 5 cm nose cube on a person.
  //
  // Three a side on a node of their own so they can be swept as a set: the
  // sniff flicks them forward, and the head's own motion is enough to make
  // them read as attached to something alive.
  const whiskL = new THREE.Group();
  whiskL.position.set(0.150, -0.010, 0.430);
  head.add(whiskL);
  const whiskR = new THREE.Group();
  whiskR.position.set(-0.150, -0.010, 0.430);
  head.add(whiskR);
  for (let i = 0; i < 3; i++) {
    // fanned: the top one sweeps up and back, the bottom one down and back
    const pitch = 0.16 - i * 0.19;
    const len = 0.19 - i * 0.022;
    for (const [g, sgn] of [[whiskL, 1], [whiskR, -1]]) {
      // A PIVOT, not a rotated box. The box is built along +x and has to be
      // pushed out by half its length to hang off the muzzle rather than
      // through it — and doing that on the box ITSELF, after rotating it,
      // swings the root end away from the face by the sine of the sweep.
      // Rotate the pivot, offset the box inside it, and the root stays put.
      const pv = new THREE.Object3D();
      pv.position.y = i * 0.012;
      pv.rotation.set(0, sgn * -0.42, sgn * pitch);
      const w = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.008), mDark);
      // 8 mm of stick that happens to wear the fur material. It sits right in
      // the throat's band and would come out pale; a whisker is not a throat.
      w.userData.coat = { flat: true };
      w.position.x = sgn * len * 0.5;
      w.castShadow = false;               // an 8 mm stick is not a shadow
      pv.add(w);
      g.add(pv);
    }
  }

  // ears are a capyDark accent — at this size the dark cup IS the whole ear
  const earL = new THREE.Group();
  earL.position.set(0.135, 0.17, -0.05);
  head.add(earL);
  const earMeshL = capyAddPart(earL, capyGeoBlob, mDark, 0.02, 0.03, 0, 0.072, 0.078, 0.036);
  // The cup. -z is the face the playing camera actually sees from behind and
  // above, and it is the one that never sees the sky either way.
  earMeshL.userData.coat = { nook: [0, 0, -1], to: capyCOAT_EAR };
  wetParts.push({ m: earMeshL, dry: mDark, wet: mDarkWet });
  const earR = new THREE.Group();
  earR.position.set(-0.135, 0.17, -0.05);
  head.add(earR);
  const earMeshR = capyAddPart(earR, capyGeoBlob, mDark, -0.02, 0.03, 0, 0.072, 0.078, 0.036);
  earMeshR.userData.coat = { nook: [0, 0, -1], to: capyCOAT_EAR };
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
  const feet = [];   // R4: the loaf keeps the soles flat, which is an ANKLE
  const legX = [0.15, -0.15, 0.15, -0.15];
  const legZ = [0.28, 0.28, -0.28, -0.28];
  // The four shoulder / hip blobs are GONE (R2): they are inside the hull now,
  // and a ball stuck on the outside of a body to suggest a shoulder is the
  // thing the hull exists to stop. Their crease survives them — it moved into
  // capyCoatAt, where it is a function of position and paints the hull and the
  // belly's corners instead of four spheres. See THE LEG ROOTS.
  for (let i = 0; i < 4; i++) {
    const g = new THREE.Group();
    g.position.set(legX[i], 0.32, legZ[i]);
    capySquash.add(g);
    const shin = capyAddPart(g, capyGeoLeg, mDark, 0, -0.145, 0);
    // Four toes in front and three behind (R4), and the foot is authored at its
    // own size now, so there is no scale on it: a scaled non-uniform box was
    // what made the old nose pad rim as though it were edge on.
    const foot = capyAddPart(g, i < 2 ? capyGeoFootF : capyGeoFootR, mDark,
                             0, -0.295, 0.03);
    // `limb` so the belly's pale band does not run across the middle of a leg;
    // the shin takes the crease at its top, where it goes up under the blob,
    // and the ankle band at its bottom, in the shin's OWN frame — see
    // capyCoatAnkle for why that has to be a tag and not a place on the animal.
    shin.userData.coat = { limb: true, nook: [0, 1, 0],
                           band: { y: -0.145 + capyANKLE_H } };
    foot.userData.coat = { limb: true };
    wetParts.push({ m: shin, dry: mDark, wet: mDarkWet });
    wetParts.push({ m: foot, dry: mDark, wet: mDarkWet });
    legs.push(g);
    feet.push(foot);
  }

  // ---- AND NOW THE COAT GOES ON (R1) --------------------------------------
  // Here, and not inside each part, for note 4's reason: a traverse that finds
  // its meshes by material cannot miss one, and a mesh on a `vertexColors`
  // material with no `color` attribute renders BLACK rather than warning. Run
  // once, at create, over the whole animal in its rest pose — the wardrobe is
  // built below and wears `mat()` materials, so it is correctly skipped.
  const capyCoated = capyPaintCoat(capyModel, capyFurMats);

  // ===================================================================
  // THE WARDROBE — ten costumes, one per chapter that earns one.
  // ===================================================================
  // Chapter 18 asks you to acquire a dinner jacket off a lounger on somebody
  // else's sun deck, and until v39 the only thing that happened when you did
  // was a line of toast — the jacket stayed in your mouth, which is the one
  // place a dinner jacket does not go. That became the first costume, and once
  // there was one there was obviously room for the rest: ten of the nineteen
  // chapters ask you to do something that IMPLIES a piece of kit, and handing
  // it over is the cheapest delight in the game.
  //
  // The rule for what earns one is the same every time: **the task has to be
  // the reason you have the thing.** You stole a tourist's hat, so you are
  // wearing a tourist's hat. You brought the ferry alongside at Manly, so you
  // have the master's cap. You went under in Palawan, so you have a mask on.
  // Nothing here is a badge for finishing a chapter; each is the object the
  // task was about.
  //
  // Five rules, and every one of them was a bug first:
  //
  //  - BUILT ONCE AT CREATE, HIDDEN, never built on demand. A costume
  //    assembled on the frame a task ticks is a hitch in the middle of a
  //    celebration, and one torn down on a chapter change is a leak waiting to
  //    happen. Ten costumes of a dozen boxes cost nothing to carry invisible.
  //  - EVERY COSTUME IS TWO GROUPS: one on `capySquash` and one on `head`.
  //    Put headgear on the body and it leaves the face the moment the animal
  //    looks up; put a jacket on the head and it swims on every hop.
  //  - NOTHING JOINS `wetParts`. The soak swaps a mesh's material for its wet
  //    twin, and a hat with no wet twin comes out of the harbour wearing the
  //    belly's colour.
  //  - ONE AT A TIME. `wear` hides the lot and shows one, so there is no
  //    state to get out of step and no order to get wrong.
  //  - A CAPYBARA HAS NO NECK, and it has ears at head-y 0.12–0.28. The skull
  //    box runs z 0.08–0.58 and the jaw 0.52–0.76, so there is nothing between
  //    the shoulders and the muzzle that is ever on screen — anything meant to
  //    read as a collar goes under the jaw's front, and any brim wide enough to
  //    matter sits BELOW the ear tips so they come through it. A hat that
  //    clears the ears is a hat floating over an animal.
  const capyWardrobe = {};
  function capyCostume(id) {
    const o = { body: new THREE.Group(), head: new THREE.Group() };
    o.body.visible = false;
    o.head.visible = false;
    capySquash.add(o.body);
    head.add(o.head);
    capyWardrobe[id] = o;
    return o;
  }
  /** A brim, a band, a lens: a disc lying flat unless it is turned. */
  function capyDisc(p, m, x, y, z, r, h, rz) {
    const d = capyAddPart(p, capyGeoDisc, m, x, y, z, r, h, r);
    if (rz) d.rotation.x = rz;
    return d;
  }
  /**
   * TWO LENSES ON THE PLANES THE EYES ARE ALREADY ON.
   *
   * The eye sockets are turned outward-and-forward by 0.62 rad each so that
   * both beads catch the light from a three-quarter front view; anything worn
   * over them has to be on the same two planes or it sits across the face like
   * a plank. Copying the sockets' own transform is the only way that stays
   * true if the head is ever re-proportioned.
   */
  function capyEyewear(parent, mLens, mRim, w, h) {
    const socks = [eyeSockL, eyeSockR];
    for (let i = 0; i < 2; i++) {
      const s = i === 0 ? 1 : -1;
      const g = new THREE.Group();
      g.position.copy(socks[i].position);
      g.rotation.y = socks[i].rotation.y;
      parent.add(g);
      capyAddPart(g, capyGeoBox, mLens, 0, 0.008, 0.082, w, h, 0.022);
      capyAddPart(g, capyGeoBox, mRim, 0, 0.008, 0.076, w + 0.013, h + 0.013, 0.014);
      const arm = capyAddPart(g, capyGeoBox, mRim, s * 0.050, 0.012, -0.020,
                              0.012, 0.014, 0.19);
      arm.rotation.y = s * -0.30;
    }
  }

  // ---- ch18 · MONTE CARLO · black tie --------------------------------------
  // The read is a silhouette read, because at four metres that is the only read
  // there is: a shawl collar standing proud of the shoulders, a bow under the
  // jaw and a black bar across the eyes with a brass rim on it.
  {
    const mTux = mat(PALETTE.capyTux);
    const mSatin = mat(PALETTE.capyTuxSatin);
    const mShirt = mat(PALETTE.capyShirt);
    const mBow = mat(PALETTE.capyBowtie);
    const mShade = mat(PALETTE.capyShade);
    const mRim = mat(PALETTE.capyShadeRim);
    const o = capyCostume('black-tie');
    // the jacket: a shell over the body, 1.5 cm proud of it on every axis
    // except the front, where it stops short so the animal's own chest is what
    // the collar opens onto — and except underneath, where it is raised 3.2 cm,
    // because a jacket that wraps the belly is a onesie.
    //
    // IT IS THE HULL'S OWN SHAPE (R2), inflated. It was an ellipsoid fitted by
    // hand to the barrel, and an ellipsoid peaks in the middle where this animal
    // now peaks over the hips: the hull came 11 cm through the back of it. A
    // shell cut from the body's own table cannot go out of date that way.
    capyHullPart(o.body, mTux, capyHullFit(0.30, -0.30), 0.015, 0.015, 0.032);
    // ...and the skirt of it over the rump, standing proud of the jacket so the
    // step reads. Deliberately SHORT of the tail: a jacket that reaches it is a
    // horse blanket.
    capyHullPart(o.body, mTux, capyHullFit(-0.26, -0.52), 0.030, 0.028, 0.055);
    // THE LAPELS MOVED UP 18 cm, AND HAD TO (R2). They sat at y 0.455, which
    // was 2.6 cm proud of the old barrel and clear of the old jacket ellipsoid
    // entirely — the collar hanging in the opening. The hull is 11 cm taller at
    // the shoulder than the barrel was, on purpose, so both lapels ended up
    // INSIDE the animal: measured at 6 and 0 changed pixels across six bearings
    // (qa/wear-parts.js). That probe is the only reason this was caught; a
    // costume that is drawn and invisible costs exactly what a visible one does.
    // ...AND THEN THEY BECAME ONE COLLAR (R6), which is the same lesson Rio
    // already wrote down: "a RING round the base of the skull, not two slabs on
    // the shoulders: the first version was a pair of boxes and from three-
    // quarter front they read as one gold shard sticking out of the animal side".
    // Four satin boxes on a black jacket read as four pale FLECKS, and the
    // render is the only place that shows it - qa/wear-parts.js says all four
    // are drawing, which is a different question from whether they read.
    //
    // One annulus with the front left open, so the collar opens onto the chest
    // the way the shell below already stops short for. Tilted so it follows the
    // shoulder line: a horizontal ring on an animal whose back rises toward the
    // hips is buried at the back and floating at the front.
    const COLLAR_GAP = 1.30;
    const collar = new THREE.Mesh(
      capyBandGeo(0.168, 0.272, 0.055, 8,
                  Math.PI * 0.5 + COLLAR_GAP * 0.5,
                  Math.PI * 0.5 - COLLAR_GAP * 0.5 + Math.PI * 2), mSatin);
    collar.position.set(0, 0.688, 0.165);
    collar.rotation.x = -Math.PI * 0.5 - 0.26;
    collar.castShadow = true;
    o.body.add(collar);
    // a pocket square, because a capybara in a dinner jacket is a joke and a
    // joke needs a detail nobody asked for
    capyAddPart(o.body, capyGeoBox, mShirt, 0.290, 0.648, 0.020, 0.050, 0.028, 0.012);
    // the wing collar: a BAND and not a bib — it exists so the black bow in
    // front of it has something to be black against
    capyAddPart(o.head, capyGeoBox, mShirt, 0, -0.248, 0.342, 0.160, 0.052, 0.092);
    capyAddPart(o.head, capyGeoBox, mBow, 0, -0.266, 0.398, 0.056, 0.056, 0.046);
    for (let s = -1; s <= 1; s += 2) {
      const wing = capyAddPart(o.head, capyGeoBox, mBow, s * 0.073, -0.266, 0.394,
                               0.086, 0.074, 0.038);
      wing.rotation.z = s * 0.36;
    }
    capyAddPart(o.head, capyGeoBox, mRim, 0, 0.140, 0.325, 0.10, 0.030, 0.030);
    capyEyewear(o.head, mShade, mRim, 0.115, 0.085);
  }

  // ---- ch1 · SYDNEY · the stolen sun hat -----------------------------------
  // The first thing this game ever asks of you is to take a hat off a tourist,
  // and the keepsake for the chapter is that hat. It is worn ASKEW, because a
  // hat a rodent has taken off a person is not a hat that fits.
  {
    const mStraw = mat(PALETTE.capyStraw);
    const mStrawDk = mat(PALETTE.capyStrawDk);
    const mBand = mat(PALETTE.capyHatBand);
    const o = capyCostume('sunhat');
    const g = new THREE.Group();
    g.position.set(0, 0.185, 0.05);
    g.rotation.z = 0.15;
    g.rotation.x = -0.10;
    o.head.add(g);
    capyDisc(g, mStraw, 0, 0.02, 0, 0.300, 0.030);         // the brim
    capyDisc(g, mStrawDk, 0, 0.008, 0, 0.305, 0.012);      // its underside shade
    capyAddPart(g, capyGeoDome, mStraw, 0, 0.03, 0, 0.150, 0.135, 0.150);
    capyDisc(g, mBand, 0, 0.062, 0, 0.158, 0.042);         // the ribbon
  }

  // ---- ch3 · CIRCULAR QUAY · the master's cap ------------------------------
  // You took the helm, you found the heads, you put her alongside at Manly.
  // Nobody gives a capybara a ferry; a capybara that has driven one gets a cap.
  {
    const mNavy = mat(PALETTE.capyNavy);
    const mPeak = mat(PALETTE.capyPeak);
    const mGold = mat(PALETTE.capyGold);
    const o = capyCostume('ferrycap');
    const g = new THREE.Group();
    g.position.set(0, 0.175, 0.02);
    o.head.add(g);
    capyAddPart(g, capyGeoDome, mNavy, 0, 0.030, 0, 0.180, 0.120, 0.195);
    capyDisc(g, mNavy, 0, 0.145, 0, 0.181, 0.030);
    capyDisc(g, mPeak, 0, 0.032, 0, 0.187, 0.040);          // the band
    const peak = capyAddPart(g, capyGeoBox, mPeak, 0, 0.030, 0.230, 0.235, 0.028, 0.150);
    peak.rotation.x = -0.24;
    capyAddPart(g, capyGeoBox, mGold, 0, 0.070, 0.180, 0.070, 0.048, 0.020);
  }

  // ---- ch6 · RIO · the parade plumes ---------------------------------------
  // Samba down the avenue on the two and the avenue puts a headdress on you.
  // Seven feathers in three colours, on their own pivots so the fan spreads
  // from a point behind the ears rather than from the middle of each feather.
  {
    const PLUME = [mat(PALETTE.capyPlumeA), mat(PALETTE.capyPlumeB), mat(PALETTE.capyPlumeC)];
    const mSeq = mat(PALETTE.capyGold);
    const o = capyCostume('plumes');
    for (let i = 0; i < 7; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, 0.130, -0.130);
      piv.rotation.z = (i - 3) * 0.245;
      piv.rotation.x = -0.40;
      o.head.add(piv);
      const m = PLUME[i % 3];
      const len = 0.30 + (3 - Math.abs(i - 3)) * 0.035;
      capyAddPart(piv, capyGeoBox, m, 0, len * 0.5, 0, 0.048, len, 0.018);
      capyAddPart(piv, capyGeoBead, m, 0, len + 0.010, 0, 0.032, 0.048, 0.016);
    }
    capyDisc(o.head, mSeq, 0, 0.150, -0.110, 0.115, 0.045);  // the mount
    // and a sequinned collar, which is what stops the plumes reading as
    // something that has landed on the animal. A RING round the base of the
    // skull, not two slabs on the shoulders: the first version was a pair of
    // boxes at s * 0.215 and from three-quarter front they read as one gold
    // shard sticking out of the animal's side.
    capyDisc(o.body, mSeq, 0, 0.548, 0.150, 0.245, 0.048);
  }

  // ---- ch10 · VENICE · the gondolier's boater ------------------------------
  // Ride the prow of a gondola standing up and you have effectively applied for
  // the job. Flat crown, wide flat brim, red band — and the neckerchief, which
  // is the half of the outfit people actually picture.
  {
    const mStraw = mat(PALETTE.capyStraw);
    const mStrawDk = mat(PALETTE.capyStrawDk);
    const mRib = mat(PALETTE.capyRibbon);
    const o = capyCostume('boater');
    const g = new THREE.Group();
    g.position.set(0, 0.190, 0.04);
    o.head.add(g);
    capyDisc(g, mStraw, 0, 0.020, 0, 0.272, 0.028);
    capyDisc(g, mStrawDk, 0, 0.006, 0, 0.276, 0.012);
    capyDisc(g, mStraw, 0, 0.075, 0, 0.152, 0.090);          // the flat crown
    capyDisc(g, mStrawDk, 0, 0.122, 0, 0.155, 0.016);
    capyDisc(g, mRib, 0, 0.048, 0, 0.159, 0.036);
    // the neckerchief, under the jaw where the tux's collar goes
    capyAddPart(o.head, capyGeoBox, mRib, 0, -0.246, 0.336, 0.168, 0.056, 0.096);
    capyAddPart(o.head, capyGeoBox, mRib, 0, -0.276, 0.392, 0.070, 0.062, 0.044);
  }

  // ---- ch12 · PALAWAN · mask and snorkel -----------------------------------
  // `first-dive` is the moment the game hands over a verb it then keeps for
  // ever, and this is the only costume in the set that is equipment rather than
  // uniform. The snorkel is on the LEFT and it is bent, because a straight tube
  // sticking out of a rodent's head is an antenna.
  {
    const mRub = mat(PALETTE.capyRubber);
    const mLens = mat(PALETTE.capyLens, { transparent: true, opacity: 0.82 });
    const mSnk = mat(PALETTE.capySnorkel);
    const o = capyCostume('snorkel');
    // the strap, right round the skull
    capyAddPart(o.head, capyGeoBox, mRub, 0, 0.120, 0.040, 0.398, 0.052, 0.400);
    // the skirt of the mask, over both eyes and the top of the muzzle
    capyAddPart(o.head, capyGeoBox, mRub, 0, 0.120, 0.300, 0.345, 0.150, 0.110);
    for (let s = -1; s <= 1; s += 2) {
      capyAddPart(o.head, capyGeoBox, mLens, s * 0.088, 0.126, 0.358, 0.120, 0.095, 0.020);
    }
    const piv = new THREE.Group();
    piv.position.set(0.190, 0.060, 0.140);
    piv.rotation.z = -0.14;
    o.head.add(piv);
    capyAddPart(piv, capyGeoBox, mSnk, 0, 0.170, 0, 0.042, 0.340, 0.042);
    const bend = capyAddPart(piv, capyGeoBox, mSnk, -0.020, -0.010, 0.075, 0.040, 0.040, 0.140);
    bend.rotation.x = 0.34;
  }

  // ---- ch13 · CAPPADOCIA · the pilot's cap ---------------------------------
  // Be up there when the sun clears the rim. Leather cap, ear flaps, and the
  // goggles PUSHED UP ON THE BROW rather than over the eyes — a pilot wears
  // them up, and up is also the only place they do not fight the animal's own.
  {
    const mLea = mat(PALETTE.capyLeather);
    const mLeaDk = mat(PALETTE.capyLeatherDk);
    const mAmb = mat(PALETTE.capyAmber, { transparent: true, opacity: 0.85 });
    const mFleece = mat(PALETTE.capyFur);
    const mBrass = mat(PALETTE.capyShadeRim);
    const o = capyCostume('flycap');
    capyAddPart(o.head, capyGeoDome, mLea, 0, 0.170, 0.010, 0.200, 0.150, 0.215);
    // THE SHEARLING IS WHAT MAKES IT A CAP AND NOT A SHADOW. A dark leather
    // dome on a brown animal in Cappadocian light is invisible; the cream edge
    // round the face and down the flaps is the whole read at any distance.
    capyDisc(o.head, mFleece, 0, 0.176, 0.010, 0.212, 0.046);
    for (let s = -1; s <= 1; s += 2) {
      const flap = capyAddPart(o.head, capyGeoBox, mLea, s * 0.194, 0.055, 0.020,
                               0.046, 0.185, 0.180);
      flap.rotation.z = s * 0.10;
      const trim = capyAddPart(o.head, capyGeoBox, mFleece, s * 0.196, -0.042, 0.020,
                               0.056, 0.050, 0.190);
      trim.rotation.z = s * 0.10;
    }
    capyAddPart(o.head, capyGeoBox, mLeaDk, 0, 0.244, 0.176, 0.330, 0.076, 0.062);
    for (let s = -1; s <= 1; s += 2) {
      capyDisc(o.head, mBrass, s * 0.090, 0.248, 0.200, 0.076, 0.020, Math.PI * 0.5);
      capyDisc(o.head, mAmb, s * 0.090, 0.248, 0.214, 0.064, 0.022, Math.PI * 0.5);
    }
    // the scarf, and it is the whole reason this reads as flying
    for (let i = 0; i < 3; i++) {
      const sc = capyAddPart(o.body, capyGeoBox, mat(PALETTE.capyShirt),
                             0.030 * i, 0.500 - i * 0.030, -0.150 - i * 0.140,
                             0.110 - i * 0.020, 0.055, 0.150);
      sc.rotation.y = i * 0.20;
    }
  }

  // ---- ch14 · MANLY · the surf cap -----------------------------------------
  // Take the biggest of the set all the way to the sand and the club gives you
  // the cap. Red and yellow in quarters, and a strap under the jaw, which is
  // the only part of it that says SWIM rather than HAT.
  {
    const mRed = mat(PALETTE.capyLifeRed);
    const mYel = mat(PALETTE.capyLifeYel);
    const o = capyCostume('surfcap');
    capyAddPart(o.head, capyGeoDome, mRed, 0, 0.166, 0.020, 0.190, 0.120, 0.205);
    // the yellow quarters: one band fore-and-aft over the crown, standing a
    // millimetre proud so it does not z-fight the shell it sits on
    capyAddPart(o.head, capyGeoBox, mYel, 0, 0.238, 0.020, 0.100, 0.118, 0.404);
    capyAddPart(o.head, capyGeoBox, mRed, 0, 0.166, 0.020, 0.394, 0.030, 0.418);
    for (let s = -1; s <= 1; s += 2) {
      const str = capyAddPart(o.head, capyGeoBox, mYel, s * 0.176, 0.020, 0.070,
                              0.026, 0.230, 0.030);
      str.rotation.z = s * 0.12;
    }
    capyAddPart(o.head, capyGeoBox, mYel, 0, -0.112, 0.120, 0.330, 0.028, 0.032);
  }

  // ---- ch16 · SON DOONG · the caver's helmet -------------------------------
  // Stand in the light inside the mountain. The lamp is the point: it is the
  // one piece of the wardrobe with an EMISSIVE on it, because a lamp that is
  // shaded like everything else is a white box, and this chapter is the only
  // place in the game dark enough for the difference to matter.
  {
    const mShell = mat(PALETTE.capyHelmet);
    const mShellDk = mat(PALETTE.capyHelmetDk);
    const mLamp = mat(PALETTE.capyLampOn, { emissive: PALETTE.capyLampOn,
                                            emissiveIntensity: 1 });
    const o = capyCostume('cavehelm');
    capyAddPart(o.head, capyGeoDome, mShell, 0, 0.168, 0.020, 0.205, 0.140, 0.220);
    capyAddPart(o.head, capyGeoBox, mShell, 0, 0.176, 0.225, 0.240, 0.036, 0.100);
    capyAddPart(o.head, capyGeoBox, mShellDk, 0, 0.230, 0.020, 0.055, 0.075, 0.420);
    capyAddPart(o.head, capyGeoBox, mShellDk, 0, 0.222, 0.238, 0.100, 0.078, 0.062);
    capyDisc(o.head, mLamp, 0, 0.222, 0.276, 0.042, 0.024, Math.PI * 0.5);
    for (let s = -1; s <= 1; s += 2) {
      const str = capyAddPart(o.head, capyGeoBox, mShellDk, s * 0.190, 0.030, 0.060,
                              0.022, 0.200, 0.028);
      str.rotation.z = s * 0.10;
    }
  }

  // ---- ch17 · ANTARCTICA · the expedition hood -----------------------------
  // Run with the pod, and the bottom of the world lends you a coat. The RUFF is
  // the whole costume — a band round the face opening with four beads on it
  // (R6; it was eleven beads and no band), which is the one shape that says
  // parka from any angle including behind, and the
  // only piece of the wardrobe that frames the animal's face rather than
  // covering part of it.
  {
    const mPk = mat(PALETTE.capyParka);
    const mPkDk = mat(PALETTE.capyParkaDk);
    const mFur = mat(PALETTE.capyFur);
    const o = capyCostume('parka');
    // Same two shells as the dinner jacket and 3 mm fatter, because a parka is
    // a parka. Cut from the hull's table for the same reason. See THE HULL.
    capyHullPart(o.body, mPk, capyHullFit(0.30, -0.30), 0.018, 0.018, 0.030);
    capyHullPart(o.body, mPk, capyHullFit(-0.26, -0.52), 0.033, 0.031, 0.055);
    // the yoke seam across the shoulders. It is 3 cm PROUD of the parka rather
    // than 0.560 wide and inside it, which is what it was: a 56 cm bar on a
    // 67 cm shell, buried, drawn in every Antarctic frame and visible in none.
    capyAddPart(o.body, capyGeoBox, mPkDk, 0, 0.706, 0.010, 0.400, 0.050, 0.210);
    // the hood shell, behind and over the skull
    capyAddPart(o.head, capyGeoBlob, mPk, 0, 0.040, -0.120, 0.250, 0.245, 0.230);
    // ...and the ruff, on a ring about the face. SYMMETRIC, with the gap at the
    // bottom where the jaw is: an arc that simply stops after 86% of a circle
    // leaves a bald quarter on one side and the hood looks knocked askew.
    //
    // IT IS ONE BAND NOW (R6). It was eleven beads laid round that arc, which
    // is ELEVEN DRAW CALLS and 396 triangles to say "there is fur round the
    // hood"; the band says it in one call and 68, over exactly the same arc,
    // at the same radius, keeping the same gap. The two beads that remain are
    // its cut ends, where a real ruff bunches because that is where it stops.
    const GAP = 0.95;                       // radians of ring left open, at the jaw
    const A0 = -Math.PI * 0.5 + GAP * 0.5, A1 = A0 + (Math.PI * 2 - GAP);
    const ruff = new THREE.Mesh(capyBandGeo(0.207, 0.269, 0.075, 8, A0, A1), mFur);
    ruff.position.set(0, 0.040, 0.090);
    ruff.castShadow = true;
    o.head.add(ruff);
    // FOUR BEADS, NOT THE TWO THE HAND-OFF ASKED FOR, and the render is why.
    // A band alone is a smooth rim and reads as moulded plastic; the eleven
    // beads it replaced read as fur because their outline was LUMPY. Two at the
    // cut ends leave the top of the arc smooth, which is the half of it the
    // player sees. Four is five meshes against eleven and keeps the outline.
    for (const k of [0, 0.30, 0.70, 1]) {
      const a = A0 + (A1 - A0) * k;
      capyAddPart(o.head, capyGeoBead, mFur,
                  Math.cos(a) * 0.238, 0.040 + Math.sin(a) * 0.238, 0.090,
                  0.076, 0.076, 0.082);
    }
  }

  // ---- and the one verb -----------------------------------------------------
  let capyWorn = null;
  function capyWear(id) {
    const next = (id && capyWardrobe[id]) ? id : null;
    if (next === capyWorn) return;
    for (const k in capyWardrobe) {
      const on = k === next;
      capyWardrobe[k].body.visible = on;
      capyWardrobe[k].head.visible = on;
    }
    capyWorn = next;
  }

  // --- fx: splash rings, one InstancedMesh (three instances, one draw) --
  const capyRingMesh = new THREE.InstancedMesh(
    capyGeoRing,
    mat(PALETTE.foam, { side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }),
    // +2: the wheek's ring and the landing's. Two more matrix writes on a
    // mesh that is already drawn, which is the whole reason both of them
    // live here rather than being meshes of their own.
    capyRING_COUNT + 2
  );
  capyRingMesh.frustumCulled = false;
  capyRingMesh.castShadow = false;
  capyRingMesh.receiveShadow = false;
  capyRingQ.set(0, 0, 0, 1);
  capyRingP.set(0, -999, 0);
  capyRingS.set(0.0001, 0.0001, 0.0001);
  capyRingM4.compose(capyRingP, capyRingQ, capyRingS);
  for (let i = 0; i <= capyRING_COUNT + 1; i++) capyRingMesh.setMatrixAt(i, capyRingM4);
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
    // ---- ...AND A PERSON IS NOT A WALL (D3) -------------------------------
    //
    // A walker's collider is mass-0 KINEMATIC and a local's is mass 0, so both
    // of them arrive in the STATIC branch below and get the wall treatment:
    // the same stone thud, the same punch, the same bounce back off a face.
    // Measured, and it is the shape of the finding rather than the absence the
    // roadmap expected — barging somebody was not silent, it was
    // indistinguishable from walking into a building, and the person it
    // happened to did not react at all.
    //
    // In a goose game the barge IS the verb. Three differences from a wall:
    //
    //   IT TAKES LESS SPEED. A wall needs capyBONK_V (3.9 m/s) before it is
    //   worth a noise, because at a walk you are leaning on it. Shouldering
    //   somebody at a walking pace is the entire joke, so the floor is a
    //   third of it.
    //   IT IS SOFTER. Less punch, a lower and quieter voice, and half the
    //   bounce, because a person gives and a wall does not.
    //   IT IS AN EVENT. npc.js answers `npc:barge` — see the handler there.
    const ud = other.userData;
    const who = ud && (ud.npc || ud.local);
    if (who && other.mass === 0) {
      const nv = Math.abs(c.getImpactVelocityAlongNormal());
      if (nv < capyBARGE_V) return;
      if (Math.abs(c.ni.y) > capyBONK_NY) return;
      const nowB = game.state.time;
      if (nowB - capyBonkAt < capyBONK_GAP) return;
      if (capySwimming || capyClinging || capy.carriedBy || capy.atHelm) return;
      capyBonkAt = nowB;
      capyPunch(game, clamp((nv - capyBARGE_V) * 0.018, 0.02, 0.09));
      capySfxAt.volume = clamp(nv * 0.070, 0.14, 0.46);
      capySfxAt.pitch = clamp(0.78 - nv * 0.020, 0.52, 0.78);
      game.sfx('thud', capySfxAt);
      // ...and the animal says something about it (L3, E4)
      capySfxAt.volume = clamp(nv * 0.09, 0.25, 0.6); capySfxAt.pitch = clamp(1.05 - nv * 0.02, 0.85, 1.05);
      game.sfx('grunt', capySfxAt);
      if (capyPop > -0.14) capyPop = -0.14;
      if (capyPopVel > -2.2) capyPopVel = -2.2;
      const bsB = clamp(nv * 0.08, 0.25, 1.1);
      const bsignB = (body === c.bi) ? 1 : -1;
      capyShove.x += c.ni.x * bsB * bsignB;
      capyShove.z += c.ni.z * bsB * bsignB;
      capyEarFlick = 1;
      capyBargePayload.rec = who;
      capyBargePayload.speed = nv;
      capyBargePayload.x = capyPosition.x;
      capyBargePayload.z = capyPosition.z;
      game.events.emit('npc:barge', capyBargePayload);
      return;
    }
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
      game.sfx('thud', capySfxAt);
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

  // ===================================================================
  // THE GHOST — the animal you were, the last time you did this well (v37)
  // ===================================================================
  //
  // Fifty-three tasks in this game carry a number, and the block that draws
  // the live line says what they are for: "records are the only reason to
  // re-enter a finished chapter, so this is the whole of the game's replay
  // surface". The way you beat one was by remembering a figure. This is that
  // figure put back in the world: your own best run, played back beside you,
  // so the question stops being "am I under 42.1" and becomes "am I in front".
  //
  // WHO OWNS WHAT. systems.js owns the trace — it knows when an attempt opens,
  // when it closes, whether it beat anything, and it owns localStorage. This
  // file owns the ANIMAL: the model, its materials and its rest pose are here
  // and nowhere else. Two functions between them, `show` and `hide`, and the
  // ghost never touches the body, the solver or a single number the player is
  // being measured on.
  //
  // ONE MESH, NOT EIGHTEEN. `capyModel` is eighteen parts, and eighteen extra
  // draw calls to draw a thing that is deliberately not detailed is the wrong
  // trade — so the parts are baked ONCE, here, into a single geometry with the
  // rest pose folded into the vertices. It is built at construction and before
  // any frame has run, which is also the only moment the model is in a pose
  // worth freezing: the gait, the loaf, the squash and the idle beats have all
  // not happened yet, so what gets baked is the animal standing.
  //
  // NOT A CLONE OF THE MATERIALS. `mat()` caches by colour and options, so a
  // cloned fur material is either shared with the real animal (and a wetness
  // write would dye the ghost) or a fresh one that misses the cache. It gets
  // ONE material of its own, flat, transparent, unlit by the shadow pass and
  // writing no depth — which is what makes it read as a memory of an animal
  // rather than a second animal.
  const capyGhostMat = mat(PALETTE.capy, {
    transparent: true, opacity: 0.34, depthWrite: false, fog: true,
  });
  let capyGhost = null;

  /**
   * Bake `capyModel`'s parts into one geometry, in model space. Called once.
   * Returns null if anything about the model is not what this expects, because
   * a ghost is a nicety and must never be able to take the animal down.
   */
  function capyBakeGhost() {
    // THE GHOST IS THE ANIMAL, NOT THE OUTFIT. It is baked once, lazily, on the
    // first show and cached for the session — so a bake that happened to land
    // while a costume was on would put that costume on the ghost in all
    // nineteen chapters for the rest of the run. Everything off for the bake,
    // and back in the `finally` so an early return or a throw cannot leave the
    // animal undressed on the deck it just earned the thing on.
    //
    // The `traverse` below tests `o.visible` per mesh, which is NOT enough on
    // its own: a hidden costume's group is invisible while its own meshes are
    // perfectly `visible: true`, and traverse does not stop at an invisible
    // node. Both belts are worn — this one and the parent walk inside the loop.
    const wasWorn = capyWorn;
    capyWear(null);
    try {
      const parts = [];
      capyModel.updateWorldMatrix(true, true);
      const inv = new THREE.Matrix4().copy(capyModel.matrixWorld).invert();
      const m4 = new THREE.Matrix4();
      let verts = 0;
      capyModel.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes ||
            !o.geometry.attributes.position) return;
        // Skip anything hidden at rest — the held-prop sockets and the like.
        // ...AND ANYTHING INSIDE A HIDDEN GROUP. `traverse` does not stop at an
        // invisible node, and the costume's three groups are hidden while their
        // own meshes are perfectly `visible: true` — so an `o.visible` test
        // alone bakes a dinner jacket into every ghost in the game, including
        // the seventeen chapters that have never seen one.
        if (!o.visible) return;
        {
          let q = o.parent, vis = true;
          while (vis && q && q !== capyModel) { vis = q.visible; q = q.parent; }
          if (!vis) return;
        }
        o.updateWorldMatrix(true, false);
        const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        m4.copy(inv).multiply(o.matrixWorld);
        g.applyMatrix4(m4);
        verts += g.attributes.position.count;
        parts.push(g);
      });
      if (!parts.length || verts < 3) return null;
      const pos = new Float32Array(verts * 3);
      const nor = new Float32Array(verts * 3);
      let o3 = 0;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i].attributes.position, n = parts[i].attributes.normal;
        for (let k = 0; k < p.count; k++, o3 += 3) {
          pos[o3] = p.getX(k); pos[o3 + 1] = p.getY(k); pos[o3 + 2] = p.getZ(k);
          if (n) { nor[o3] = n.getX(k); nor[o3 + 1] = n.getY(k); nor[o3 + 2] = n.getZ(k); }
        }
        parts[i].dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, capyGhostMat);
      mesh.name = 'capyGhost';
      // No shadow, either way. A translucent memory that casts a hard shadow is
      // a second animal standing there, which is exactly what it must not be.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = 2;
      mesh.visible = false;
      scene.add(mesh);
      return mesh;
    } catch (e) { return null; } finally {
      capyWear(wasWorn);
    }
  }

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
    nap: 0,                          // 0..1 asleep. The fourth rest tier, and
                                     // the one systems.js turns the camera and
                                     // the score over to. See THE NAP.
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
    // THE VESSEL UNDER YOUR FEET, as a cannon body. `carriedBy` is a biome's
    // api token for "something is flying/swimming me about"; this is the plain
    // physics body of whatever DECK the animal is standing or steering on — a
    // ferry, a raft, a floe, the roof of a bus. Published for one reader:
    // systems.js's camera occlusion ray, which has to know that the thing
    // between the lens and the animal is the floor, not a wall. See sysCamClear.
    rideBody: null,
    atHelm: false,
    // THE SLIDE. Read-only; systems.js draws nothing off it yet and the biomes
    // may. Written every frame by the block that owns it.
    sliding: false,
    climbing: false,                 // hanging off a face — see capyCLIMB_UP
    diving: false,                   // under the surface on purpose — see capyDIVE_V
    depth: 0,                        // metres below the live waterline, 0 on land
    diveTime: 0,                     // s this breath has lasted
    // ---- HOW OFTEN THE TRAVELLING SKILLS HAVE BEEN USED (L3-11) ------
    // The nine skills were earned and no chapter ever asked for one back;
    // the finds that ask (see FINDS, 'brought-vault' and its three siblings)
    // read these. Session counters, like diveTime: a find fires once.
    vaultN: 0, mantleN: 0, seedT: 0,
    threwAt: -1,
    // ---- B10: THE CHARGED THROW (item 4b) ----
    // `charge` is 0..1 while the action key is held with something in the
    // mouth; `aim` is where it would land at that charge, or null. Written
    // by capyPutStep and read by systems.js, which owns the scene overlay and
    // draws the ring. The ballistics live here because the launch vector does.
    charge: 0,
    aim: null,

    /**
     * THE GHOST — see the block above. Two verbs, and systems.js is the only
     * caller: it owns the trace and this file owns the animal.
     *
     *   capy.ghost.show(x, y, z, yaw, a)   put it there, `a` is 0..1 of the
     *                                      material's own opacity (a fade-in)
     *   capy.ghost.hide()                  gone
     *
     * Built on the FIRST show and never before: a player who has no record
     * anywhere never pays for the geometry. Both are safe to call every frame
     * and safe to call when the bake failed — `show` simply does nothing, and
     * the run measures exactly as it did before ghosts existed.
     */
    ghost: {
      show: function (x, y, z, yaw, a) {
        if (!capyGhost) {
          capyGhost = capyBakeGhost();
          if (!capyGhost) { this.show = function () {}; return; }
        }
        capyGhost.position.set(x, y - capyFOOT_Y, z);
        capyGhost.rotation.y = yaw;
        capyGhostMat.opacity = 0.34 * clamp(a === undefined ? 1 : a, 0, 1);
        capyGhost.visible = capyGhostMat.opacity > 0.01;
      },
      hide: function () { if (capyGhost) capyGhost.visible = false; },
      /** Is there one on screen. The harness asks; nothing in src does. */
      on: function () { return !!(capyGhost && capyGhost.visible); },
    },
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
    /**
     * WHERE A PASSENGER SITS. See THE SEATS above and THE PERCH in systems.js.
     *
     * `i` is the seat, 0 at the shoulder and `capy.seats - 1` at the hips;
     * `out` is any object with x/y/z and is returned. World space, feet-on-fur,
     * and it already carries everything the animal is doing: the loaf drop, the
     * breath, the lean, the squash, the render smoothing. That is the whole
     * reason it lives here — every one of those is a local number in this file
     * and a reader outside it would be re-deriving five of them and drifting
     * from all five.
     *
     * Read off the SQUASH node, which is where the breath and the stretch are.
     * The note by capySquash says nothing needing a clean world quaternion may
     * live under it, and nothing here does: this returns a point and never an
     * orientation. A passenger takes its heading from `capy.group.rotation.y`,
     * which is the render yaw and is free; `animAudit()` also reports it and
     * allocates an object doing so, which is fine for a probe and not for a
     * thing three animals ask sixty times a second.
     *
     * Safe before the first frame and safe every frame — one parent-chain
     * matrix update, no children, for at most three calls.
     */
    /**
     * SOMEBODY IS STILL THERE. See THE NAP.
     *
     * `capyBusy` cannot see a key that does not move the animal — a wheek, a
     * grab that finds nothing, opening the journal — and every one of those is
     * a player saying they have not gone away. systems.js owns the keyboard,
     * the pad and the touch layer and calls this from all three; this file owns
     * what waking looks like.
     *
     * It holds the nap OFF for `s` seconds rather than zeroing it, so a run of
     * key presses does not let it creep back between them, and so the animal
     * cannot fall asleep again the instant a player stops typing.
     */
    wake(s) {
      const t = typeof s === 'number' && s === s ? s : capyNAP_WAKE;
      if (t > capyNapWake) capyNapWake = t;
    },
    get seats() { return capySEAT_Z.length; },
    back(i, out) {
      const o = out || {};
      // FRACTIONAL ON PURPOSE. An animal that takes two seats sits at 0.5 or
      // 1.5, between them, and a rounded index would put a heron's feet in the
      // same place as a pigeon's.
      const k = clamp(i || 0, 0, capySEAT_Z.length - 1);
      const a = Math.floor(k), b = Math.min(a + 1, capySEAT_Z.length - 1);
      const z = capySEAT_Z[a] + (capySEAT_Z[b] - capySEAT_Z[a]) * (k - a);
      const st = capyHullAt(z);          // [z, half-width, top y, bottom y]
      capySquash.updateWorldMatrix(true, false);
      capyBackV.set(0, st[2] + capySEAT_H, z).applyMatrix4(capySquash.matrixWorld);
      o.x = capyBackV.x; o.y = capyBackV.y; o.z = capyBackV.z;
      return o;
    },
    climbAt(x, y, z, yaw) {
      const was = capyYaw;
      if (typeof yaw === 'number' && yaw === yaw) capyYaw = yaw;
      const h = capyClimbAt(game, x, y, z, true);
      capyYaw = was;
      return h ? { nx: h.nx, nz: h.nz, top: h.top } : null;
    },
    /**
     * PUT ON ONE OF THE COSTUMES, OR NONE. See THE WARDROBE above.
     *
     * Idempotent, cheap, and safe to call every frame — which is how systems.js
     * calls it, because "which chapter am I in and what have I earnt in it" is
     * a question with an answer on every frame and no event worth trusting: a
     * save restore, a chapter change and a picker jump are three places an
     * event does not fire. A repeat of the costume already on returns after one
     * string compare; a change is at most four `visible` flags.
     *
     * Unknown ids take everything off rather than throwing. A chapter naming a
     * costume that has been renamed should go bare, not crash.
     */
    get worn() { return capyWorn; },
    wear(id) { capyWear(id); },
    /** The v39 name for `wear('black-tie')`. Chapter 18 still calls it. */
    dress(on) { capyWear(on ? 'black-tie' : null); },

    /**
     * WHAT THE PLACES TAUGHT YOU. See capySkill for the nine and the rules.
     *
     * `learn` is systems.js's alone and is written every frame from the task
     * table, for the same reason the wardrobe is: a save restore, a chapter
     * change and a picker jump are three places an event does not fire. It
     * ignores names it does not know rather than adding them, so a renamed
     * task goes quiet instead of creating a skill nothing reads.
     *
     * `can` is for everybody — npc.js asks about `herd`, and a chapter that
     * wants to say something the first time it sees you drift can ask too.
     */
    can(id) { return !!capySkill[id]; },
    learn(id, on) { if (id in capySkill) capySkill[id] = !!on; },
    /** 0..1, render-only: the beat flash, for anything that wants to answer it. */
    get beatFlash() { return capyBeatFlash; },
    /** True while the seed is open — a descent, never a climb. */
    drifting: false,
    /**
     * A STEADY LINE, HELD. See THE FLOW. npc.js reads this to decide whether to
     * step out of the way; it is false for everybody until Hanoi is crossed.
     */
    committed: false,
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
      capyRideBody = null; capyRideT = 0; capy.rideBody = null;
      capyLaunchT = capyLAUNCH_HOLD;
      // ...AND SPEND THE COYOTE WINDOW, which the jump block does and this
      // forgot. `effGround` stays true for capyCOYOTE after the feet leave the
      // floor, and while it is true the idle grip runs at lambda 60 and the
      // snap zeroes anything under 0.9 m/s. So for seven frames after a GROUND
      // launch the horizontal component was being deleted: measured off
      // Strokkur, fire-frame velocity [1.19, 0] -> [0, 0] five frames later,
      // 0.04 m of landing drift from a 2.23 s flight. Everybody came off the
      // geyser going perfectly straight up, which is the exact symptom launch()
      // was written to cure. Vertical always survived because nothing damps it.
      capyAirTime = capyCOYOTE;
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
    /**
     * THE COAT, COUNTED (R1). A test hook; nothing in the game calls it.
     *
     * The failure this exists for is silent in both directions. A coat that
     * never ran is an animal that looks exactly like the one before it, and a
     * mesh that took `vertexColors` without an attribute renders BLACK — so
     * `painted` (how many meshes carry a coat) and `bare` (how many wear a fur
     * material and do NOT) are the two halves of the same question. `bare`
     * must be 0. `range` is the darkest and palest multiplier actually written,
     * which is what tells a probe the gradient has a span rather than being one
     * flat number applied everywhere.
     */
    coatAudit: function () {
      let painted = 0, bare = 0, lo = 9, hi = 0;
      capyModel.traverse(function (o) {
        if (!o.isMesh || !o.geometry || !capyFurMats.has(o.material)) return;
        const c = o.geometry.attributes.color;
        if (!c) { bare++; return; }
        painted++;
        for (let i = 0; i < c.count; i++) {
          const v = (c.getX(i) + c.getY(i) + c.getZ(i)) / 3;
          if (v < lo) lo = v;
          if (v > hi) hi = v;
        }
      });
      // THE SOAK'S HALF OF IT, which no picture of a dry animal can show. The
      // swap sets `mesh.material` and never touches the geometry, so the coat
      // survives getting wet if and ONLY if every twin also carries
      // `vertexColors` — and a twin without it would not merely lose the
      // gradient, it would ignore an attribute the mesh is still handing it.
      // Reported per material rather than sampled from one, because the pairing
      // is the invariant.
      const mats = [], rims = [];
      for (const m of capyFurMats) {
        mats.push(m.vertexColors === true);
        rims.push(!!(m.userData && m.userData.capySelf));
      }
      return { painted, bare, built: capyCoated, range: [lo, hi],
               vertexColors: mats.every(Boolean), selfRim: rims.every(Boolean),
               mats: mats.length };
    },
    /**
     * EVERY NUMBER THE RIG IS POSED FROM, in one read. A test hook, like
     * forceHeat and faceAudit — nothing in the game calls it.
     *
     * It exists because the three faults D2 fixes are all invisible from
     * outside: a foot that skates is a cadence that disagrees with a stride, a
     * hop with no anticipation is a spring that never went negative, and a lean
     * that is speed rather than acceleration looks identical in a still. Each
     * one is two of these numbers put next to each other, sampled fast.
     *
     * `stride` is the metres of ground ONE half cycle of the legs is worth at
     * the current swing — so `speed / (stride * gaitRate / PI)` is 1.000 when
     * the feet are locked to the ground and anything else is skate.
     */
    /**
     * B9. Two counts, because a put-down is invisible from outside: a press
     * that armed and then came out as a throw and a press that was never a
     * put-down at all look identical in the world, and the difference is the
     * whole of what item 4a bought. `armed` counts presses that found a vessel
     * to aim at; `done` counts the ones that ended with something in it.
     */
    putAudit: function () {
      return { armed: capyPutN, done: capyPutDone, holdT: capyPutT,
               target: capyPutTgt ? capyPutTgt.type : null };
    },
    animAudit: function () {
      return { speed: capySpeedSm, legPhase: capyLegPhase, gaitRate: capyGaitRate,
               // THE FOOT PLANTS (L3, E2): the swing lift per leg, and the shin
               legLift: capyLegLift.slice(), shin0: legs[0].scale.y,
               swingAmp: capySwingAmp, stride: capyStride,
               pop: capyPop, popVel: capyPopVel,
               lean: capyLean, leanTarget: capyLeanTgt, accel: capyAccelSm,
               land: capyLand, airPose: capyAirPose, earLag: capyEarLag,
               // ---- R5 ----
               // The three channels breath and weight added. Every one is a
               // fraction of a centimetre in a still and none of them can be
               // read off a screenshot: see qa/r5-body.js.
               breath: capyBreath, tail: capyTail, headNod: capyHeadNod,
               grounded: capy.grounded, vy: body.velocity.y,
               // ---- D8 ----
               // The five channels area 2's second half added, and every one of
               // them is invisible in a still: a climb pose and an air tuck are
               // the same silhouette for the first tenth of a second, a hang
               // and a flail are the same silhouette between kicks, and a mood
               // is 70 ms wide. See qa/d8-body.js.
               climbing: capyClinging, climbPose: capyClimbPose, clingT: capyClingT,
               carry: !!capy.carriedBy,
               hold: (capy.carriedBy && capy.carriedBy.hold) || '',
               carryT: capyCarryT, hangSway: capyHangSway,
               mood: capyMood, blink: capyBlinkK(),
               // ---- N4 ----
               // THE NAP is four small numbers on four channels that already
               // existed, and every one of them is invisible in a description:
               // "the head goes down" is 19 degrees, "the ears go out" is 17,
               // and "it breathes more slowly" is a rate nothing on screen
               // states. A pose nobody can measure is a pose nobody can defend.
               nap: capyNap, loaf: capyLoaf,
               headX: head.rotation.x, earZ: earR.rotation.z,
               modelY: capyModel.position.y, eyeOpen: eyeR.scale.y,
               // Which way it is POINTING. Published because frameShot takes a
               // bearing from the animal to the camera, so a probe that wants
               // to look at the face needs this and there was no way to get it.
               yaw: capyYaw,
               legX: [legs[0].rotation.x, legs[1].rotation.x,
                      legs[2].rotation.x, legs[3].rotation.x],
               pitch: capyModel.rotation.x, roll: capyModel.rotation.z };
    },
    update: capyUpdate,
  };
  game.capy = capy;

  // ears snap on the beat the gardener shouts
  /**
   * WHICH WAY THE NOISE CAME FROM (v54).
   *
   * Every npc:* event carries the person it happened to, so the bearing is
   * free. It is resolved into the animal's own frame and stored signed, which
   * is the only form the ear pose can use — and it is why this cannot simply
   * reuse the gaze: the gaze has a 100-degree cone and refuses to answer for
   * anything behind you, which is exactly the case an ear is for.
   *
   * `soft` events (somebody calming down) get a smaller turn than a shout.
   */
  function capyHeardFrom(p, k) {
    capyEarFlick = 1;
    capyEarTimer = rand(1.4, 3.0);
    // THE PAYLOAD IS { npc: rec }, not the rec. npc.js wraps every one of
    // these in emit(), and the existing npc:chase listener took the argument
    // as the person and then used none of it — so the shape was never wrong
    // until something read it. Unwrapped defensively: some callers pass a
    // bare position and there is no reason to make them all agree.
    const rec = (p && p.npc) || p;
    const g = rec && (rec.group ? rec.group.position : rec.position);
    if (!g || !(g.x === g.x)) return;
    const dx = g.x - capyPosition.x, dz = g.z - capyPosition.z;
    if (dx * dx + dz * dz > 900) return;          // 30 m: out of earshot
    const local = capyWrapAngle(Math.atan2(dx, dz) - capyYaw);
    // sin, not the angle: it saturates at ninety degrees and comes back for
    // anything behind, which is right — an ear cannot point further round than
    // side-on, and a noise directly astern turns both ears equally, not one.
    const want = Math.sin(local) * k;
    if (Math.abs(want) > Math.abs(capyEarTurn)) capyEarTurn = want;
  }
  game.events.on('npc:chase', function (rec) { capyHeardFrom(rec, 1); capySmugT = capySMUG_DUR; });
  game.events.on('npc:startled', function (rec) { capyHeardFrom(rec, 0.85); });
  game.events.on('npc:calm', function (rec) { capyHeardFrom(rec, 0.35); });
  // ...and the face answers the two events that mean the mischief landed. The
  // ears already answer all three above; this is deliberately only the two.
  // See capyMOOD_SMUG.
  game.events.on('capy:incident', function () { capySmugT = capySMUG_DUR; });
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
    capyNap = 0; capy.nap = 0; capyNapWake = 0;      // ...and THE NAP (N4)
    capyLaunchT = 0;
    capyPlatVX = 0; capyPlatVZ = 0; capyPlatT = 0;
    capyRideBody = null; capyRideT = 0; capy.rideBody = null;
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
  // Over this much `game.state.chaos` the wheek is a keyed-up one. Half, and
  // deliberately: chaos decays on its own, so a number much higher than this
  // would only ever be reached during a chase — which is the state the loud
  // row is FOR, but not the only one that earns it.
  const capyWHEEK_KEYED = 0.5;

  function capyWheek() {
    // POP, not a swell: jump the squash value instantly so the stretch is
    // already at 1.25 on the very next frame, then let the spring ring it out.
    capyPop = capyPop > 0.65 ? capyPop : 0.65;
    capyPopVel = 9;
    capyWheekHold = 0.42;
    capyEarFlick = 1;
    capyTailFlick = 1;
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
    // the only thing state touches here is the voice itself, because nothing
    // outside this module owns that. (It said "softness" and meant it: until
    // F4 there were two variants and systems.js's `capy:wheek` handler ate
    // both of them inside sfxGap. See the note on that handler.)
    //
    // ---- FOUR THINGS ONE MOUTH CAN SAY (F4) ----------------------------
    // ONE call, one options object, and the state picks the row. The order is
    // a priority and it is physical, not editorial:
    //
    //  1. BLOWN wins outright. `capyStamBlown` means there is no air left —
    //     the animal cannot produce a full wheek whatever else is going on,
    //     and it is the one row that is a fact about the body rather than a
    //     mood. Down a whole tone and thin.
    //  2. KEYED next. Chaos is the game's own measure of how much is going
    //     on; over half, the animal is not making a remark, it is joining in.
    //     Up and loud.
    //  3. SOFT, the existing calm row: 1.2 s settled, grounded, empty-mouthed.
    //  4. ...and the plain one, unchanged, which is still most wheeks.
    //
    // `at` on every row, which is also new: the wheek was the one thing the
    // animal does that arrived mono and centred.
    const chaos = (game.state && game.state.chaos) || 0;
    if (capyStamBlown)               { capySfxAt.volume = 0.52; capySfxAt.pitch = 0.80; }
    else if (chaos > capyWHEEK_KEYED) { capySfxAt.volume = 1.00; capySfxAt.pitch = 1.13; }
    else if (capyWheekPayload.soft)   { capySfxAt.volume = 0.62; capySfxAt.pitch = 0.94; }
    else                              { capySfxAt.volume = 0.85; capySfxAt.pitch = 1.00; }
    game.sfx('wheek', capySfxAt);
    game.completeTask('wheek');
    game.shake(0.14);
    // a wheek from centre stage is the joke — the player earns the task.
    // game.env is Sydney's module and stays resident abroad; every biome shares
    // one coordinate space, so the zone test only means anything in Sydney.
    // ---- ...AND IT IS A NOTE (W1). The task used to tick here on the first
    // wheek from the podium. Now environment.js counts it: the house is
    // called on the first, the sails pulse on each, and the third with a
    // crowd in place is the concert. See envCONCERT_NOTES.
    const env = game.env;
    if (env && typeof env.stageNote === 'function' &&
        game.biome && game.biome.isActive('sydney') &&
        env.inZone('operaStage', capyPosition.x, capyPosition.z) && capyPosition.y > 0.9) {
      env.stageNote();
    }
  }

  /**
   * `k` is the charge multiplier on the launch vector, 1 for an uncharged
   * throw — which is every throw the game had before B10, and which is
   * therefore still the number this function computes when nobody passes one.
   */
  function capyTryRelease(k) {
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
    // THE CHARGE SCALES THE WHOLE VECTOR, both terms, so the 43.7 degree
    // launch angle is the same at every charge and only the range changes.
    // Scaling the horizontal alone would flatten the arc as it got stronger,
    // which is the one thing a thrown object must not do — the apex is how a
    // player reads where it is going.
    const kk = (typeof k === 'number' && k > 1) ? k : 1;
    const power = (5.0 + (game.input.run ? 2.0 : 0)) * (0.8 + spin * 0.15) * kk;
    capyThrow.set(Math.sin(capyYaw), 0, Math.cos(capyYaw)).multiplyScalar(power * m);
    capyThrow.y = 4.2 * m * kk;
    // props.js owns the held-state transition, the 'capy:drop' event and the sfx
    if (game.physics && typeof game.physics.release === 'function') game.physics.release(capyThrow);
    capyJawOpen = 1;
    // Stamped with the frame time so condor.js — which runs after this module,
    // by which point heldProp is already null — can tell a bomb release from a
    // dismount on the same key press.
    capy.threwAt = game.state.time;
  }

  /**
   * The vessel a put-down would go into, or null. Also the arming test: the
   * animal has to be holding something, standing still, and within reach of a
   * container that is not already carrying something.
   */
  function capyPutFind() {
    const ph = game.physics;
    if (!ph || typeof ph.vesselNear !== 'function') return null;
    if (!capy.heldProp) return null;
    const v = capy.velocity;
    if (v && Math.hypot(v.x, v.z) > capyPUT_STILL) return null;
    capyPutTgt = ph.vesselNear(capyPosition, undefined, capy.heldProp);
    return capyPutTgt;
  }

  /**
   * Resolve an armed press. Three ways out, and the first two are the point:
   * the key comes back up before the hold is done and it was a throw after
   * all; the hold completes and the thing goes in; or the vessel is no longer
   * there — the animal walked off, or somebody took the bin — and the press
   * is spent on a throw, because a press that quietly does nothing is worse
   * than either.
   */
  /** 0 at a tap, 1 at a full charge. */
  function capyChargeNow() {
    if (capyPutT < capyCHG_MIN) return 0;
    return clamp((capyPutT - capyCHG_MIN) / (capyCHG_TIME - capyCHG_MIN), 0, 1);
  }

  /**
   * Where the held prop would land at the present charge, written into
   * `capy.aim` for systems.js to put a ring on. The ballistics are the ones
   * capyTryRelease uses: a launch of (power, 4.2) × the charge, from the mouth,
   * against the world's own gravity — which is -24, not -9.8, and getting that
   * from `game.world` rather than from a constant is the whole reason this can
   * be trusted in the Drift, where gravity is not Sydney's.
   */
  function capyAimPoint(chg) {
    const p = capy.heldProp;
    if (!p) return null;
    const spin = (p.spin === undefined || p.spin === null) ? 1 : p.spin;
    const kk = 1 + (capyCHG_MAX_K - 1) * chg;
    const vh = (5.0 + (game.input.run ? 2.0 : 0)) * (0.8 + spin * 0.15) * kk;
    const vy = 4.2 * kk + 0.7;    // physRelease's own set-down lift, see props.js
    const gy = capyGroundY(game, capyPosition.x, capyPosition.z);
    const ph = game.physics;
    if (!ph || typeof ph.predictLanding !== 'function') return null;
    // THE AIR IS PART OF THE THROW. The vacuum range for a fully charged sun
    // hat is 9.30 m and the hat lands at 3.05: drag is quadratic and takes two
    // thirds of the strongest throw, so a mark placed by arithmetic would have
    // been most wrong exactly where the player was looking hardest. props.js
    // owns the drag law and integrates it.
    const hit = ph.predictLanding(p, Math.sin(capyYaw) * vh, vy, Math.cos(capyYaw) * vh,
                                  capyPosition.x, capyPosition.y, capyPosition.z, gy);
    const d = Math.hypot(hit.x - capyPosition.x, hit.z - capyPosition.z);
    return { x: hit.x, z: hit.z, d: d };
  }

  function capyPutStep(dt) {
    if (capyPutT < 0) { capy.aim = null; return; }
    if (!capy.heldProp) { capyPutT = -1; capyPutTgt = null; capy.aim = null; return; }
    capyPutT += dt;
    // ---- THE CHARGE, AND WHY EVERY THROW IS NOW ON THE RELEASE ----------
    // B9 deferred the press only where a put-down existed, precisely so the
    // other thirty readers of the action key kept their timing. 4b needs the
    // hold as well, and the rule that comes out is simpler than the one it
    // replaces rather than stranger: A TAP THROWS, A HOLD DOES THE CONSIDERED
    // VERSION — which is putting it in the bin if you are standing still
    // beside one, and a charged throw everywhere else. The impulse of a tap is
    // unchanged to the decimal; what moved is that it leaves on the key-up.
    const chg = capyChargeNow();
    capy.charge = chg;
    capy.aim = (chg >= capyCHG_MARK_MIN && !capyPutTgt) ? capyAimPoint(chg) : null;
    if (!game.input.action) {          // released
      capyPutT = -1; capyPutTgt = null; capy.aim = null; capy.charge = 0;
      capyTryRelease(1 + (capyCHG_MAX_K - 1) * chg);
      return;
    }
    // A put-down only happens where one was armed — a hold with no vessel in
    // reach is a charge and must not be cut short at capyPUT_HOLD.
    if (!capyPutTgt) return;
    if (capyPutT < capyPUT_HOLD) return;
    // ---- THE ARM IS RE-TESTED ONCE, AT THE END, AND NOT EVERY FRAME ------
    // "Standing still next to a bin" is a property of the PRESS. Re-running
    // the whole arming test every frame made a single frame of drift — the
    // animal settling on a Venetian quay — cancel a hold that was already
    // three quarters done, and the press then came out as a throw. What has
    // to still be true at the end is only that there is somewhere to put it:
    // the vessel armed against, if it is still in reach, and otherwise
    // whatever is.
    let tgt = capyPutTgt;
    const ph = game.physics;
    if (tgt && (tgt.removed || tgt.hidden || tgt.held || tgt.contents)) tgt = null;
    if (!tgt && ph && typeof ph.vesselNear === 'function') {
      tgt = ph.vesselNear(capyPosition, undefined, capy.heldProp);
    }
    capyPutT = -1; capyPutTgt = null;
    capyEatBuf(game.input, 'clearActionBuf');
    if (tgt && ph && typeof ph.putIn === 'function' && ph.putIn(tgt)) {
      capyJawOpen = 1;
      capy.threwAt = game.state.time;
      capyPutDone++;
    } else {
      capyTryRelease();
    }
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
    // The helm owns the pose outright and returns before the terrain pose is
    // ever computed. Hold the hill channels AT what this branch is drawing, so
    // stepping off the wheel resumes from the rear rather than snapping to it.
    capyLean = capyModel.rotation.x;
    capyPosePitch = 0; capyPoseRoll = 0; capyPoseLift = 0; capyPoseTrust = 0;
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
    // The face goes through the same one writer the main pose uses, at mood 0:
    // somebody at a helm is concentrating, not startled, and two functions
    // writing one scale is the trap this file has already paid for.
    capyBlink = capyBlink > 0 ? capyBlink - dt : 0;
    capyMood = damp(capyMood, 0, capyMOOD_OUT, dt);
    capyFacePose(capyMood, capyBlinkK());
    capyEarTimer -= dt;
    if (capyEarTimer <= 0) { capyEarTimer = rand(2.2, 5.5); capyBlink = capyBLINK_DUR; }

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
    capyNap = 0; capy.nap = 0; capyNapWake = 0;      // ...and THE NAP (N4)
    capyShakePend = 0; capyShakeP = -1;
    capyWhiffT = 0; capyWhiffPend = false;
    // ...and the face's one opinion belongs to the square it was earned in (F2).
    capySmugT = 0;
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
    let ride = null;
    const contacts = game.world.contacts;
    for (let i = 0; i < contacts.length; i++) {
      const c = contacts[i];
      let other = null;
      if (c.bi === body) { if (-c.ni.y > 0.4) { grounded = true; other = c.bj; } }
      else if (c.bj === body) { if (c.ni.y > 0.4) { grounded = true; other = c.bi; } }
      if (!other) continue;
      // ---- ...AND WHICH BODY IT IS, for the camera --------------------------
      // Taken BEFORE the two gates below, because both of them are about the
      // reference FRAME and this is about the SHAPE: a ferry lying alongside is
      // not moving and still must not be treated as a wall by the occlusion
      // ray. Kinematic only — that is what "a deck somebody drives" is in this
      // game, and a loose prop is already skipped by the ray itself. See
      // capy.rideBody and sysCamClear.
      if (other.type === CANNON.Body.KINEMATIC) ride = other;
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

    // ---- and the same three-state latch for the DECK ITSELF ----------------
    // Its own timer rather than a ride along on capyPlatT, because the two ask
    // different questions: capyPlatT is "how fast is my floor going", which a
    // berthed ferry answers zero, and this is "am I on a floor at all", which
    // it answers yes. Standing on something static (or swimming) lets go at
    // once; a hop keeps it for capyRIDE_HOLD and then drops it.
    if (capyLaunchT > 0) { capyRideBody = null; capyRideT = 0; }
    else if (ride) { capyRideBody = ride; capyRideT = capyRIDE_HOLD; }
    else if (grounded || capySwimming) { capyRideBody = null; capyRideT = 0; }
    else if (capyRideT > 0) capyRideT -= dt;
    else capyRideBody = null;
    capy.rideBody = capyRideBody;

    const px = body.position.x, py = body.position.y, pz = body.position.z;
    // How much the floor has agreed to hold on to. Zero everywhere but a
    // glacier and a dune face; see capySLIP_GRIP.
    const slip = capySlipAt(game, px, pz);
    // How much of the loss of grip is the ANIMAL rather than the ground. Kept
    // apart from the ground's own on purpose — see the ceiling note below.
    let capySlideSlip = 0;

    // ---- THE SLIDE (see the constants block) ------------------------------
    // Decided here, one block, before anything reads either number — which is
    // the whole implementation: soften the grip the glacier already taught this
    // file to respect, and let the rest of the frame do the work.
    {
      // World speed, not deck-relative: platVX is not solved until further down
      // the frame, and a deck fast enough to matter here is a deck you are
      // already being carried by, which is excluded on the next line.
      const gsp = Math.hypot(body.velocity.x, body.velocity.z);
      // The helm is not in this list because update() has already returned for
      // it forty lines up; `capy.atHelm` cannot be true here.
      const canSlide = !capySwimming && !capyDiving && !capyClinging &&
                       !capy.carriedBy && !capyStamBlown;
      if (capySlideCool > 0) capySlideCool -= dt;
      if (capySliding) {
        capySlideT += dt;
        if (grounded) capySlideAir = 0; else capySlideAir += dt;
        // Three ways out, and the speed one is the important one: a slide that
        // could be held at a standstill is a crouch, and a crouch is a
        // different game.
        if (!canSlide || !input.slide || capySlideAir > capySLIDE_AIR ||
            (capySlideT > capySLIDE_MINT && gsp < capySLIDE_OUT)) {
          capySliding = false;
          capySlideCool = capySLIDE_COOL;
          capySlideAir = 0;
        }
      } else if (input.slide && canSlide && grounded && capySlideCool <= 0 &&
                 gsp >= capySLIDE_MIN) {
        capySliding = true;
        capySlideT = 0;
        capySlideAir = 0;
        // ONE kick, on entry, along the way the animal is already going — not
        // along the stick. Getting down does not change where you were headed,
        // and reading the stick here would let a player slide sideways out of a
        // turn at full speed, which is a dodge and not a flop.
        const inv = gsp > 0.001 ? capySLIDE_KICK / gsp : 0;
        body.velocity.x += body.velocity.x * inv;
        body.velocity.z += body.velocity.z * inv;
        // Sampled here and not inside the sfx guard below: the scrape reads it
        // whether or not there is an audio context to play the entry rustle on,
        // and a build with sfx stubbed out must still publish a sane number.
        capySlideSurf = capySurfacePitch(game, env, px, pz, py);
        capySlideSurfT = capySLIDE_SURF_T;
        if (typeof game.sfx === 'function') {
          capySfxAt.pitch = capySlideSurf;
          capySfxAt.volume = 0.8;
          game.sfx('rustle', capySfxAt);
        }
        if (game.physics && typeof game.physics.dust === 'function') {
          game.physics.dust(px, py - 0.26, pz, 7);
        }
        if (typeof game.punch === 'function') game.punch(0.10);
      }
      capySlideW = damp(capySlideW, capySliding ? 1 : 0, capySliding ? 16 : 9, dt);
      if (capySliding) {
        // ---- AND IT RAISES THE FRICTION TERM, NOT THE CEILING ------------
        // The first cut put the slide's slip into `slip` itself, which is one
        // number feeding three things — the grip damper, the steering
        // authority AND the top-speed multiplier. Measured on the erg: holding
        // the stick forward through a slide accelerated to 17.9 m/s on the
        // flat, which is two and a half times a flat run, on a key. That is not
        // a slide, it is a second run button with a nicer pose.
        //
        // A slide is a way of CARRYING speed, so it belongs on the friction
        // half and nowhere near the drive target: `capySlideSlip` softens the
        // grip and costs steering exactly as ice does, and the ceiling stays
        // the ground's own. Downhill still accelerates, because that is
        // gravity against a body that has stopped gripping — which is the
        // whole point and is now the only way a slide can gain.
        capySlideSlip = capySLIDE_SLIP * capySlideW;
        // ...and it goes on kicking up whatever it is on, the whole way down.
        capySlideSpray -= dt;
        if (capySlideSpray <= 0) {
          capySlideSpray = 0.055;
          if (game.physics && typeof game.physics.dust === 'function') {
            game.physics.dust(px, py - 0.28, pz, 2);
          }
        }
        capySlideSurfT -= dt;
        if (capySlideSurfT <= 0) {
          capySlideSurfT = capySLIDE_SURF_T;
          capySlideSurf = capySurfacePitch(game, env, px, pz, py);
        }
      }
      capy.sliding = capySliding;
      // For sysBedScrape. Published unconditionally so a reader never has to
      // ask whether the last slide left a stale value behind it — while
      // `sliding` is false these numbers simply are not read.
      capy.slideSurf = capySlideSurf;
      // ...AND HOW LONG THE BELLY HAS BEEN OFF THE GROUND, which is NOT the
      // same question as `grounded` and is the one a sustained sound has to
      // ask. Measured: a capybara sliding at 7.4 m/s across a flat podium
      // reports `grounded` false on every OTHER frame — a body dragging over
      // a collider mesh loses contact constantly — so a voice gated on raw
      // contact is commanded to silence thirty times a second and comes out
      // as a tremolo. That chatter is the whole reason capySLIDE_AIR exists;
      // this publishes the accumulator the slide already forgives it with, so
      // one answer serves both and a reader cannot re-introduce the bug.
      capy.slideAir = capySlideAir;
    }
    // The published figure is what the FLOOR is doing to the animal, ground and
    // belly together, because that is the question every reader of it asks.
    const slipG = Math.max(slip, capySlideSlip);
    capy.slip = slipG;
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
    // ---- AND A SHOVE, ONCE THE FEET ARE OFF THE FLOOR --------------------
    // A sustained push is a LEAN while you are standing in it and a CURRENT of
    // air once you are not, and the two need different channels. Added to the
    // velocity (which is what happens below, on the ground) it compounds while
    // airborne: the whole live shove goes on every frame, the velocity already
    // carries last frame's, the cap is widened by the shove's own size, and the
    // only thing opposing it is the airborne bleed at 2.1. Marrakech measured a
    // standing hop leaving at 7 m/s, peaking at 23.3 and landing 22 m downwind.
    //
    // IT HAS TO JOIN THE FRAME HERE, above the line that derives vx, and not at
    // the shove site further down. Added after that line it is just a one-frame
    // offset: body.velocity is rebuilt as vx + platVX at the end, platVX starts
    // from zero next frame, and the push is back inside vx accumulating exactly
    // as it did before. Measured that way round it still peaked at 22.85 m/s.
    // Here, vx is the speed THROUGH THE AIR, the bleed damps toward the air
    // rather than the ground, and the hop drifts with the wind and no faster.
    if (!grounded && !capySwimming && !capy.carriedBy && !capy.atHelm) {
      platVX += capyShove.x; platVZ += capyShove.z;
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
      // ---- the stalemate, which is the void rescue three metres too late ----
      // See capySTUCK_T. Anything that is legitimately solving the animal's
      // height somewhere else is excluded: a carrier, a wheel, a climb and a
      // dive all put the body where the terrain is not, on purpose.
      capyStuckAge += dt;
      // Under the law, and not somewhere that puts the body off the terrain on
      // purpose — then ask the one question that separates a plaza from a
      // riverbank: is there anything over our head? See capySTUCK_LP.
      if (gap > capySTUCK_GAP && !capy.carriedBy && !capy.rideBody &&
          !capy.atHelm && !capy.climbing && !capy.diving &&
          (gap > capySTUCK_DEEP || capyLidAbove(game, body, capySTUCK_LID))) {
        capyStuckLP = damp(capyStuckLP, body.position.y, capySTUCK_LP, dt);
        if (Math.abs(capyStuckLP - capyStuckY) > capySTUCK_MOVE) {
          capyStuckY = capyStuckLP;
          capyStuckT = 0;
        } else {
          capyStuckT += dt;
        }
      } else {
        capyStuckT = 0;
        capyStuckY = body.position.y;
        capyStuckLP = body.position.y;
      }
      // last resort: genuinely fell out of the world, or wedged under it. Both
      // ARE teleports, so the interpolation history has to be rewritten with it.
      if (body.position.y < terr + capyVOID_Y || capyStuckT > capySTUCK_T) {
        // out of the solid first, then up — see capyFreeSpot. On the void case
        // the animal is already in open air and the search is a no-op.
        capyStuckN = capyStuckAge < 2.0 ? capyStuckN + 1 : 0;
        capyStuckAge = 0;
        capyFreeSpot(game, body.position.x, body.position.z, capyStuckN, capyFreeXZ);
        body.position.x = capyFreeXZ.x;
        body.position.z = capyFreeXZ.z;
        body.position.y = capyGroundY(game, capyFreeXZ.x, capyFreeXZ.z) + capyFOOT_Y;
        body.velocity.set(0, 0, 0);
        body.previousPosition.copy(body.position);
        body.interpolatedPosition.copy(body.position);
        body.previousQuaternion.copy(body.quaternion);
        body.interpolatedQuaternion.copy(body.quaternion);
        capyRenderPos.set(body.position.x, body.position.y, body.position.z);
        grounded = true;
        capyStuckT = 0;
        capyStuckY = body.position.y;
        capyStuckLP = body.position.y;   // the filter has to move with the animal
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
      // ...and the snorkel is a longer breath (L3-7): a third more, worn
      capyStam -= capySTAM_BREATH * (capyWorn === 'snorkel' ? 0.75 : 1) * dt;
    } else if (stamFree) {
      capyStamHold = 0;
      capyStam += capySTAM_REGEN * dt;
      if (capyStam > 1) capyStam = 1;
    } else if (stamWantRun && !capyStamBlown) {
      capyStamHold = capySTAM_DELAY;
      // ---- ch2 · THE LUNGS ------------------------------------------------
      // Pasto is 2,527 m up and the crater rim is a long way round. An animal
      // that has walked it has done altitude training whether it meant to or
      // not, and the whole of the upgrade is that this is a smaller number and
      // the two below are bigger ones: 14 s at a flat run instead of 10, and
      // half the wait before any of it comes back. It changes no distance, no
      // speed and no reach — only how long you may keep going, which is the
      // one thing a mountain can actually teach a body.
      capyStam -= capySTAM_DRAIN * (capySkill.lungs ? 0.71 : 1) * dt;
    } else if (capyStamHold > 0) {
      capyStamHold -= dt * (capySkill.lungs ? 2.0 : 1);
    } else if (capyStam < 1) {
      capyStam += capySTAM_REGEN * (capySkill.lungs ? 1.45 : 1) *
                  (stamMag2 > 0.01 ? capySTAM_REGEN_M : 1) * dt;
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
      // ---- ch5 · ON THE TWO -------------------------------------------------
      // Cali is the one chapter that already judges you against the pulse —
      // `salsa-dance` is scored on `game.music.off()`, the signed distance to
      // the nearest beat — and what it teaches is that the beat is there in the
      // other eighteen places too. Land the hop on it and the step carries.
      //
      // HORIZONTAL, NEVER THE APEX. See the long note above: the arc is 1.37 m
      // in eighteen chapters of geometry and a rhythm bonus that raised it
      // would make the game's reach depend on a drummer. This is the same
      // channel as the run-up and it is added the same way — once, onto the
      // velocity, in the platform's frame — so on the beat a standing hop
      // travels like a moving one and a running hop travels further, and the
      // ceiling of what you can land on does not move a millimetre.
      //
      // Silent when there is no pulse: `beats()` answers -1 for every pad
      // palette in the game, and a bonus you cannot hear the cue for is a
      // bonus that reads as the game being inconsistent.
      if (capySkill.beat && !capySwimming && game.music &&
          typeof game.music.off === 'function' && game.music.playing) {
        const off = game.music.off();
        if (off === off && Math.abs(off) < capyBEAT_WIN) {
          const bx = Math.sin(capyYaw), bz = Math.cos(capyYaw);
          body.velocity.x += bx * capyBEAT_PUSH;
          body.velocity.z += bz * capyBEAT_PUSH;
          capyBeatFlash = 1;
          capySfxOpts.pitch = 1.9; capySfxOpts.volume = 0.34;
          game.sfx('tick', capySfxOpts);
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
      // ...AND NOW THERE IS A CROUCH TO STRETCH OUT OF (D2). The comment on
      // this line said "stretch out of the crouch" for eighteen chapters and
      // seeded a positive pop, so the animal simply got taller on the frame it
      // left the ground. Seeding the spring NEGATIVE with a positive velocity
      // is the anticipation: it passes back through zero in about 23 ms — a
      // frame and a half, which is exactly as long as a compression should read
      // — and overshoots to the same 0.42 peak it always had. The policy on the
      // guard is unchanged: a bigger stretch already in flight (a wheek) wins.
      if (capyPop < capyHOP_POP) { capyPop = capyHOP_CROUCH; capyPopVel = capyHOP_VEL; }
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

    // ---- ch9 · THE SEED ----------------------------------------------------
    // The Drift is the chapter where the air is the floor, and `driftseed` is
    // twenty seconds of hanging off one while the wind takes it somewhere. What
    // it teaches is what a seed is FOR: hold the hop key once you are falling
    // and the animal splays and comes down at 1.85 m/s instead of terminal.
    //
    // IT CAN NEVER GAIN HEIGHT, and that is the whole safety argument. The only
    // thing this does to velocity.y is bring it UP TOWARD a negative number, so
    // a drift is always a descent and no ledge in the game becomes reachable
    // that a hop could not already reach. What it buys is TIME in the air, and
    // therefore distance across — which is exactly what a seed buys.
    //
    // Armed after capySEED_ARM of falling so it cannot eat the hop's own
    // sustain (the block above owns the key while the arc is still rising), and
    // closed by water, ground, a cling, a carry and the dive, all of which have
    // their own opinion about which way is up.
    const seedWant = capySkill.seed && input.jump && !grounded && !capySwimming &&
                     !capyClinging && !capy.carriedBy && !capyDiving &&
                     capyJumpArm === false && body.velocity.y < -0.4;
    if (seedWant) capy.seedT += dt;
    // A DAMP ALONE LOSES TO GRAVITY, and by a lot. capybara.js runs BEFORE the
    // world step, so every frame the solver puts back what the damp just took:
    // at lambda 6 the equilibrium is where 9.5% of the gap equals one frame of
    // gravity, which measured at −5.64 m/s against a target of −1.85 — a third
    // of the fall it says on the tin, and the sort of number that reads as the
    // feature working because it is obviously better than terminal velocity.
    //
    // So the damp is the FLARE only — capySEED_FLARE of it, so the animal eases
    // into the drift instead of hitting an invisible floor at twenty metres a
    // second — and after that the rate is ASSIGNED. Assigning is safe here for
    // the same reason it is safe in the climb: this is a controller writing its
    // own axis, not an external force, and it only ever assigns a DESCENT.
    if (seedWant) {
      capySeedT += dt;
      if (capySeedT > capySEED_ARM && body.velocity.y < capySEED_V) {
        body.velocity.y = (capySeedT < capySEED_ARM + capySEED_FLARE)
          ? damp(body.velocity.y, capySEED_V, capySEED_LAM, dt)
          : capySEED_V;
      }
    } else if (capySeedT > 0) {
      capySeedT = 0;
    }
    capy.drifting = capySeedT > capySEED_ARM;

    // ---- ch8 · THE VAULT ---------------------------------------------------
    // `acrobats` is a Marrakech square throwing a capybara into the air, and
    // what comes back down knows what a wall is for. One kick per airtime,
    // spent until the feet touch anything: press hop in mid-air with a face
    // within reach and the animal goes off it.
    //
    // It reuses capyClimbAt, which is the game's one answer to "is there
    // something here to hang off, and which way is it facing" — so the vault
    // works on every surface the climb works on and on no surface it does not,
    // and the sixteen chapters that got the generic fallback in v31 get the
    // vault with it. `force` bypasses the grab-key gate, because a wall-kick is
    // asked for with the hop key.
    //
    // 0.9 OF A HOP AND NOT A HOP. Stacking full-height kicks up a corner is a
    // ladder to anywhere; at 0.9, decaying against gravity, a second kick off
    // the same wall gains less than the first and a third gains almost nothing.
    if (capySkill.vault && !grounded && !capySwimming && !capyClinging &&
        !capy.carriedBy && !capyVaultUsed && capyJumpCool <= 0 &&
        body.velocity.y > capyVAULT_MINY &&
        (input.jumpPressed || capyBuffered(input, 'jumpBuf'))) {
      const h = capyClimbAt(game, px, body.position.y, pz, true);
      if (h) {
        capyEatBuf(input, 'clearJumpBuf');
        capyVaultUsed = true;
        capy.vaultN++;
        if (body.velocity.y < capyVAULT_V) body.velocity.y = capyVAULT_V;
        body.velocity.x += h.nx * capyVAULT_PUSH;
        body.velocity.z += h.nz * capyVAULT_PUSH;
        capyJumpCool = capyJUMP_COOL;
        capySeedT = 0;
        capyPop = capyPop < 0.34 ? 0.34 : capyPop;
        capyPopVel = 6;
        capyEarFlick = 1;
        capySfxOpts.pitch = 1.5; capySfxOpts.volume = 0.5;
        game.sfx('pop', capySfxOpts);
      }
    }
    if (grounded || capySwimming || capy.carriedBy) capyVaultUsed = false;

    // ---- ch11 · THE MANTLE -------------------------------------------------
    // Kowloon is the chapter that is a direction, and `bamboo-climb` is forty
    // metres of somebody else's scaffolding. What it teaches is the last half
    // metre: a hop that ARRIVES at a lip with its chin over it used to slide
    // back down the face, because the climb wants a hold and a hop has no hands.
    //
    // The lip has to be in a narrow band about the feet — capyMANTLE_DOWN to
    // capyMANTLE_UP, i.e. 30 cm below to 62 cm above — so this only ever
    // finishes a reach that was already within a hop of the ledge, and cannot
    // pull the animal up something it never got near. The cooldown is what
    // stops it laddering a flat wall.
    if (capyMantleCool > 0) capyMantleCool -= dt;
    if (capySkill.mantle && capyMantleT <= 0 && capyMantleCool <= 0 &&
        !grounded && !capySwimming && !capyClinging && !capy.carriedBy &&
        body.velocity.y < 1.2 && (input.x !== 0 || input.z !== 0)) {
      const h = capyClimbAt(game, px, body.position.y, pz, true);
      if (h && typeof h.top === 'number' && h.top === h.top) {
        const feet = body.position.y - capyFOOT_Y;
        const rise = h.top - feet;
        if (rise > capyMANTLE_DOWN && rise < capyMANTLE_UP) {
          capyMantleT = 0.30;
          capy.mantleN++;
          capyMantleCool = capyMANTLE_COOL;
          capySeedT = 0;
          capyEarFlick = 1;
          capySfxOpts.pitch = 1.15; capySfxOpts.volume = 0.38;
          game.sfx('pop', capySfxOpts);
        }
      }
    }
    if (capyMantleT > 0) {
      capyMantleT -= dt;
      if (body.velocity.y < capyMANTLE_V) body.velocity.y = capyMANTLE_V;
      // ...and OVER the lip, not up the face of it: a pull-up that only goes
      // up puts the animal back on the same wall a tenth of a second later.
      //
      // Along the NOSE and not along the stick. `dx`/`dz` — the camera-relative
      // move vector — are not declared until sixty lines below this and reading
      // them here is a TDZ throw, not a compile error; and the nose is the
      // better answer anyway, because facing is driven by intent in this file
      // and is therefore already where the player asked to go.
      body.velocity.x = Math.sin(capyYaw) * capyMANTLE_FWD + platVX;
      body.velocity.z = Math.cos(capyYaw) * capyMANTLE_FWD + platVZ;
    }
    // Leaving the ground has to STICK for a few frames or the contact the
    // capybara has not cleared yet reports grounded and the gait never lifts.
    if (capyJumpT > 0) grounded = false;

    // ---- ch19 · THE FLOW ---------------------------------------------------
    // Hanoi's whole lesson is one sentence: you cross a road by walking into it
    // at a steady pace, and what gets you clipped is not speed, it is CHANGING
    // YOUR MIND. `hanDither` — accumulated heading change over the last second
    // and a half — is how the chapter measures that, and it is measured against
    // two hundred and forty scooters that are all reading it.
    //
    // The skill is that sentence made portable. `capy.committed` is the same
    // quantity in the same shape, published for anybody: npc.js reads it so
    // that people step out of a committed animal's way in the other eighteen
    // chapters too. Hanoi keeps its own — the traffic there is a much richer
    // model and this is not going to second-guess it.
    //
    // IT IS NOT INVULNERABILITY AND IT IS NOT SPEED. It is being taken
    // seriously: hold a line and a line opens. Stop, or waver, and it shuts,
    // which is the honest version of the lesson and the only one worth having.
    {
      const fsp = Math.sqrt(capyVelocity.x * capyVelocity.x +
                            capyVelocity.z * capyVelocity.z);
      const dyaw = capyWrapAngle(capyYaw - capyFlowYawWas);
      capyFlowYawWas = capyYaw;
      capyFlowDither = clamp(capyFlowDither + Math.abs(dyaw) - dt * capyFLOW_LAM,
                             0, 3);
      capy.committed = capySkill.flow && fsp > capyFLOW_V &&
                       capyFlowDither < capyFLOW_TURN && !capy.carriedBy;
    }

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
        capyDigPayload.fall = fall;
        // ---- EVERY LANDING, NOT ONLY THE HARD ONES (D4) ------------------
        // This fired only past 5.5 m/s of descent because its one listener was
        // the dust, and a walk off a kerb should not throw a cloud. The lens
        // wants the same event at a lower threshold, so the THRESHOLD moves
        // onto the payload and each listener decides for itself: `dust` is the
        // old gate spelled out, and the skid — which borrows this event for a
        // puff and is not a fall at all — sets it true at a `fall` of 3.
        capyDigPayload.dust = fall > 5.5;
        game.events.emit('capy:land', capyDigPayload);
        // ...and the mark on the ground. Its own threshold, LOWER than the
        // dust's: a two-metre hop off a bench is worth a ring and is not
        // worth a cloud, and the whole point of the ring is that it is the
        // cheap one. See THE LANDING RING.
        if (fall > capyLAND_RING_V) {
          capyLandRing = 1;
          capyLandK = clamp((fall - capyLAND_RING_V) / 9, 0.28, 1);
          capyLandX = capyPosition.x;
          capyLandY = capyPosition.y - 0.30;
          capyLandZ = capyPosition.z;
        }
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
    if (effGround && !capySwimming && !capyClinging && mag > 0.02) {
      const ah = capyGroundY(game, px + dx * capyGRADE_LOOK, pz + dz * capyGRADE_LOOK);
      const here = capyGroundY(game, px, pz);
      if (ah === ah && here === here) {
        const g = clamp((ah - here) / capyGRADE_LOOK, -1.2, 1.2);
        capyGrade = g;
        // The slip gate used to switch this off ENTIRELY above slipG 0.35, on
        // the grounds that the slide owns the speed and the two would fight.
        // True going down, and nonsense going up: it made a glacier the one
        // hill in the game that costs nothing to climb, and with the old
        // steering target that added up to sprinting UP eighteen degrees of ice
        // at 19.6 m/s. Downhill on slip the slide still owns it; uphill, a hill
        // is a hill whatever it is made of.
        if (slipG < 0.35 || g > 0) {
          const tob = Math.exp(-3.5 * Math.abs(g + 0.05)) / capyGRADE_FLAT;
          topSpeed *= clamp(tob, capyGRADE_MIN, capyGRADE_MAX);
        }
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
      // ...BUT RAISING THE TARGET MADE THE STICK AN ENGINE. The target used to
      // be `topSpeed * (1 + slip * capySLIP_CAP)` — the same number as the cap —
      // and because this block STEERS BY PULLING VELOCITY TOWARD THE TARGET,
      // that is a motor pointing wherever the stick points, on the flat and
      // uphill as readily as down. Measured on one held key: Antarctic blue ice
      // 10.6 m/s walking and 19.0 running against 4.2 and 7.4 on paving; snow at
      // slip 0.18 beat dry pavement by 30 %; and the Iceland glacier could be
      // SPRINTED UP at 19.6 m/s, 89 m of eighteen-degree ice in five seconds.
      //
      // The target is now the honest topSpeed, and the no-braking property the
      // comment above is really asking for is bought directly instead: resolve
      // the error along the stick and across it, and on slip refuse to let the
      // ALONG component brake. A slide still cannot be slowed by pressing into
      // it, the ceiling is still capySLIP_CAP wide, and gravity can still take
      // the animal well past topSpeed — but the stick can no longer manufacture
      // speed the hill did not give it. At slip 0 the arithmetic below is
      // algebraically identical to what it replaced.
      // dx/dz carry the ANALOGUE MAGNITUDE (a half-deflected pad is a half
      // target), so the direction has to be normalised out before anything is
      // resolved along it and the magnitude put back into the target.
      const ux = dx / mag, uz = dz / mag;
      const T = topSpeed * mag * (0.74 + 0.26 * align);
      const along = vx * ux + vz * uz;
      let dAlong = T - along;
      if (dAlong < 0) dAlong *= (1 - slip);   // slip 1: never brake along the stick
      const tx = (along + dAlong) * ux;
      const tz = (along + dAlong) * uz;
      // ---- ch7 · THE CARVE --------------------------------------------------
      // A glacier takes 80% of the steering away (capySLIP_CTRL) and that is
      // correct: sliding is supposed to be sliding. What Iceland teaches by the
      // bottom of `glacier-run` is that you can put an EDGE in — the authority
      // loss drops to a third, so the animal holds a line down the ice instead
      // of going wherever the ice was going. Measured at full slip: 6.65 m of
      // lateral gain over two and a half seconds of steering becomes 12.86 m.
      //
      // THE CEILING DOES NOT MOVE. capySLIP_CAP is untouched, so the fastest a
      // carve can be down a glacier is the fastest a fall can be. It does read
      // a little quicker in the middle of a run (3.05 -> 3.93 m/s measured)
      // and that is not extra speed, it is the same target reached instead of
      // fought — which is the honest description of what an edge does.
      //
      // ...AND THE SEED FLIES ON THE SAME LINE. A drifting animal is not on the
      // ground, so it takes the air branch; capySEED_CTRL is deliberately over
      // capyAIR_CONTROL, because a seed that cannot be steered is a stone.
      const slipCtl = capySkill.carve ? capySLIP_CTRL * 0.34 : capySLIP_CTRL;
      const control = capySwimming ? 0.55
        : (effGround ? 1 - slipG * slipCtl
                     : (capySeedT > 0 ? Math.max(capySEED_CTRL, capyAirCtl(game))
                                      : capyAirCtl(game)));
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
      const grip = slipG > 0.001
        ? 1 / lerp(1 / capyGRIP_LAMBDA, 1 / capyGRIP_ICE, slipG)
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
      if (capySkidArm && slipG < 0.35 && sp2now > capySKID_V * capySKID_V) {
        capySkidArm = false;
        if (capyPop > -0.14) capyPop = -0.14;
        if (capyPopVel > -2.4) capyPopVel = -2.4;
        capyDigPayload.position = capyPosition;
        // a SKID is not a fall: it borrows this event for the puff and must not
        // borrow a forty-metre arrival's cloud with it — nor, since D4, its dip.
        // `fall` 3 is under sysDIP_V0 so the lens is untouched either way; the
        // flag is what keeps the puff.
        capyDigPayload.fall = 3;
        capyDigPayload.dust = true;
        game.events.emit('capy:land', capyDigPayload);
        capySfxOpts.volume = 0.30; capySfxOpts.pitch = 1.5;
        game.sfx('rustle', capySfxOpts);
      }
      vx = damp(vx, 0, brake, dt);
      vz = damp(vz, 0, brake, dt);
      if (slipG < 0.35 && vx * vx + vz * vz < capyGRIP_SNAP * capyGRIP_SNAP) {
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
    //
    // ON THE GROUND ONLY. Airborne, the shove has already been folded into the
    // reference frame further up (see "AND A SHOVE, ONCE THE FEET ARE OFF THE
    // FLOOR") — adding it here as well would be the compounding this batch
    // exists to remove, counted twice.
    if (grounded || capySwimming || capy.carriedBy || capy.atHelm) {
      vx += capyShove.x;
      vz += capyShove.z;
    }
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
      } else if (!hauling && capyJumpT <= 0 && capyHaulT <= 0 && capyLaunchT <= 0) {
        // ...NOR WHILE IT IS BEING THROWN (W1). A launch() out of the water —
        // the Uji chute, Strokkur from the pool — was being damped back onto
        // the waterline at lambda 7 for every frame the animal was still under
        // waterY + capySWIM_ENTER: 4.6 m/s up measured as 0.58 m of rise. The
        // launch hold already means "you are not standing on anything"; it
        // now also means the water does not own your height.
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

    // ---- loitering on the podium used to count, eventually (W1) ------------
    // Five silent seconds ticked the chapter's marquee. The stage is a
    // performance now (see env.stageNote); the clock stays for the harness.
    if (env && typeof env.inZone === 'function' && !capySwimming && grounded &&
        env.inZone('operaStage', capyPosition.x, capyPosition.z)) {
      capyStageTime += dt;
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
    // ---- ch15 · THE FLOAT --------------------------------------------------
    // Swimming is on this list, which is why a capybara — an animal whose ENTIRE
    // cultural identity is sitting placidly in water — could not sit still in
    // any of it, and why the one chapter with a task about doing exactly that
    // had to ask for it by hand every frame (see capy.loafAsk below).
    //
    // The Pantanal is the only place in the journey where the animal is not a
    // novelty; `the-crossing` is nine of its own kind following it into a river.
    // What that is worth is the water stops being somewhere you are on your way
    // through. Float still and the loaf comes on, and with it everything built
    // on `capy.loaf`: the calm field, the camera settling, the critters coming
    // closer, the breath coming back.
    //
    // NOT while diving and not while moving — the same two conditions the land
    // loaf already has, tested the same way. A drifting swimmer is still busy.
    const floating = capySkill.float && capySwimming && !capyDiving &&
                     mag <= 0.02 && groundSpeed <= 0.35;
    const capyBusy = mag > 0.02 || groundSpeed > 0.35 ||
                     (!grounded && !floating) ||
                     (capySwimming && !floating) || capyClinging || carried ||
                     capyDiving || !game.state.started;
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

    // ---- THE NAP (N4) ----------------------------------------------------
    // See the constants block. Three conditions and no new list: it is sitting
    // down, it has been doing nothing for capyNAP_T, and nobody has pressed
    // anything for capyWAKE_HOLD.
    //
    // ...AND THE WAKE IS AN EXPLICIT CHANNEL, because `capyBusy` cannot see a
    // key that does not move the animal. A wheek, a grab that finds nothing, a
    // press of the journal — none of them touch `capyRestT`, and every one of
    // them is somebody saying "I am still here". systems.js owns the keyboard
    // and calls `capy.wake()`; this file owns what waking looks like.
    //
    // NOT AT THE HELM AND NOT BEING CARRIED, on the loaf's own terms — a
    // capybara asleep at the wheel of a ferry is a bug report — and `atHelm` is
    // already on the loaf's want, so this inherits it. Swimming is NOT
    // excluded: an animal asleep in a hot spring is the entire point, and the
    // float skill is what makes the loaf reachable there in the first place.
    if (capyNapWake > 0) capyNapWake -= dt;
    const napWant = (capyLoaf > 0.9 && capyRestT >= capyNAP_T && capyNapWake <= 0 &&
                     !capy.atHelm && !carried) ? 1 : 0;
    capyNap = damp(capyNap, napWant, napWant > capyNap ? capyNAP_LAM : capyNAP_LAM * 9, dt);
    if (capyNap < 0.0015 && napWant === 0) capyNap = 0;
    capy.nap = capyNap;

    // ---- ...AND IT SAYS SO (F4) -----------------------------------------
    // The whole calm layer — the pose drop, the pad coming up, the filter
    // closing, `calmLean` widening on sysLoafNow — rewards sitting down, and
    // the animal itself was silent through all of it. See sfxPurr.
    //
    // RARE AND JITTERED, in the ambience ladder's idiom rather than on a
    // rhythm: the point of the loaf is that nothing is happening, and a noise
    // that arrives on a beat is something happening. The timer is only wound
    // while the animal is actually sat, and it is reset the moment it stands,
    // so getting up and sitting down again does not fire one instantly.
    if (capyLoaf > capyPURR_AT) {
      capyPurrT -= dt;
      if (capyPurrT <= 0) {
        capyPurrT = rand(4.5, 9.0);
        if (typeof game.sfx === 'function') {
          capySfxAt.volume = rand(0.55, 0.85) * capyLoaf;
          capySfxAt.pitch = rand(0.94, 1.08);
          game.sfx('purr', capySfxAt);
        }
      }
    } else {
      capyPurrT = rand(2.0, 4.5);
    }

    if (input.honkPressed) capyWheek();

    // The action key is shared with the condor, and condor.js runs AFTER this
    // module — so when the talons are in reach the same press used to throw the
    // held prop here and board the bird there. That is why you could never carry
    // anything up to the crater: 'Post something into the crater' is only
    // reachable by air, and taking to the air emptied your mouth. Defer.
    const talonsHere = !!(game.condor && typeof game.condor.talonInReach === 'function' &&
                          game.condor.talonInReach());
    // ---- TAP THROWS; HOLD PUTS IT DOWN (B9, item 4a) --------------------
    //
    // AND THE THROW IS ONLY DEFERRED WHERE THE PUT-DOWN EXISTS. `E` is read by
    // about thirty call sites across the chapters and its meaning is a
    // context; a tap/hold split that deferred every press would move all of
    // them by the length of a click. So the press is armed ONLY when the
    // animal is standing still with something in its mouth and a vessel
    // actually within reach — which is a bin, a basket or an esky, and nothing
    // else. Everywhere else in the game, including every throw made while
    // walking, the press still fires capyTryRelease on the frame it arrives.
    //
    // capyPutT is the elapsed hold; capyPutTgt is the vessel it was armed
    // against, and losing it is what cancels the arm.
    // capyPutT < 0 in the test because a keydown REPEATS. A player who holds
    // the key gets a second `actionPressed` about half a second in, and
    // re-arming on it restarts the 0.35 s clock — so a one-second hold could
    // end with 0.2 s on the timer and come out as a throw. It read as a
    // put-down that works in one chapter and not the next one.
    if (input.actionPressed && !talonsHere && capyPutT < 0 && capy.heldProp) {
      capyPutT = 0;
      // capyPutFind sets capyPutTgt, and a null target is not a refusal — it
      // is the other half of the rule: no vessel in reach (or not standing
      // still) means the hold is a CHARGE instead of a put-down.
      if (capyPutFind()) capyPutN++;
    } else if (input.actionPressed && !talonsHere) {
      capyTryGrabStart();
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

    capyPutStep(dt);

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
    if (capySmugT > 0) capySmugT -= dt;

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
    // ---- THE STRIDE IS WHAT THE LEGS ACTUALLY DO ------------------------
    // Hoisted from fifty lines below, where it used to live: the swing is the
    // input to the cadence and not a separate decision, and having the two
    // apart is exactly how they came to disagree. See capyLEG_R.
    //
    // Deriving the cadence rather than asserting it also means the footfall
    // sfx, `capy:step` and the flow's dust all get their timing corrected for
    // free — they all ride this phase.
    const swingAmp = capySwimming ? 0.42 : clamp(0.12 + gaitSpeed * 0.19, 0, 1.15);
    const stride = capySwimming ? 0 : 2 * capyLEG_R * Math.sin(swingAmp);
    const gaitRate = capySwimming ? 7.5
      : (stride > capyGAIT_MIN_STRIDE
          ? clamp(Math.PI * gaitSpeed / stride, 0, capyGAIT_MAX)
          : 0.4);
    capySwingAmp = swingAmp; capyStride = stride; capyGaitRate = gaitRate;
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
        // ---- ...AND NOT WHILE THE BELLY IS ON THE GROUND (F3) -----------
        // `capySliding` was not in this gate and the animal is `grounded`
        // throughout a slide — the state sets no flag this block reads and
        // `capyLegPhase` advances unconditionally in the `if (moving)` above —
        // so every slide in the game played a GALLOP. Four chapters lean on
        // the verb (the dune, the Uji run, the glacier, and every hill that
        // will take it) and all four had four feet running underneath a
        // capybara lying on its stomach. The slide has its own voice: a
        // `rustle` on entry and the shared air-rush layer, both correct and
        // both unchanged.
        if (!capySwimming && grounded && !carried && !capySliding) {
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
          //
          // ---- ...AND `splash()` ONLY KNOWS ABOUT RAIN (M10) -------------
          // It is `clamp((wet - 0.34)/0.5) * clamp(0.35 + rainT)` and nothing
          // else — a pure function of how wet the WEATHER is. It knows nothing
          // about water being there, so wading the Manly shallows, the Quay's
          // edge, Palawan's bay, the Uji, the Pantanal marsh, the cave river and
          // the acqua alta over the Piazzetta all played the dry material voice.
          //
          // And it is exactly the band a player actually walks through:
          // `capySwimming` turns the footfall off entirely, so the stretch
          // between "dry" and "swimming" — which is where somebody walks INTO
          // the sea — had no water in it at all.
          //
          // The wet layer is already built, already mixed as its own layer, and
          // already the right weight (its peak is 0.070 against the material's
          // 0.075-0.085, so a full wade reads as a splash the same size as the
          // step). This is the second question it should have been asked. The
          // MAXIMUM of the two rather than a sum: standing in a puddle in the
          // rain is not twice as wet as either.
          //
          // ---- THERE IS NO WADING BAND IN THIS GAME, AND THERE IS A DRIP ---
          //
          // The obvious version of this ramps on how far the foot is under the
          // surface. It measured ZERO over a fourteen-second walk into the sea
          // at Manly, and the zero was right: `capySWIM_ENTER` is 0.70 and is
          // measured from the BODY CENTRE, the foot is `capyFOOT_Y` (0.34)
          // below that, so the animal is swimming — and this whole block is
          // skipped — before the foot is 36 cm under.
          //
          // Asked of the geometry instead of by walking (`qa/m10-wade.js`), a
          // 121 m grid in twelve chapters: the number of points where the animal
          // could stand on GROUND THAT IS UNDER WATER is zero in Rio, Venice,
          // the cave, Antarctica and Monte Carlo, and in the rest the terrain
          // function simply stops at the waterline, so the "shallows" every
          // chapter appears to have are dry ground inside a water REGION. The
          // state this was written for does not exist.
          //
          // What does exist, in every chapter with water in it, is an animal
          // that has just climbed out of it. `capySwimAgo` is already kept — it
          // is what the haul-out reads — and a capybara walking up a beach with
          // the sea running off it is the commonest wet footfall in the game and
          // had the driest sound in it. So the term is a DRIP: full for the
          // first stride out and gone within a few seconds, which is also how
          // long it takes to stop sounding like that.
          //
          // The overWater term is kept beside it at a fraction of the weight,
          // because where the band does exist it is correct — and the maximum
          // rather than a sum, since standing in a puddle in the rain is not
          // twice as wet as either.
          const drip = clamp(1 - capySwimAgo / capyWADE_DRIP, 0, 1);
          const wade = Math.max(drip, overWater ? capyWADE_IN : 0);
          capySfxOpts.wet = Math.max(game.weather ? game.weather.splash() : 0, wade);
          game.sfx('step', capySfxOpts);
          // ...and at a run it kicks up whatever it is running on
          if (gaitSpeed > capyWALK * 1.05 && capyStepPhase % 2 === 0) {
            capyDigPayload.position = capyPosition;
            game.events.emit('capy:step', capyDigPayload);
          }
          // ---- AND THE LONGER THE LINE, THE MORE IT KICKS UP -------------
          // The flow's fourth reader, and the only one at ground level: a
          // streak leaves a trail. One mote at a jog, four at the top of a
          // long clean run, none at all at a walk — so it reads as the run
          // having weight rather than as a permanent dust cloud. Through
          // props.js's own pool, which is already routed to whichever biome is
          // live and already takes that biome's colour. See THE FLOW.
          const fl = (game.state && game.state.flow) || 0;
          if (fl > 0.12 && gaitSpeed > capyWALK * 1.2 &&
              game.physics && typeof game.physics.dust === 'function') {
            game.physics.dust(px, body.position.y - 0.26, pz, 1 + Math.round(fl * 3));
          }
        }
        // ---- AND THE OTHER HALF OF THIS GATE WAS SILENT (F4) -----------
        // `capySwimming` forces `moving` true and pins `gaitRate` at 7.5, so
        // the leg phase and this half-cycle have ALWAYS been running while
        // the animal swims — and the only thing on the far side of them was a
        // gate that begins `!capySwimming`. A capybara is a swimming animal,
        // the game has a dive verb, two chapters are mostly water, and the
        // one place the stroke was already being counted made no sound at
        // all.
        //
        // Not `step` with a wet flag: a stroke is not a footfall on water, it
        // is a paddle UNDER it, and `splash` is the voice for that. Every
        // other stroke, because the phase is two per cycle and a capybara
        // paddles diagonally — the same couplet the walk uses — so one per
        // cycle is the pair that actually breaks the surface.
        //
        // Silent while DIVING: underwater there is no surface to break, and
        // the dive has its own bus.
        else if (capySwimming && !capyDiving && !carried && capyStepPhase % 2 === 0) {
          capySfxAt.volume = rand(0.28, 0.42);
          capySfxAt.pitch = rand(0.9, 1.25);
          game.sfx('splash', capySfxAt);
        }
      }
    } else {
      // unwind by the SHORTEST arc — never rewind a whole stride on stopping
      let w = capyLegPhase % (Math.PI * 2);
      if (w > Math.PI) w -= Math.PI * 2;
      capyLegPhase = damp(w, 0, 6, dt);
    }

    // (`swingAmp` — stride amplitude, which has to read at a ~9.5 unit camera:
    // ~53 deg at a walk, ~66 deg flat out, anything smaller vanishes at this
    // distance — is computed with the cadence it feeds, fifty lines up.)
    // 0 on the floor, 1 in the air — 0.14 s of airtime before the pose commits,
    // which is longer than any contact hiccup and shorter than the shortest hop.
    capyAirPose = damp(capyAirPose, (!grounded && !capySwimming && !carried &&
                                     capyAirTime > 0.06) ? 1 : 0, 13, dt);
    // ...and the CLIMB is the fourth answer on the same channel. It has to be
    // computed here rather than inside the loop because the body's own pitch
    // reads it too. See THE CLIMB HAS A POSE NOW.
    capyClimbPose = damp(capyClimbPose, capyClinging ? 1 : 0, capyCLIMB_LAM, dt);
    if (carried) {
      // ---- WHO IS HOLDING YOU, AND HOW (D8) ------------------------------
      // Three carriers, three holds. `capyCarryT` restarts whenever the carrier
      // changes, which is what makes the flail a BEAT rather than a state: it
      // is the first second and a bit of every carry and then it is over.
      const carrier = capy.carriedBy;
      if (carrier !== capyCarrier) {
        capyCarrier = carrier; capyCarryT = 0; capyHangSway = 0; capyCarryPh = 0;
      }
      capyCarryT += dt;
      const holdKind = (carrier && carrier.hold) || 'arms';
      // 1 while it is still kicking, 0 once it has given up. Arms never do.
      const flail = holdKind === 'ride' ? 0
                  : holdKind === 'arms' ? 1
                  : clamp(1 - (capyCarryT - capyHANG_FLAIL) * capyHANG_LAM, 0, 1);
      // ---- AND THE FLAIL HAS NEVER FLAILED ---------------------------------
      // It ran on `capyLegPhase`, which is the GAIT's phase — and forty lines
      // above this the gait, seeing an animal that is not moving, damps that
      // same variable back toward zero at λ 6 every frame. Two writers on one
      // channel, and the fixed point of `+14·dt` against `−6·w·dt` is a
      // CONSTANT: w = 14/6 = 2.33 rad. Measured on the carry, the four legs
      // reach 0.45, −0.21, −0.68, −0.52 within half a second and then never
      // move again — so a capybara being carried off by a gardener has been
      // held rigid, in one pose, at a slight angle, for nineteen versions,
      // under a comment that says "flail, don't stand serenely".
      //
      // Its own variable. The gait cannot reach this one.
      capyCarryPh += 14 * dt;
      if (capyCarryPh > Math.PI * 2) capyCarryPh -= Math.PI * 2;
      for (let i = 0; i < 4; i++) {
        // The pose it settles INTO: hung by the middle, legs trailing — or, on
        // a manta, braced out sideways with all four, because you are on top of
        // this one and not underneath it.
        const rest = holdKind === 'ride' ? capyRIDE_LEG
                   : (i < 2 ? capyHANG_F : capyHANG_R);
        legs[i].rotation.x = lerp(rest, Math.sin(capyCarryPh + i) * 0.7, flail);
        const splay = holdKind === 'ride'
          ? (i % 2 === 0 ? 1 : -1) * capyRIDE_SPLAY * (1 - flail) : 0;
        legs[i].rotation.z = damp(legs[i].rotation.z, splay, 8, dt);
      }
      // ...and a thing hanging off a bird swings. Not a flail — a slow lean
      // either side of vertical, at about a third of a hertz, which is the
      // period of a 1.45 m tether and is why it is written as one.
      capyHangSway = damp(capyHangSway, holdKind === 'talons' ? 1 - flail : 0, 2.2, dt);
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
          const u = ((phase / 6.283185) % 1 + 1) % 1;
          const walk = capyGait(u, swingAmp, i);
          const tuck = (i < 2 ? -0.62 : 0.52) + (body.velocity.y > 0 ? -0.16 : 0.20);
          // ...and the LOAF is a third pose on the same cross-fade. It cannot
          // fight the air tuck: capyLoaf is only ever non-zero when the animal
          // has been on the ground and doing nothing for capyLOAF_T, and the
          // first frame off the ground zeroes capyRestT, so capyAirPose and
          // capyLoaf cannot both be up.
          // ...and the CLIMB is the fourth, and it beats all three of them,
          // because a wall is the least ambiguous thing an animal can be
          // touching. Both diagonals reach on the same cycle out of
          // capyClingT — which is what that variable was declared for in v31
          // and has never once been read.
          const climb = (i < 2 ? capyCLIMB_F : capyCLIMB_R)
                      + Math.sin(capyClingT * capyCLIMB_RATE +
                                 ((i === 0 || i === 3) ? 0 : Math.PI)) * capyCLIMB_SWING;
          legs[i].rotation.x = lerp(lerp(lerp(walk, tuck, capyAirPose),
                                         i < 2 ? capyLOAF_LEG_F : capyLOAF_LEG_R, capyLoaf),
                                    climb, capyClimbPose);
          // Elbows out. A leg reaching straight forward is an animal falling
          // face first; a leg reaching forward AND out is one holding on.
          const climbZ = (i % 2 === 0 ? 1 : -1) *
                         (i < 2 ? capyCLIMB_SPLAY_F : capyCLIMB_SPLAY_R) * capyClimbPose;
          legs[i].rotation.z = damp(legs[i].rotation.z, climbZ, 8, dt);
        }
      }
    }

    // ---- THE LOAF SITS ON ITS HOCKS (R4) ---------------------------------
    // Two terms that belong to the loaf and to nothing else, written HERE and
    // not inside the pose branches above for the reason those branches exist:
    // the legs are drawn by five writers (gait, air, loaf, climb, and whatever
    // is carrying the animal) and a loaf-only term repeated in each of them is
    // five chances to forget one. Both are cross-faded on `capyLoaf`, so at
    // rest they are the whole pose and everywhere else they are exactly zero.
    for (let i = 0; i < 4; i++) {
      // THE Z TUCK. The rear hips walk forward as the animal settles, which is
      // what puts the feet under the edge of the rump instead of off the back
      // of it. Fronts do not move: they are already out in front, which is
      // where a loafing capybara puts them.
      legs[i].position.z = legZ[i] + (i < 2 ? 0 : capyLOAF_TUCK_Z * capyLoaf);
      // THE ANKLE, and it is not optional now that the foot has toes cut into
      // it. A leg folded to 1.14 rad with the foot rigid to it is an animal
      // standing on its heel with its toes in the air. The foot takes the
      // leg's own loaf rotation straight back off, so the sole stays flat on
      // the ground through the whole fold — which is what an ankle is.
      // ...and the swing's lift (L3, E2): the shin shortens about the hip and the
      // toes trail, only while the gait is the writer — not in the air, not in
      // the loaf, not on a wall, not swimming
      const lift = capyLegLift[i] * (1 - capyAirPose) * (1 - capyLoaf) * (1 - capyClimbPose) *
                   (capySwimming ? 0 : 1) * clamp(gaitSpeed / capyWALK, 0, 1);
      legs[i].scale.y = 1 - capyGAIT_SHIN * lift;
      feet[i].rotation.x = -legs[i].rotation.x * capyLoaf + capyGAIT_TOE * lift;
    }

    // squash & stretch spring — stiff and under-damped, so a wheek is a sharp
    // pop with an elastic overshoot instead of a gentle swell.
    //
    // SUB-STEPPED, AND THE LANDING ABSORB BELOW SHARES THE SUB-STEP. Explicit
    // Euler on a stiff spring is stable only while the step is short. At k=300
    // the pop is only marginally stable at a 60 Hz dt and outright wrong on a
    // long frame, which read as a hitch in the pop. The landing absorb fails
    // the same way for a different reason: its damping term is `-c*v*h`, so for
    // h > 2/c = 0.074 s the correction overshoots zero and flips the velocity
    // with a LARGER magnitude every step. `game.tick` clamps a frame at 0.1 s
    // (main.js, the tab-switch guard), which is deep inside that band — so on
    // any frame slower than 13.5 fps the landing spring rang instead of
    // settling. Measured at rdt 0.1: the model's local Y alternating between
    // -0.05 and -0.81 m, 0.76 m peak to peak, in nine chapters. It looks
    // exactly like the animal sinking into the ground, and it is why it did.
    //
    // 240 Hz target, at most 8 inner steps, so the longest step either spring
    // can ever take is 0.1/8 = 0.0125 s: the pop's k*h^2 is 0.047 and the
    // absorb's c*h is 0.34, both a long way inside their limits.
    const sprSteps = dt > 1 / 240 ? (dt * 240 > 8 ? 8 : Math.ceil(dt * 240)) : 1;
    const sprH = dt / sprSteps;
    for (let s = 0; s < sprSteps; s++) {
      capyPopVel += (-capyPop * 300 - capyPopVel * 9) * sprH;
      capyPop += capyPopVel * sprH;
    }
    if (capyPop > 1.15) { capyPop = 1.15; if (capyPopVel > 0) capyPopVel = 0; }
    else if (capyPop < -0.5) { capyPop = -0.5; if (capyPopVel < 0) capyPopVel = 0; }

    // body bob / roll / pitch — a run is a different GAIT, not a faster walk:
    // ~2.5x the bob, ~2.3x the forward lean, ears further back, head up.
    const bobAmp = capySwimming ? 0.02
      : clamp(0.010 + gaitSpeed * 0.010, 0, 0.085) * (running ? 1.55 : 1);
    // mid-stance is where the weight is (L3, E2): u = 0.3 and 0.8 of leg 0's cycle
    const bobU = ((capyLegPhase / 6.283185) % 1 + 1) % 1;
    const bob = Math.abs(Math.cos(6.283185 * (bobU - capyGAIT_STANCE * 0.5))) * bobAmp + (capySwimming ? Math.sin(t * 2.3) * 0.02 : 0);
    // ---- LANDING ABSORB ----------------------------------------------
    // A hop that ends the instant the collider touches has no weight in it: the
    // animal simply stops being in the air. Real landings are absorbed by the
    // legs over a tenth of a second and then pushed back out. This is a second
    // spring, on the MODEL only — the collider is untouched, so nothing about
    // the physics, the ledge you just cleared or the task you just triggered can
    // be changed by it. Critically damped on the way back up so it never bounces.
    // Sub-stepped on the shared sprSteps/sprH above — see the note there for
    // what this spring did on a long frame before it was. The bottom-out clamp
    // is INSIDE the loop because it is a hard stop: the leg reaches the end of
    // its travel during the step, not after the whole frame's worth of it.
    for (let s = 0; s < sprSteps; s++) {
      capyLandVel += (-capyLand * capyLAND_K - capyLandVel * capyLAND_C) * sprH;
      capyLand += capyLandVel * sprH;
      if (capyLand < -0.30) { capyLand = -0.30; if (capyLandVel < 0) capyLandVel = 0; }
    }
    // ...and the HEAD SETTLES AFTER IT (R5). A damped follower of the absorb,
    // not a second trigger on the landing, so it peaks after the spring has
    // bottomed out rather than with it. capyLand is negative going down and
    // head.rotation.x is positive nose-down, hence the sign: the body drops,
    // and a moment later the head does.
    capyHeadNod = damp(capyHeadNod,
                       clamp(-capyLand * capyNOD_K, -capyNOD_MAX, capyNOD_MAX),
                       capyNOD_LAM, dt);
    // ...and the slide, which is the animal getting DOWN. Model only, like the
    // landing spring above it and for the same reason: the collider is three
    // spheres and a shorter capybara would fall through eighteen chapters of
    // geometry sized against the one that exists. See THE SLIDE.
    capyModel.position.y = -capyFOOT_Y + bob + capyLand - capySLIDE_DROP * capySlideW +
                           (capySwimming ? 0.02 : 0);
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
    // ...and a little more asleep (N4), which is the chin going down onto the
    // paws rather than a second sit. Same water rule for the same reason.
    capyModel.position.y -= capyNap * capyNAP_DROP * (capySwimming ? 0.30 : 1);

    // ---- THE HILL, READ AND WORN (see capyPOSE_TERRAIN) -------------------
    // Four extra samples of the terrain law per frame — the same law the walk
    // speed already reads, which is analytic and smooth, so unlike a probe of
    // the faceted COLLIDER this cannot twitch at every triangle edge.
    //
    // Everything here is ADDED to the speed lean and the turn roll rather than
    // replacing them. Both of those are tuned and shipped; this is a third
    // term beside them, and it is the reason capyLean exists.
    //
    // The loaf is deliberately NOT gated off, against the note on the card: a
    // capybara that sits down on a hillside and snaps level is the bug in a
    // costume, and since the loaf pitch is a constant added on the same
    // channel there are no two writers here to fight.
    let poseTrustT = 0;
    const poseOwn = capyPOSE_TERRAIN > 0 && grounded && !capySwimming &&
                    !capyDiving && !capyClinging && !carried && !capy.atHelm;
    if (poseOwn) {
      const poseApi = capyBiomeApi(game);
      if (poseApi && typeof poseApi.terrainHeight === 'function') {
        // forward is local +z, which under the root's yaw is (sin, cos); the
        // model's local +x — the side rotation.z lifts — is (cos, -sin).
        const fs = Math.sin(capyYaw), fc = Math.cos(capyYaw);
        const ppx = capyRenderPos.x, ppz = capyRenderPos.z;
        const h0 = capyGroundY(game, ppx, ppz);
        const hF = capyGroundY(game, ppx + fs * capyPOSE_LOOK, ppz + fc * capyPOSE_LOOK);
        const hB = capyGroundY(game, ppx - fs * capyPOSE_LOOK, ppz - fc * capyPOSE_LOOK);
        const hP = capyGroundY(game, ppx + fc * capyPOSE_WIDE, ppz - fs * capyPOSE_WIDE);
        const hN = capyGroundY(game, ppx - fc * capyPOSE_WIDE, ppz + fs * capyPOSE_WIDE);
        if (h0 === h0 && hF === hF && hB === hB && hP === hP && hN === hN) {
          let gF = capyPoseFit(hB, h0, hF, capyPOSE_LOOK);   // + is uphill ahead
          const supF = capyPoseSupY;
          let gX = capyPoseFit(hN, h0, hP, capyPOSE_WIDE);   // + is uphill to +x
          const sup = Math.max(supF, capyPoseSupY);
          // Clamped as a PAIR. Clamping each axis to capyPOSE_MAX on its own
          // lets the two together reach 1.41x it, and tips the direction of the
          // tilt away from the fall line as it does so.
          let gM = Math.sqrt(gF * gF + gX * gX);
          const gLim = Math.tan(capyPOSE_MAX);
          if (gM > gLim) { const k = gLim / gM; gF *= k; gX *= k; gM = gLim; }
          // THE DROP, and why it is arithmetic rather than a measurement.
          // The collider is three spheres in a line and on a slope it rests on
          // the uphill one, which lifts the body centre by the rise across half
          // the chain plus what a sphere gains on a tilted plane. Predicting
          // that from the GRADIENT rather than reading it off the body means a
          // crate, a raft or a rooftop cannot feed the drop a number that has
          // nothing to do with the hill.
          // ...plus wherever the supporting line sits above the sample under
          // the belly, which is how the animal bridges a gutter instead of
          // dropping a leg into it.
          const rise = capyFOOT_Y * Math.abs(gF) + capyFOOT_Y * (Math.sqrt(1 + gM * gM) - 1);
          // ...and the same prediction is the trust test. If the body is not
          // where standing on this hill would put it, the animal is standing on
          // something else and the hill is not its pose. Faded, not switched:
          // a hard gate over a faceted world flickers, and a flickering target
          // on a damped channel is a wobble.
          const off = Math.abs((capyRenderPos.y - capyFOOT_Y - h0) - rise);
          poseTrustT = off <= capyPOSE_TRUST ? 1
            : off >= capyPOSE_DOUBT ? 0
            : (capyPOSE_DOUBT - off) / (capyPOSE_DOUBT - capyPOSE_TRUST);
          capyPoseGF = gF; capyPoseGX = gX;
          // Where the underside WANTS to be, relative to where the collider is
          // holding it: down onto the hillside by the rise, and back up by
          // however far the supporting line clears the sample under the belly.
          capyPoseRise = clamp((sup - h0) - rise, -capyPOSE_LIFT, capyPOSE_RAISE);
        }
      }
    }
    capyPoseTrust = damp(capyPoseTrust, poseTrustT, capyPOSE_TRUST_LAMBDA, dt);
    capyPosePitch = damp(capyPosePitch,
      clamp(-Math.atan(capyPoseGF), -capyPOSE_MAX, capyPOSE_MAX) * capyPoseTrust,
      capyPOSE_LAMBDA, dt);
    capyPoseRoll = damp(capyPoseRoll,
      clamp(Math.atan(capyPoseGX), -capyPOSE_MAX, capyPOSE_MAX) * capyPoseTrust,
      capyPOSE_LAMBDA, dt);
    capyPoseLift = damp(capyPoseLift, capyPoseRise * capyPoseTrust, capyPOSE_LAMBDA, dt);
    capyModel.position.y += capyPoseLift;

    // ...and the roll, where the carry now has TWO answers rather than one.
    // The 0.12 off the flail phase is the gardener wrestling with something
    // that does not want to be carried; capyHangSway is what is left once the
    // kicking stops, and it is a third of a hertz rather than seven.
    capyModel.rotation.z = (carried
      ? Math.sin(capyCarryPh * 0.5) * 0.12 * (1 - capyHangSway) +
        Math.sin(t * 1.95) * capyHANG_SWAY * capyHangSway
      : clamp(capyYawRate * 0.075, -0.34, 0.34) * (running ? 1.35 : 1)) + capyIdleRoll + capyPoseRoll;
    // Nose down on the way down, nose up on the way back — read off the actual
    // vertical velocity rather than off the key, so a dive that has hit the
    // bottom and levelled out LOOKS level.
    // ---- LEAN IS ACCELERATION, NOT ONLY SPEED (D2) -----------------------
    // Speed says where the body is; acceleration says what it is doing, and it
    // is the second one that reads as weight. Two sources, both differentiated
    // here and nowhere else:
    //
    //   THE ANIMAL'S OWN. `capySpeedSm` is already smoothed and already the
    //   thing the gait rides, so its derivative is the honest one — the raw
    //   ground speed steps with every contact and differentiating THAT is a
    //   lean that shivers. Clamped hard: a solver spike is not an acceleration.
    //
    //   THE DECK'S. Three chapters move the floor and `frameVX/VZ` has carried
    //   it since the ferry — a ferry pulling away used to move a statue. Taken
    //   in world axes, differentiated, and only then rotated into the model's
    //   yaw, because the deck can accelerate sideways and the lean is a pitch.
    const accelRaw = dt > 0.0001 ? (capySpeedSm - capySpeedPrev) / dt : 0;
    capySpeedPrev = capySpeedSm;
    capyAccelSm = damp(capyAccelSm, clamp(accelRaw, -capyACCEL_CLAMP, capyACCEL_CLAMP), 12, dt);
    capyDeckAX = damp(capyDeckAX, dt > 0.0001 ? clamp((capy.frameVX - capyDeckVX) / dt,
                      -capyACCEL_CLAMP, capyACCEL_CLAMP) : 0, 6, dt);
    capyDeckAZ = damp(capyDeckAZ, dt > 0.0001 ? clamp((capy.frameVZ - capyDeckVZ) / dt,
                      -capyACCEL_CLAMP, capyACCEL_CLAMP) : 0, 6, dt);
    capyDeckVX = capy.frameVX; capyDeckVZ = capy.frameVZ;
    // the model's forward is +z rotated by the yaw, so this is the component of
    // the deck's acceleration the animal would feel through its own nose
    const deckFwd = capyDeckAX * Math.sin(capyYaw) + capyDeckAZ * Math.cos(capyYaw);
    const leanTarget = capyDiving || (capySwimming && capy.depth > 0.6)
                       ? clamp(-body.velocity.y * 0.16, -0.42, 0.42)
                       : capySwimming ? -0.05
                       : gaitSpeed * (running ? 0.030 : 0.013)
                         + capyAccelSm * capyACCEL_LEAN
                         + clamp(deckFwd * capyDECK_LEAN, -0.20, 0.20);
    capyLeanTgt = leanTarget;
    // The speed lean damps on its OWN variable. Damping capyModel.rotation.x
    // toward the lean while the terrain pitch is also written into it would
    // feed the hill back into its own filter every frame.
    capyLean = damp(capyLean, lerp(leanTarget, capyLOAF_PITCH + capyNAP_PITCH * capyNap,
                                   capyLoaf), 8, dt);
    // The slide's nose-down goes on OUTSIDE the filter, beside the terrain
    // pitch, for the reason the comment above gives: capySlideW is already
    // damped on its own clock and running it through this one as well would
    // make getting down take half a second.
    // ...and the climb rides on OUTSIDE the lean filter, beside the terrain
    // pitch and the slide, for the reason those two are outside it: it has its
    // own clock (capyCLIMB_LAM) and running it through the lean's as well
    // would make getting onto a wall take a second and a half.
    capyModel.rotation.x = capyLean + capyPosePitch - capySLIDE_TILT * capySlideW
                           - capyCLIMB_PITCH * capyClimbPose;
    // ---- THE BREATH (R5), and it is the FOURTH TERM IN THIS WRITER --------
    // ON ITS OWN PHASE, not on `t`, because the rate changes three ways (idle
    // act 4 slows it, the loaf slows it further, and both can be part way in):
    // sin(t * rate) with a moving rate is a phase jump the size of the elapsed
    // session, and integrating the rate is continuous by construction.
    //
    // The weight is what the hand-off asked for and it replaces a step with a
    // ramp. It was `moving ? 0 : 1`, a binary on a 0.35 m/s threshold; it is
    // now zero in the air (capyAirPose) and faded out over the first stride,
    // so an animal creeping up on a picnic still breathes.
    capyBreathAmt = damp(capyBreathAmt,
                         clamp(1 - gaitSpeed / capyBREATH_STILL, 0, 1), 4, dt);
    // ...and the AIR GATE MULTIPLIES, it does not go through that filter. Put
    // inside it, the breath is still 36% alive at the top of a hop (measured:
    // -0.0036 against a resting 0.010), because lambda 4 is a quarter-second
    // time constant and a hop is shorter than that. capyAirPose is ALREADY a
    // damped channel, at 13, so this is still a cross-fade and not a step.
    const restW = capyBreathAmt * (1 - capyAirPose);
    // ...and slower again asleep (N4). The rate is the tell: a sleeping
    // animal at a loafing animal's rate is a loafing animal with its eyes shut.
    capyBreathPh += lerp(lerp(capyBREATH_HZ, capyBREATH_HZ_LOAF, capyLoaf), capyNAP_HZ, capyNap) *
                    (1 - capyIdleBreath * 0.44) * Math.PI * 2 * dt;
    if (capyBreathPh > Math.PI * 2) capyBreathPh -= Math.PI * 2;
    // Deeper when it has sat down, and deeper again on idle act 4, which is
    // the only readout the stamina system has. Both were already true; the
    // numbers are the hand-off's.
    capyBreath = Math.sin(capyBreathPh) * restW *
                 lerp(lerp(capyBREATH_Y, capyBREATH_Y_LOAF, capyLoaf), capyNAP_Y, capyNap) *
                 (1 + capyIdleBreath);
    // x and z share one number here because the squash does: `set(sqXZ, sqY,
    // sqXZ)` is one term for both, and 0.6% of fore-and-aft on a body that is
    // rising 1% is not something a person can see. Splitting them would cost a
    // second scale channel to say nothing.
    const sqY = 1 + capyPop * 0.38 + capyBreath;
    const sqXZ = 1 - capyPop * 0.19 + capyBreath * (capyBREATH_X / capyBREATH_Y);
    capySquash.scale.set(sqXZ, sqY, sqXZ);

    // ---- THE TAIL (R5) ---------------------------------------------------
    // It had no writer at all. A sway on the same rest weight the breath uses,
    // so the two agree about what resting is, and a flick on the wheek that
    // decays on its own. 0.25 rad on a 3.9 cm arm is 1 cm of nub: this reads at
    // arm's length and nowhere else, which is the honest size of a capybara's
    // tail and the reason it is two lines rather than a rig.
    capyTailFlick = damp(capyTailFlick, 0, capyTAIL_LAM, dt);
    capyTail = Math.sin(t * capyTAIL_HZ * Math.PI * 2) * capyTAIL_SWAY * restW
               + capyTailFlick * capyTAIL_KICK;
    tailPivot.rotation.x = capyTail;
    tailPivot.rotation.y = clamp(-capyYawRate * 0.06, -0.2, 0.2);
    // head: dips to grab / dig, tips up to wheek
    let headTarget = 0;
    if (carried) headTarget = -0.3;
    // ...and on a wall it looks UP it, which is where you are going and is the
    // one thing a climbing animal is unambiguously doing. It sits above the
    // grab and the whiff because both of those are reaches at the GROUND.
    else if (capyClinging) headTarget = -0.30;
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
    // ...plus the landing settle (R5), which is the fourth term on this line
    // and the only one that is not a want: it is what the body just did.
    // ...and the head goes down asleep (N4). ADDED, like the gaze and the
    // nod, so nothing about the pose stack changes for the ninety-nine per cent
    // of the time the animal is awake.
    head.rotation.x = capyHeadPitch + capyGazePitch + capyIdlePitch + capyHeadNod +
                      capyNap * capyNAP_HEAD;
    head.rotation.z = clamp(-capyYawRate * 0.05, -0.2, 0.2);
    // the look-around (see the idle beat) plus whatever is worth looking at.
    // Nothing else writes the head's yaw, and the mouth anchor is derived from
    // this euler further down — which is right: a capybara looking left has its
    // mouth on the left. That is also why the gaze is clamped and coned rather
    // than wrapped, and why a held prop resolves to a glance and not a target.
    // ...and the head LEADS a turn while the tail trails it (L3, E2): an S
    // through the spine from two nodes, on the yaw rate the roll already reads
    head.rotation.y = capyIdleYaw + capyGazeYaw + clamp(capyYawRate * 0.08, -0.26, 0.26);

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
    if (capyEarTimer <= 0) { capyEarTimer = rand(2.2, 5.5); capyEarFlick = 1; capyBlink = capyBLINK_DUR; }
    capyEarFlick = damp(capyEarFlick, 0, 7, dt);
    // ON THE TWO, on the way out. Render-only and nothing in src reads it yet:
    // it is published so a chapter or the card can answer a beat-landed hop
    // without capybara.js having to know what the answer looks like.
    if (capyBeatFlash > 0) capyBeatFlash = damp(capyBeatFlash, 0, 5, dt);
    const earBack = clamp(gaitSpeed * (running ? 0.115 : 0.075), 0, 0.88) +
                    (capySwimming ? 0.2 : 0) + capyIdleEar * 0.25;
    const flick = Math.sin(t * 34) * capyEarFlick * 0.5;
    const earDown = capyIdleEar * 0.34;
    // ...and they TURN toward whatever just happened (see capyHeardFrom).
    // BOTH swing the same way, which cups the near ear toward the sound and
    // turns the far one away from it — that asymmetry is what makes a pair of
    // ears read as listening rather than as two flaps on a timer. MEASURED at
    // 0.40 rad, 23 degrees, for a startle eight metres off the flank, and 0.007
    // for one at forty metres, which is out of earshot and must do nothing.
    // It decays here, so a single event is a turn and a return rather than a
    // pose the animal is left holding.
    capyEarTurn = damp(capyEarTurn, 0, 1.1, dt);
    const turn = capyEarTurn * 0.55;
    // ---- ...AND THEY LAG BEHIND THE BODY (D2) ----------------------------
    // The follow-through. An ear is a flap on a hinge and it does not know the
    // animal has jumped until the animal has: on the way up they trail, at the
    // apex they catch up, on the way down they lift. What is drawn is the
    // DIFFERENCE between the body's vertical velocity and a damped copy of it,
    // which is zero whenever the two agree — so walking, standing and a steady
    // fall all leave this term at nothing and only a change of vertical motion
    // shows. Clamped, because a solver spike is not a jump.
    capyEarLag = damp(capyEarLag, body.velocity.y, capyEAR_LAG_L, dt);
    const earWhip = clamp((body.velocity.y - capyEarLag) * capyEAR_LAG_K,
                          -capyEAR_LAG_MAX, capyEAR_LAG_MAX);
    // ...and they flop forward as the landing spring bottoms (L3, E2): the whip
    // only sees a change of vertical velocity, the settle is the body going down
    earL.rotation.x = -earBack - earWhip + capyLand * 0.9;
    earR.rotation.x = -earBack - earWhip + capyLand * 0.9;
    earL.rotation.y = turn;
    earR.rotation.y = turn;
    // ...and they go down and out asleep (N4), which is the one part of this
    // pose that reads at playing distance: a capybara's ears are the only thing
    // on it that points, and asleep they stop pointing.
    earL.rotation.z = -0.18 - flick - earDown - capyNap * capyNAP_EAR + turn * 0.35;
    earR.rotation.z = 0.18 + flick + earDown + capyNap * capyNAP_EAR + turn * 0.35;

    // ---- THE NOSE (v54) --------------------------------------------------
    // A capybara standing still was completely inert above the neck except for
    // a blink. The sniff is a one-shot: the pad swells, the whiskers come
    // forward, and it is over in a third of a second.
    //
    // It fires on a slow idle clock and, faster, when there is something in
    // reach worth smelling — which is a question the grab path already asks,
    // so it costs one call it was making anyway.
    capySniffT -= dt;
    if (capySniffT <= 0 && !capySwimming && !capyDiving) {
      const ph = game.physics;
      let close = false;
      if (!capy.heldProp && ph && typeof ph.nearestGrabbable === 'function') {
        const p = ph.nearestGrabbable(capyPosition, capySNIFF_R);
        close = !!p;
      }
      capySniffT = close ? rand(1.6, 3.4) : rand(5.0, 11.0);
      capySniff = 1;
    }
    if (capySniff > 0) {
      capySniff -= dt / capySNIFF_DUR;
      if (capySniff < 0) capySniff = 0;
    }
    // a half-sine, so it swells and settles instead of popping and easing
    const sn = capySniff > 0 ? Math.sin(capySniff * Math.PI) : 0;
    // The pad's pivot is inside the muzzle now (R3), so the z term is a much
    // smaller number for the same motion: the old 0.30 -> 0.40 on a 6.4 cm half
    // depth pushed the nose forward 6 mm, and 0.036 about a pivot 17 cm behind
    // the pad's face is the same 6 mm.
    nosePad.scale.set(1 + sn * 0.16, 1 + sn * 0.16, 1 + sn * 0.036);
    // ...and the whiskers come forward with it. Two terms: the sniff, and a
    // slow drift that runs all the time so they never look welded on.
    const wDrift = Math.sin(t * 1.7) * 0.05;
    whiskL.rotation.y = -sn * 0.34 + wDrift;
    whiskR.rotation.y = sn * 0.34 + wDrift;
    // ...and a fifth of the ears' whip, on the same difference (D2). A whisker
    // is lighter than an ear, so it lags less and settles sooner; a fifth is
    // what stops the two reading as one hinged plate.
    whiskL.rotation.z = sn * 0.20 - earWhip * 0.2;
    whiskR.rotation.z = -sn * 0.20 + earWhip * 0.2;

    // ---- THE FACE (D8) ---------------------------------------------------
    // Five authored states, one number, and the whole of what the eyes and the
    // brows are for. Positive is alarm and negative is cross-or-sleepy, and the
    // rank matters: ALARM WINS. An animal falling forty metres while it happens
    // to be tired is not sleepy, and the crowd's own face makes the same choice
    // (`mTgt = f > cross ? f : -cross`) for the same reason.
    //
    //   the wheek       +0.85  the mouth is open and so are the eyes
    //   the fall        +0..1  off the ACTUAL descent, not off the jump key, so
    //                          a dive that has levelled out stops looking scared
    //   the whiff       -0.70  a reach that found nothing
    //   the refusal     -0.55  a hop the legs would not give
    //   the loaf        -0.50  sat down, and the eyes go with it
    let moodUp = 0, moodDn = 0;
    if (capyWheekHold > 0) moodUp = 0.85;
    if (!grounded && !capySwimming && body.velocity.y < -6) {
      const f = clamp((-body.velocity.y - 6) / 10, 0, 1) * 0.9;
      if (f > moodUp) moodUp = f;
    }
    if (capyWhiffT > 0) moodDn = 0.70;
    if (capyRefuseT > 0 && moodDn < 0.55) moodDn = 0.55;
    if (capyLoaf * 0.50 > moodDn) moodDn = capyLoaf * 0.50;
    // ---- ...AND ONE OF THEM IS ABOUT SOMEBODY ELSE (F2) ------------------
    //
    // All five states above are things that happen to the ANIMAL'S OWN BODY —
    // its voice, its fall, its reach, its legs, its weight. So the face had no
    // opinion whatever about the only subject this game is about. It already
    // LOOKS at the joke: the gaze finds whoever is speaking and whoever has
    // noticed you, and the ears turn to a startle. It just had nothing to say
    // when it got there.
    //
    // Two events and no third. `capy:incident` is the game's own definition of
    // "that was three things in a row and somebody counted", and `npc:chase`
    // is the moment it stops being funny for the other party — between them
    // they are the mischief actually landing. Not `npc:startled`: that fires
    // several times a minute in a busy square and a face pinned wide for the
    // whole of Venice is not a reaction, it is a setting.
    //
    // 0.6 sits under the wheek's 0.85 on purpose. The wheek is the animal
    // doing something; this is the animal noticing what it has done, and the
    // ranking says so. It goes through the same asymmetric damp as everything
    // else here — fast in, slow out — so it reads as a beat rather than a
    // switch.
    if (capySmugT > 0 && moodUp < capyMOOD_SMUG) moodUp = capyMOOD_SMUG;
    const moodTgt = moodUp > moodDn ? moodUp : -moodDn;
    capyMood = damp(capyMood, moodTgt,
                    Math.abs(moodTgt) > Math.abs(capyMood) ? capyMOOD_IN : capyMOOD_OUT, dt);
    capy.mood = capyMood;
    capyBlink = capyBlink > 0 ? capyBlink - dt : 0;
    // ...AND ASLEEP THEY STAY SHUT (N4). `capyFacePose` already takes a 0..1
    // "how closed", and a nap is a blink that does not end — so this is the
    // greater of the two and there is no second eyelid channel to keep in step
    // with the first. The loaf's own -0.50 mood is still underneath it, which
    // is the brow, and a brow is worth having on a shut eye.
    capyFacePose(capyMood, Math.max(capyBlinkK(), capyNap));

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

    // ---- fx: the landing ring (P7) -----------------------------------
    // Flatter and faster than the wheek's: a pressure wave goes OUT and a
    // landing goes DOWN, so this one opens quickly and dies rather than
    // easing out, and its height term is a third of the wheek's.
    if (capyLandRing > 0) {
      capyLandRing -= dt * capyLAND_RING_RATE;
      if (capyLandRing < 0) capyLandRing = 0;
      const a = 1 - capyLandRing;
      const s = 0.30 + Math.sqrt(a) * (1.6 + capyLandK * 3.4);
      capyRingP.set(capyLandX, capyLandY, capyLandZ);
      capyRingS.set(s, capyLandRing * capyLandK * 0.5, s);
      capyRingQ.set(0, 0, 0, 1);
      capyRingM4.compose(capyRingP, capyRingQ, capyRingS);
      capyRingMesh.setMatrixAt(capyRING_COUNT + 1, capyRingM4);
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
