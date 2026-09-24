import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, rand, clamp, damp, lerp, roundBoxGeo } from './shared.js';

// ---------------------------------------------------------------------------
// AGENT B — THE CONDOR SIDEKICK (chapter 2).
//
// Summoned with a whistle, grabbed by the talons, flown by momentum: gravity
// pulls, forward speed buys lift, thermals over Galeras buy altitude. No rails,
// no scripted paths — every metre of altitude is bought with physics.
//
// Biome-neutral module: the condor exists only while Pasto is live, but it is
// owned here rather than by either biome set so the mount survives streaming.
//
// FLIGHT LAW (contract): every frame the body gets
//   gravity (world, never cancelled — see below)                      always
//   LIFT   = CL * m * v^2  perpendicular to the relative wind         trades speed for height
//   DRAG   = CD * m * v^2  along -(relative wind), CD bounded         eats energy
//   SIDE   = quadratic + linear along -span, capped at 0.30 g         no sideslip
//   PLUNGE = a damper through the wing plane, capped at 0.15 g        never carries the bird
//   TORQUE toward a commanded bank + pitch, plus a weathervane yaw     never a quaternion write
//   THERMAL columns from the live HOST's thermals                     the ONLY net climb
// Banking tilts the lift vector; the tilted lift curves the velocity; the
// weathervane drags the nose around after it. That is the whole turn.
//
// GRAVITY IS NEVER CANCELLED. Two places in this file used to do it and both are
// gone: the post-grab launch assist (`force.y += m*g*k` for 3.2 s, measured at
// +10.1 m and +157 J/kg of free energy on EVERY grab) is now thrust along the
// nose, gated on being below trim speed, and the whole launch window audits at
// -3.1 m and -78 J/kg in still air; the un-mounted AI's `+ m*g` (a true hover,
// vy = 0.00 held indefinitely) is now a wingbeat along the bird's OWN up axis
// with a beat's duty cycle on it, so a bank costs it cos(bank) and the altitude
// bobs. Every force in this module is a force in a direction the airframe or the
// wing actually has; none of them is the world's gravity with a minus sign.
//
// NOTHING IN THE FLIGHT PATH IS RANDOM. The stall wing-drop used to be seeded
// with rand() and it writes angular velocity, so identical initial conditions
// produced completely different flights and the module could not be measured.
// Every physics write here is now deterministic; rand() survives only in the
// summon, which chooses which side of the sky the bird arrives from.
// ---------------------------------------------------------------------------

let condorApi = null;
let condorGame = null;

// ---- tuning -----------------------------------------------------------------
// A 30 kg bird carrying a 30 kg capybara is a bird carrying half the suspended
// mass, not 136% of itself. Every aerodynamic force below is written per unit of
// TOTAL suspended mass so trim does not move when the passenger boards — the mass
// number only decides how much authority the passenger's own solver impulses have
// over the airframe, and at 22 kg the capybara was steering the condor.
const condorMASS = 30;
const condorRADIUS = 0.72;
// SILHOUETTE FIRST. The player watches this bird from directly overhead for the
// whole chapter, so it is proportioned for the top-down read, not for anatomy:
// span 4.6 m against 1.84 m nose-to-tail is a span:length of 2.5, i.e. a flying
// door with a small body hung under it, not a plus-sign.
const condorSPAN = 4.6;                 // wingtip to wingtip, metres
// Lift coefficient is per unit of TOTAL mass, so trim airspeed (sqrt(g / CL))
// does not change when 30 kg of capybara is bolted to the talons — the bird
// just works harder. At g = 24 this trims at ~16 m/s.
const condorCL = 0.107;
// 6% above the speed the lift curve trims at by itself, i.e. about 1.6x the stall.
// A glider carrying prey wants margin, not the best glide number: entering a 6 m/s
// column is a vertical gust, the bird pulls up into it and gives away 4-5 m/s, and
// starting that from 15 put it at 9 — under the bank protection's floor, unable to
// keep circling the lift it had just found.
const condorTRIM_V = Math.sqrt(24 / condorCL) * 1.06;   // ~15.9 m/s
const condorGLIDE_ANG = -0.092;          // rad, the steady-glide flight path (= CD0/CL)
const condorCD0 = 0.0098;               // parasitic — glide ratio ~10.9 at trim, ~1.4 m/s sink
// INDUCED DRAG WAS THE WHOLE BUG. At 1.35 a held stick (AoA 0.55) made a drag
// coefficient of 0.42 — 109 m/s^2 of deceleration at trim speed, five gravities
// of airbrake. The bird could not hold ANY commanded attitude without its
// airspeed collapsing to walking pace, which is exactly what was measured.
const condorCD_AOA = 0.18;              // induced, grows with angle of attack^2
const condorCD_SIDE = 0.62;             // quadratic span-wise drag (no sliding)
const condorCD_SIDE_LIN = 2.1;          // linear span-wise drag (kills slow slip)
// ...AND THE SAME LEASH THE PLUNGE TERM GOT. The span-wise term was uncapped, and
// it is exactly the same class of bug: it is measured against the RELATIVE wind,
// so a banked bird sitting in a column reads the updraft as sideslip and is handed
// a slab of "drag" pointing partly UPWARD. Measured from rest in Galeras that was
// 19.1 m/s^2 of upward force at ZERO airspeed — 80% of the bird's weight out of a
// dead wing — and in a tumble it swung between +34.8 and -53.6. It is a drag term:
// it may stop a slip, it may never carry the aircraft. 0.30 g only binds past
// 2.4 m/s of slip, which is a slip no coordinated turn ever has — measured, a
// thermalling turn holds well under a metre a second of it.
const condorSIDE_CAP = 0.30;            // in g — hard ceiling on the span-wise term
const condorCD_SEP = 0.10;              // extra, separated-flow drag past the stall
const condorCD_MAX = 0.26;              // flat-plate ceiling -> a dead wing falls at ~9.6 m/s
// THE PARACHUTE BUG. This term used to be 0.55 and uncapped, and it is applied
// along the WING NORMAL against the wind blowing through the wing plane. Inside a
// 6.4 m/s thermal that is 3.5 m/s^2 of free upward force with no airspeed at all,
// and it stacks on top of the (also uncapped) high-angle drag: between them a bird
// with a dead wing could carry its own weight and hang in the column at zero
// airspeed. A stalled bird MUST fall, so the plunge term is now a small damper
// with a hard ceiling of condorPLUNGE_CAP gravities. It can steady the wing; it
// can never hold the aircraft up.
const condorCD_PLUNGE = 0.30;           // damping through the wing plane
const condorPLUNGE_CAP = 0.15;          // in g — hard ceiling on the term above
const condorLIFT_CAP = 4.2;             // in g, so a flare cannot slingshot
// The elevator is G-LIMITED, not angle-limited. A bird hauling a capybara cannot
// pull the same angle of attack at 26 m/s that it can at 12 — the load would tear
// the wing off. So the commanded AoA is clamped to whatever makes condorG_LIMIT
// gravities at the CURRENT airspeed. Two things fall out of it for free: a hard
// pull at speed can no longer pin the wing at maximum induced drag (the airspeed
// collapse), and the stall becomes what it is in a real aeroplane — something you
// can only reach when you are already slow.
const condorG_LIMIT = 3.6;
// The elevator commands an ANGLE OF ATTACK, not an attitude. Commanding a raw
// pitch angle has no longitudinal stability: the nose holds while the velocity
// vector falls away from it, forward airspeed collapses, lift goes with it and
// the bird drops out of the sky nose-level. Riding the flight path is what
// makes the glide self-trimming and what makes a stall recoverable.
// AOA_MAX sits ABOVE the stall on purpose: a hard pull must be able to break the
// wing, or the stall branch below is dead code and the flap has nothing to save.
// AOA_MIN was -0.34, which put the wing at CL -0.36 in a push-over: the bird
// pushed itself DOWN with a drag coefficient four times cruise, so a dive
// converged on 22 m/s instead of the 28 the airframe is worth and the zoom climb
// out of it had nothing to spend. -0.15 is a real push-over, not an airbrake, and
// it is deliberately shallow enough that the trim reflex can catch it: the stick
// is a HEADING command, so "hold the stick toward the plaza" would otherwise be a
// permanent dive — measured, that glide ran a ratio of 1.1 and hit the ground 140
// m short of the square. Now the push buys speed and then runs out of authority.
// AOA_MIN IS THE PUSH-OVER AUTHORITY, AND IT IS THE OTHER HALF OF THE PHUGOID.
// At -0.15 the lift-curve shape bottoms out at 0.40, which at 18 m/s is still
// 0.58 g of lift: with the elevator hard against its stop the bird can only ever
// unload to 0.42 g, and it simply cannot rotate the flight path down fast enough
// to stop a zoom. MEASURED with the stop at -0.15, a pull-up over the plaza sailed
// to 48 degrees nose up with the elevator saturated nose-down the whole way and
// arrived at 5.4 m/s. -0.26 gives the wing a genuine unload and closes the loop.
// It is NOT the -0.34 this constant used to be: at -0.34 the shape goes NEGATIVE
// (the wing pushes the bird down with four times the cruise drag), which is what
// made a dive converge on 22 m/s instead of the 28 the airframe is worth. -0.26
// bottoms the shape at zero — a wing making no lift, which is the honest floor.
const condorAOA_MAX = 0.55, condorAOA_MIN = -0.26;
const condorAOA_STALL = 0.45;           // past here the wing lets go
// THE AUTOPILOT MAY NEVER STALL THE WING. The trim schedule below can ask for a
// lot of angle of attack when it is slow and heavy — and if it is allowed to ask
// for more than the wing can carry, the bird parks itself in a mush: lift gone,
// drag enormous, nose level, sinking like a dropped table. Measured, that is
// exactly what happened in a thermal (airspeed 15 -> 6 m/s in four seconds, angle
// of attack pinned at 0.6, 10 m/s of sink). The automatic part of the elevator is
// therefore clamped BELOW the stall; only a deliberate hard pull can break it.
const condorAOA_TRIM_MAX = condorAOA_STALL * 0.86;
// The angle of attack a sustained turn is allowed to be flown at. Lower than
// the trim ceiling on purpose: a turn that uses up the whole lift curve leaves
// nothing over for holding airspeed, and the airspeed is what the turn is made of.
// 0.30, not 0.24. This number is what the bank protection sizes the load factor
// from, so it decides how hard a SLOW bird is allowed to turn — and the plaza
// circle is flown at 11-13 m/s where 0.24 permitted only 20 degrees of bank. That
// is a 30 m turn radius, so every reversal back toward the column threw the bird
// 25 m outside a 13 m core and the climb died of geometry. 0.30 is still 0.15 rad
// clear of the stall and 0.09 under the automatic elevator's own ceiling, so the
// wing can genuinely hold it all day; measured, it buys 33 degrees at 11 m/s.
const condorAOA_SUSTAIN = 0.30;
const condorVMAX = 28;
const condorSTALL = 9.0;                // below this airspeed the wings beat
// 49 deg, not 60. A 60 deg bank is a 2 g turn, and 2 g at best-glide speed is
// more induced drag than this wing can pay for: the turn ate its own airspeed and
// spiralled in. 49 deg is 1.5 g, an 8 m turn radius at trim, and sustainable —
// which is the whole difference between being able to circle a thermal and not.
const condorMAX_BANK = 0.85;
const condorMAX_PITCH = 0.46;
const condorEDGE_SOFT = 112;
const condorEDGE_HARD = 130;
// How far inside pasto.bounds() the hard fence sits. Six metres, which is a
// little over the bird's own span, so the passenger swinging on the end of the
// talons is still over ground that exists. See condorFence.
const condorFENCE_PAD = 6;
// Only used if the chapter publishes no bounds() at all — the old symmetric
// square this file used to assume.
const condorFENCE_FALLBACK = { x0: -130, x1: 130, z0: -130, z1: 130 };
const condorBORED = 25;                 // seconds circling before it gives up
const condorINBOUND_T = 4.0;
const condorORBIT_HIGH_Y = 14.0, condorORBIT_HIGH_R = 9.5;
// A tight, HIGH pickup orbit: the grab used to happen 1.7 m off the deck, which
// a pure glider with 3.7 m/s of orbit speed spends in half a second. Higher and
// tighter buys the launch beat somewhere to go.
// 4.2, not 3.6, and the reach opens with it. The wingbeat is pure thrust now (see condorFLAP_THRUST) instead of
// 72% of the bird's weight straight up, so the launch out of the pickup is bought
// with airspeed rather than with a rocket — and airspeed takes a second or two and
// costs height while it is being bought. Measured off a 3.6 m grab the bird was
// back on the ground 2.2 s later every single time.
// 6.6, not 4.2. The old number was sized around a launch that cancelled gravity
// for three seconds — with that gone the bird leaves the pickup on nothing but
// airspeed, and airspeed at 52 kg costs height while it is being bought. Measured
// off a 4.2 m grab with an honest launch, half of all pickups put the pair back
// on the plaza (or into the bell tower) inside seven seconds. The grab is not
// free height: the bird climbs to this orbit under its own power BEFORE the
// capybara is on the talons, which is exactly where the energy is supposed to
// come from, and 6.6 m is still low enough to read as "it came down for you".
const condorORBIT_LOW_Y = 6.6, condorORBIT_LOW_R = 2.0;
// >= sqrt(R^2 + (Y - talonDrop)^2) = sqrt(4 + 5.62^2) = 5.96, with margin.
const condorREACH = 6.6;                // talon grab radius
const condorFLAP_T = 1.05, condorFLAP_COOL = 1.5;
// A WINGBEAT IS THRUST, NOT A ROCKET. The beat used to add mEff*g*0.72 straight up
// as well as thrust along the nose; at a 41% duty cycle that averages 15% of the
// bird's weight of free lift, which out-climbs every thermal on the map and kills
// the whole soaring mechanic. The vertical term is gone. What is left is forward
// thrust, sized against the cruise drag (2.2 m/s^2 at trim) so that HOLDING the
// flap in still air buys speed and a flatter glide but no net height.
const condorFLAP_THRUST = 9.0;          // m/s^2 along the nose, at the top of a beat
// The stick's fore/aft component is a TRIM SPEED command, not an elevator angle.
// As a raw angle-of-attack command it made "hold the stick toward where you are
// going" — the only way to steer to anywhere — into a permanent nose-down order,
// which is why every attempt to fly into a column ended in the side of the
// volcano. As a trim-speed offset it can only ask for a faster or slower cruise,
// both of which are stable, and the band is deliberately inside the 11-18 m/s the
// bird is supposed to thermal at.
const condorSTICK_V = 0.18;             // +/- fraction of trim speed the stick can bias
// How fast the pilot's wrist moves. See the note where the stick is read: these
// filter the PLAYER, never the aeroplane. 4.5 is a ~0.22 s rise into a turn;
// 9 is a ~0.11 s release out of one, because a control that is slow to centre
// reads as a control that is stuck.
const condorSTICK_ON  = 4.5;
const condorSTICK_OFF = 9.0;
// ---- THE CIRCLING SPEED ----------------------------------------------------
// The speed the bird aims for once it is banked over, i.e. once it is trying to
// stay inside something rather than get somewhere. See the block in the trim
// schedule: turn radius is v^2/(g tan phi), so this number and this number alone
// decides whether the bird fits inside a 13 m column. 13.2 m/s at the 43 deg the
// bank protection settles on is a 7.8 m radius; the old 17.2 was 14 m and did not
// fit. It sits 4 m/s above the wing's stall and 3 m/s above the acceptance floor,
// so the phugoid can swing around it without the wing ever letting go.
const condorCIRC_V = 13.2;
const condorCIRC_BANK0 = 0.30;          // rad of bank before the bird starts slowing
const condorCIRC_BAND = 0.42;           // ...and the band over which it fully commits
const condorTUCK_V = 0.82;              // shift-held: tuck and run, as a fraction of VMAX
const condorHANG = 1.45;                // talon-to-capy-centre separation
const condorLAUNCH_T = 3.2;             // seconds of fading launch beat after the grab
const condorLAUNCH_KICK = 12.0;         // m/s of forward beat, given to BOTH bodies
// THE LAUNCH IS THRUST, NOT A CANCELLED GRAVITY. This used to be `force.y +=
// mEff * g * launchLift` — the world's gravity switched off for 3.2 s after every
// single grab. Measured in still air with no column: +10.1 m of altitude and
// +157 J/kg of mechanical energy created from nothing, repeatable on every
// re-grab, i.e. farmable height, and flatly against the flight law at the top of
// this file. What a bird actually has coming out of a pickup is a few seconds of
// hard beating, so that is what it gets: thrust along the NOSE. It buys airspeed,
// the airspeed buys lift, and the drag takes it all back — nothing about it can
// hold the bird up on its own.
const condorLAUNCH_THRUST = 14.0;       // m/s^2 along the nose, only while below trim speed
// The un-mounted bird is under power too (it is beating its wings, and the
// animation says so), but its sustentation is a force along its OWN up axis with
// a wingbeat's duty cycle on it, never `+ m*g` in the world frame — see the AI
// branch. This is the depth of the beat, as a fraction of the mean.
const condorAI_BEAT = 0.30;
// ---- GROUND, AND THE PASSENGER HANGING UNDER IT ----------------------------
// The capybara hangs condorHANG + 0.98 = 2.43 m below the condor's centre of
// mass. Every terrain test in this file used to be run at the CONDOR's position,
// so the bird read 1.5 m of clearance while its passenger was already a metre
// inside the hillside — entering the Galeras crater below the rim that destroyed
// ~600 kg m/s of the pair's momentum in one frame against an applied impulse of
// (5, 6). It was a collision, not aerodynamics, and no aero term in this file can
// do it. The cure is not a bigger margin on the release, it is SEEING the ground:
// the autopilot samples the terrain under the PASSENGER, now and along the ground
// track, and pulls up (and beats) before anything touches.
const condorGND_CLEAR = 7.0;            // metres of passenger clearance it fights for
const condorGND_LOOK = 1.4;             // seconds of lookahead along the ground track
// ...BUT THE VERTICAL HORIZON IS SHORTER THAN THE HORIZONTAL ONE, and that
// asymmetry is a fix, not a fudge. Extrapolating the sink rate for the full 1.4 s
// says a bird 10 m over the flat plaza with 5 m/s of momentary sink is 1 m from
// the cobbles — MEASURED, gClear read 0.2 m at 10 m of real altitude, which put
// the avoidance loop's continuous wingbeat on at the bottom of every phugoid
// cycle. The beat is 9 m/s^2 of nose thrust; it pumped the phugoid instead of
// damping it and delivered the bird to the plaza column at 21 m/s in a dive,
// which is where the whole thermal failure starts. The bird can arrest a sink in
// about half a second by levelling the wings and pulling; it cannot make a
// mountain move. So the terrain is sampled the full 1.4 s down the ground track
// and the aircraft's own descent is only projected for condorGND_SINK_T.
const condorGND_SINK_T = 0.55;          // seconds of sink the bird cannot arrest
const condorGND_PATH = 0.30;            // rad of climb that ends a pull-up (17 deg)
const condorGND_LEAD = 0.33;            // seconds of flight-path rate the pull leads by
const condorCRATER_R = 11;              // contract: Galeras crater rim radius
const condorPEAK_MARGIN = 3.0;          // metres above the rim that counts as "over the peak"
// TELEPORT GUARD. A PointToPointConstraint at 1e6 of max force is a rigid rod:
// move ONE of the two bodies by a metre and the solver has to erase a metre of
// violation in one step, which it does by inventing a hundred metres a second.
// Anything that relocates the pair — a QA harness, a biome switch, a respawn,
// another module rescuing a stuck capybara — detonates the mount. So every frame
// the two anchor points are measured against each other, and past
// condorMOUNT_SNAP the passenger is simply carried to where it is supposed to be
// and handed the carrier's velocity, which is the same thing as moving both
// bodies together. The natural violation at the instant of the grab is ~1 m and
// must be allowed to converge on its own, so the threshold sits above it.
const condorMOUNT_SNAP = 2.2;           // metres of constraint violation before a resync
const condorMOUNT_VMAX = 28;            // = condorVMAX: past this it is not flight, it is a solver artefact
const condorGRACE_MAX = 9.0;            // safety expiry only — the drop ends on landing
const condorREGRAB_T = 2.0;             // seconds the talons stay shut after a release
const condorSETTLE_T = 0.35;            // seconds to unwind the tumble after touchdown
const condorPARK_Y = 200;               // where a despawned bird is parked, at rest

// ---- state ------------------------------------------------------------------
let condorState = 'gone';
let condorBody = null;
let condorGroup = null;
let condorTalonAnchor = null;
let condorConstraint = null;
let condorBuiltMesh = false;
let condorInWorld = false;

let condorStateT = 0;                   // seconds in the current state
let condorOrbitAng = 0;
let condorOrbitY = condorORBIT_HIGH_Y;
let condorOrbitR = condorORBIT_HIGH_R;
let condorOrbitYTarget = condorORBIT_HIGH_Y;
let condorOrbitRTarget = condorORBIT_HIGH_R;
let condorLowered = false;
let condorBoredT = 0;
let condorSpawnY = 0;
let condorSpawnR = 0;

let condorFlapT = 0, condorFlapCool = 0, condorFlapPhase = 0;
// THE AI'S BEAT, DRAWN (ROADMAP-WOW Part C). The seek loop below holds the
// un-mounted bird up with a sustentation force that already pulses on
// condorFlapPhase — and nothing drew it: condorFlapT is only ever set in
// mounted flight, so a summoned condor climbing forty metres on the inbound
// spiral did it with its wings held rigid. 0..1, how hard the AI is asking to
// climb, damped; condorAnimate blends the glide pose toward the beat by it.
// Level soaring stays a soar, which is what a condor mostly does.
let condorAiBeat = 0;
// (condorBankSm / condorPitchSm lived here and were damped every frame by the
// render pose without ever being read; condorSpeedSm and condorAoASm below are
// read by the trim loop and the stall term and are not the same thing.)
let condorSpeedSm = 0, condorAoASm = 0;
// render-only smoothing state — see condorRender()
const condorRENDER_L = 22;
const condorRENDER_SNAP2 = 6 * 6;
const condorRenderPos = new THREE.Vector3();
const condorRenderQ = new THREE.Quaternion();
const condorRenderTmpQ = new THREE.Quaternion();
let condorRenderInit = false;
let condorPathPrev = 0, condorPathRate = 0;   // flight-path rotation, fed forward to the elevator
let condorTurnSign = 1;                       // which way it committed to go round — see the reversal note
// The filtered stick, in camera space. Zeroed on every spawn so a new bird is
// never born mid-input; see condorSTICK_ON.
let condorStickX = 0, condorStickZ = 0;
let condorSyncHold = 0;                       // frames of velocity hold after a mount repair
let condorStuckT = 0;                         // seconds pinned against scenery with a passenger
let condorWindT = 0;
let condorLaunchGrace = 0;
let condorLaunchLift = 0;               // 1 -> 0 over condorLAUNCH_T, fades the pickup assist
let condorLandSpeed = 0;
let condorSummonedOnce = false;
let condorRodeOnce = false;
// The ride ticks after this long in the talons, not on the grab (W1). Twelve
// seconds is past the launch and the first thermal — the animal is a hundred
// metres up and the town is a map — and short enough that a bird that mushes
// into the hillside early still pays out on the second go.
const condorRIDE_T = 12;
let condorStalled = false;
// ---- THE TALONS DO NOT TAKE IT STRAIGHT BACK -------------------------------
// condorTryMount counts "a leap into the talons" as any capybara inside the reach
// that is off the ground with more than 0.6 m/s of climb — and the instant after a
// release the capybara IS inside the reach (it is hanging 2.43 m under them) and
// it HAS the bird's velocity, so releasing during a climb re-grabbed on the very
// next frame. MEASURED, letting go at 30 m in the plaza column put the pair back
// on the talons inside five seconds, every time, and the player could not get off.
// The same loop would have caught an auto-release too. So the talons are shut for
// long enough that the passenger has to have actually fallen away.
let condorRegrabT = 0;
let condorGrabRelease = false;  // a dismount's held key must be released first
// ---- THE BIRD CAN BE CAUGHT (TEN T1e, `noCondorOpen`) ----------------------
// Measured on a fresh file at the plaza spawn (qa/ten-t1e-diag.js): a leap took
// the talons, the pair flew into a stall 3 s later, and the released bird sat
// 1.9 m over the paving, jammed under the stall's roof, at 0.2 m/s, for as long
// as anyone watched. `circling`, `lowered`, the orbit asking for 6.6 m, and the
// seek pushing it straight up into the canvas. talonInReach() read false every
// frame, because condorPickupReady wants 4 m of air under the bird, and the
// paper went on saying "hold E under it". The reviewer's run at rung 3 saw the
// same bird on the plaza, 0 of 100 samples in reach.
//
// Three repairs, none of which touches the flight model:
//  - the orbit's height is never less than condorOPEN_LIFT over whatever is
//    under the seek point (terrain or townscape, condorGroundTop) plus the hang;
//  - a watchdog: lowered, circling and not ready for condorOPEN_T in a row, it
//    goes and circles over the nearest open piece of sky instead of the animal;
//  - and a jammed bird gets out: its contacts are switched off (condorGhostT)
//    until it is clear of anything a stall could be, then switched back on.
const condorOPEN_LIFT = 3.5;            // metres of sky kept under the talons
const condorOPEN_T = 3.0;               // seconds lowered-but-not-ready before it moves
const condorOPEN_GIVE_UP = 35;          // the animal wandered off: follow it again
const condorPIN_V = 1.5;                // m/s: slower than this, that low, it is jammed
const condorGHOST_AGL = 4.5;            // a stall roof is ~3 m; clear of that, collide again
let condorOpenT = 0;                    // the watchdog's clock (condorAudit().stuckT)
let condorOpenOn = false, condorOpenX = 0, condorOpenZ = 0;
let condorOpens = 0;                    // re-centres, per summon
let condorOpenSaid = false;             // the line is said once per summon
let condorGhostT = 0;                   // > 0 while it climbs out with no contacts
let condorPins = 0;                     // times it was found jammed, per summon
// ---- THE SUMMON SHOT (TEN T1e, `noSummonShot`) -----------------------------
// The call spawns the bird 46 m out at a random bearing and 56 m up and nothing
// looked at it: the reviewer's frame said "look at the size of that thing" over
// empty paving, the bird behind the lens. Once per chapter visit, the first
// time the inbound bird comes inside condorSHOT_R, the lens is turned to put it
// over the animal; the whistle gets an answer 0.6 s after it is blown.
const condorSHOT_R = 30;
const condorSHOT_LEAD = 1.4;            // seconds of flight the yaw is aimed ahead by
let condorShotVisit = false;            // latched per chapter visit
let condorShotArmed = false;            // this summon may still take the shot
let condorShots = 0;
let condorEchoT = 0;                    // > 0: the answering wheek is pending
// ---- THE ROLL (L1) ---------------------------------------------------------
// Twelve seconds of hanging on was the marquee, and the bird could already
// flap (Q), tuck (Shift) and steer. Space while carrying, with air under the
// wings, is a barrel roll: the drawn bird goes round its own nose once in a
// second and a quarter, the score gets a note, and the paper counts them. It
// is a render-side rotation — the physics keeps flying straight, the talons
// keep the animal, and nothing can fall off — which is the only kind of stunt
// a game about being carried can afford.
const condorROLL_T = 1.25;
const condorROLL_V = 13.0;              // m/s of airspeed it wants
let condorRollT = 0, condorRolls = 0, condorRollCool = 0;
const condorRollQ = new THREE.Quaternion();
const condorRollAxis = new THREE.Vector3(0, 0, 1);
let condorPeakDone = false;             // latch: the soaring task fires exactly once
let condorBestAGL = 0;                  // best height over the ground while carried

let condorRimY = 0;                     // crater rim altitude, measured off the terrain once

// hanging-capybara pendulum: a real 2-axis DOF, integrated here because
// capybara.js hard-locks its own body roll/pitch every frame (see condorSwingCapy)
let condorPendOX = 0, condorPendOZ = 0, condorPendVX = 0, condorPendVZ = 0;
let condorPivAX = 0, condorPivAZ = 0, condorPrevVX = 0, condorPrevVZ = 0;
// tumble seeded by the drop, unwound over condorSETTLE_T on touchdown
let condorTumbleX = 0, condorTumbleY = 0, condorTumbleZ = 0;
let condorYawOff = 0, condorSettleT = 0;

// wing rig: [{ shoulder, elbow, wrist, fan, sign }]
const condorWings = [];
let condorHeadPivot = null;
let condorTailPivot = null;
let condorTailFan = null;

// ---- scratch (module top — zero allocation inside update) --------------------
const condorFwd = new CANNON.Vec3();
const condorUp = new CANNON.Vec3();
const condorSide = new CANNON.Vec3();
const condorTmpA = new CANNON.Vec3();
const condorTmpB = new CANNON.Vec3();
const condorTalonW = new CANNON.Vec3();
const condorTalonLocal = new CANNON.Vec3(0, -0.98, 0.04);
const condorCapyPivot = new CANNON.Vec3(0, condorHANG - 0.98, 0);
const condorLocalFwd = new CANNON.Vec3(0, 0, 1);
const condorLocalUp = new CANNON.Vec3(0, 1, 0);
const condorLocalSide = new CANNON.Vec3(1, 0, 0);
const condorQInv = new CANNON.Quaternion();
const condorVelSnap = new CANNON.Vec3();
const condorRel = new CANNON.Vec3();
const condorSeek = new CANNON.Vec3();
const condorHeadDir = new CANNON.Vec3();
// T1e: the open-sky search's one ray, allocated once
const condorRayFrom = new CANNON.Vec3();
const condorRayTo = new CANNON.Vec3();
const condorRayRes = new CANNON.RaycastResult();
const condorMomArm = new CANNON.Vec3();
const condorMomF = new CANNON.Vec3();
const condorSyncVel = new CANNON.Vec3();
const condorObsLo = new CANNON.Vec3();
const condorObsHi = new CANNON.Vec3();
const condorObsOff = new CANNON.Vec3();
const condorObsQ = new CANNON.Quaternion();

// ---- WHAT IS BUILT ON THE GROUND IS PART OF THE GROUND ----------------------
// Every terrain test in this file asks pasto.terrainHeight, which knows about the
// volcano and nothing else — and the plaza thermal that is the player's ONLY route
// to altitude is sited 24 m from an 18.3 m bell tower and 15 m from the church
// roof. MEASURED, that is what actually ended the flight: the capybara, hanging
// 2.43 m under the bird, struck the tower at (-7.9, 15.9, 40.0) doing 3.4 m/s; the
// pair went from 12.1 to 6.4 m/s in a fifth of a second, the reaction through the
// talon constraint rolled the bird from 44 degrees right to 108 degrees LEFT, and
// it fell inverted into the square. No aerodynamic term in this file can do that,
// and no aerodynamic tuning can prevent it. The bird has to be able to SEE the
// building, exactly as it already sees the hillside.
//
// So the static scenery is reduced, once per summon, to a list of discs with a
// height: for each shape of each zero-mass body, the world AABB's footprint and
// its top. Per-SHAPE and not per-body on purpose — the church is one body of 15
// shapes whose combined box is 23 m across and 18.3 m tall, which would have
// walled off half the thermal; the tower is one 5.8 m shape inside it.
// It is a build-time scan (a few dozen shapes, on a whistle), and the flight path
// only ever reads the finished table.
// A BOX, NOT A DISC. The first cut stored one radius, max(rx, rz) — and the
// colonial street's terrace is a 69 m long wall 7 m deep, which became a 37 m
// disc centred on the town that swallowed the plaza thermal whole. The bird then
// flew the entire chapter believing it was 10 m underground, hauling and beating
// against an obstacle that was not there, and wandered 90 m off the column. An
// AABB is a box; test it as a box.
const condorOBS_MAX = 64;
const condorOBS_STRIDE = 5;
const condorObs = new Float32Array(condorOBS_MAX * condorOBS_STRIDE);   // cx, cz, rx, rz, top
let condorObsN = 0;
const condorOBS_MIN_H = 4.0;    // below this it is furniture; the bird flies over it
const condorOBS_PAD = 2.3;      // half a wingspan of margin on the footprint
const condorOBS_SPAN = 40;      // wider than this is the terrain itself, not a prop
// A ROOF IS NOT A MOUNTAIN. condorGND_CLEAR is 7 m because a hillside keeps on
// rising past where the bird can see; a bell tower stops. Charging the full 7 m
// against the church made the approach to the plaza column read as an emergency
// from 18 m up — MEASURED, the avoidance wingbeat ran the whole way in, the bird
// crossed the column at 22 m/s instead of 16 and then zoomed to 3.3 m/s of
// airspeed on the far side. So a built obstacle is entered into the table a
// little lower than it stands. It can never read below the real terrain.
//
// THE SLACK IS CHARGED AGAINST THE PASSENGER, NOT THE BIRD. The capybara hangs
// condorHANG + 0.98 = 2.43 m below the talons, so the clearance the autopilot
// actually delivers over a roof is GND_CLEAR - SLACK - 2.43. At the original
// 3.0 that left 1.57 m, and a phugoid eats that in one cycle: measured, the
// church roof (collider top 8.9 m) was entered into the table at 5.9, the bird
// flew a 1.29 m "clearance" and put its passenger 1.71 m INSIDE the roof, which
// killed roughly half of all pickups from the plaza. 1.0 keeps a built obstacle
// less alarming than a hillside while leaving the passenger 3.6 m of air.
const condorOBS_SLACK = 1.0;

// Fallback thermals, used only if pasto.js has not published any yet. Sited on
// the contract's Galeras layout so the mechanic is never dead.
const condorFallbackThermals = [
  { x: -40, z: -70, radius: 26, strength: 30, top: 86 },
  { x: -18, z: -44, radius: 18, strength: 21, top: 58 },
  { x: 34, z: 4, radius: 16, strength: 15, top: 44 },
];
// UNITS. pasto.js documents and authors `strength` as the updraft ACCELERATION in
// m/s^2 at the column axis (13..30). This module models a thermal as a moving
// AIRMASS — the only formulation in which a glider can circle up a column instead
// of being slammed to airmass speed — so it needs an updraft SPEED. The two are
// reconciled here, in the consumer, because pasto.js is not this agent's file:
// speed = FLOOR + acceleration / ACC_PER_MS. The intercept exists because pasto's
// authored strengths only span 2.3x (13..30) while this bird's usable band is
// bounded below by its 1.5 m/s sink: a pure ratio either makes the plaza column
// dead or makes Galeras a rocket. The map puts 13..30 onto 4.6..6.4 m/s of
// airmass on the axis, against a MEASURED 2.1..2.7 m/s of sink in a thermalling
// turn — about 1 m/s of net climb in the weakest column and 3 in Galeras.
// 4.1, not 3.2. MEASURED against the finished aircraft: a 52 kg glider holding a
// 43 degree turn sinks at 1.6-1.9 m/s, and the plaza column — the weakest on the
// map at strength 13, and the ONLY lift a player can reach from the spawn — was
// mapping to 4.57 m/s on the axis and less than 3 anywhere a real circle passes.
// Against 1.9 of turning sink that is about a metre a second of climb IF the bird
// flies a perfect circle on the axis, and nothing at all for a player weaving in
// and out of it: the measured climb was 0.4 m/s and it asymptoted at 28 m against
// a 44 m column. The weakest thermal on the map has to be worth flying badly.
const condorTHERMAL_ACC_PER_MS = 9.5;
const condorTHERMAL_FLOOR = 4.1;
// Hard cap, so a column authored in any units cannot fire the bird into orbit.
// At 9 m/s against a 16 m/s trim airspeed the flight path is 29 deg up, which the
// attitude loop can actually hold; 22 saturated the AoA clamp and read as broken.
const condorTHERMAL_MAX = 9;

/** Lift-curve shape vs angle of attack. 1.0 at the trim AoA; lets go past the stall. */
function condorCLShape(aoa) {
  let s = 1 + aoa * 4.0;
  if (aoa > condorAOA_STALL) {
    // a real break, not a shrug: 0.10 rad past the stall costs 40% of the lift
    s = (1 + condorAOA_STALL * 4.0) * Math.max(0.20, 1 - (aoa - condorAOA_STALL) * 4.0);
  }
  return clamp(s, 0.05, 2.4);
}

/** Drag coefficient vs angle of attack, per unit of suspended mass. Bounded, so
 *  the wing broadside to the airflow is a parachute at ~9.6 m/s and not a floor. */
function condorCDShape(aoa) {
  const a = clamp(aoa, -1.45, 1.45);
  const m = a < 0 ? -a : a;
  let cd = condorCD0 + condorCD_AOA * a * a;
  if (m > condorAOA_STALL) cd += condorCD_SEP * (m - condorAOA_STALL);
  return cd > condorCD_MAX ? condorCD_MAX : cd;
}

/** Angle of attack that trims exactly `n` gravities at airspeed `v` (inverts the
 *  linear part of condorCLShape). This is the whole speed-stability mechanism:
 *  the slower the bird gets the more it asks for, the ask saturates below the
 *  stall, lift falls short of weight, and the nose goes down all by itself. */
function condorTrimAoA(n, v, g) {
  const shape = clamp(n * g / (condorCL * v * v), 0.05, 2.4);
  return (shape - 1) * 0.25;
}

// =============================================================================
// PUBLIC
// =============================================================================
export function createCondor(game) {
  condorGame = game;

  const api = {
    active: false,
    mounted: false,
    // ---- HOW THIS ONE HOLDS YOU (D8) --------------------------------------
    // capybara.js draws a carry three different ways and cannot tell a bird
    // from a gardener without being told. This is hung by the middle in a pair
    // of talons, for up to a minute — so the flail is a BEAT and what follows
    // it is a hang. See WHO IS HOLDING YOU in capybara.js.
    hold: 'talons',
    state: 'gone',
    group: null,
    body: null,
    talonAnchor: null,
    summon() { return condorSummon(); },
    /**
     * True when the next press of the action key will board the bird.
     * capybara.js asks this BEFORE it throws whatever is in the mouth: it runs
     * earlier in the frame than condor.js, so the same press used to do both —
     * the empanada went one way, the capybara went the other, and 'Post
     * something into the crater' was unreachable by the only route that gets
     * you to the crater. Cheap and allocation-free; safe to call every frame.
     */
    talonInReach() { return condorTalonInReach(); },
    /**
     * DOES THE LIVE CHAPTER HAVE A FLIER? The same question condorHost() asks,
     * published because systems.js has to ask it too and was asking a different
     * one — `inPasto`. The flight rig, the altimeter's altitude and the shadow
     * box's altitude were all gated on the chapter NAME, written when one
     * chapter had a bird; Rio has had one since the second flier landed, so
     * riding the fragata put a 20 m/s glide behind the ground rig, pegged the
     * altimeter at the 26 m relief cap and left the shadow box on the datum
     * under an animal a hundred metres above it.
     *
     * A predicate and not the host object, deliberately: nothing outside this
     * file has any business reaching into a chapter's flier contract, and a
     * boolean cannot be held past the frame it was asked on. Allocation-free.
     */
    hosted() { return !!condorHost(); },
    /**
     * LET GO OF THE PASSENGER, FROM OUTSIDE. The only caller is the void
     * rescue in systems.js: a rescue that teleports the capybara while the
     * constraint is still live drags it straight back to the talons, so
     * whatever has hold of it has to be told first. Safe at any time — it
     * returns false when there is nothing to release.
     */
    release() { return condorRelease(true); },
    /**
     * WHERE IT WILL COME DOWN, if that is not over the animal (T1e). The open
     * point the watchdog chose, or null while the orbit is following the
     * animal. The bird itself flies there, so the paper's arrow on the bird is
     * already right; this is for anything that wants the spot, not the bird.
     */
    openSpot() { return condorOpenOn ? { x: condorOpenX, z: condorOpenZ } : null; },
    /** Harness and soak only; nothing in src reads it. stuckT is the watchdog's
     *  clock and must never sit past condorOPEN_T for long. */
    condorAudit() {
      return { state: condorState, lowered: condorLowered, stuckT: +condorOpenT.toFixed(2),
               opens: condorOpens, open: condorOpenOn ? [+condorOpenX.toFixed(1), +condorOpenZ.toFixed(1)] : null,
               pins: condorPins, ghost: +condorGhostT.toFixed(2), ready: !!condorBody && condorApi.active && condorPickupReady(),
               talon: +Math.min(99, condorTalonDist()).toFixed(2), shots: condorShots,
               carryStuckT: +condorStuckT.toFixed(2),
               // the attitude and the force the last substeps flew on, per kg
               upY: condorBody ? +(1 - 2 * (condorBody.quaternion.x * condorBody.quaternion.x +
                                            condorBody.quaternion.z * condorBody.quaternion.z)).toFixed(2) : 0,
               fy: +(condorFrameF.y / condorMASS).toFixed(2), holds: condorHoldN, aiT: +condorAiT.toFixed(2) };
    },
    update(dt) { condorUpdate(dt); },
  };
  condorApi = api;
  game.condor = api;

  condorBuild(game);

  // The constraint solver's answer for the dangling capybara is destroyed a few
  // lines later by capybara.js's own ground controller (it clamps horizontal
  // speed to walking pace). Snapshot the honest post-step velocity here and put
  // it back in update() — condor.update runs after capy.update.
  if (game.world && game.world.addEventListener) {
    game.world.addEventListener('postStep', condorOnPostStep);
    // The mount repair has to run BEFORE the solver, not before this module's
    // update: main.js steps the world first and calls the updaters afterwards, so
    // a teleport that happens between frames is already through the constraint
    // solver — and out the other side at 90 m/s — by the time update() sees it.
    game.world.addEventListener('preStep', condorGuardPreStep);
    game.world.addEventListener('preStep', condorHoldForces);   // T1e
    game.world.addEventListener('postStep', condorCountStep);   // T1e
  }

  // ---- AND THE LAST NAMED REFERENCE, WHICH A GREP FOR `game.pasto` MISSES --
  // This read `e.name !== 'pasto'`, so the bird went away on entering anywhere
  // that was not Pasto — which, with one host, is the same thing as "a bird
  // belongs to the chapter that summoned it".
  //
  // THE OBVIOUS TRANSLATION IS WRONG, AND IT WAS MEASURED WRONG. Rewriting it
  // as `if (!condorHost()) condorDespawn()` keeps the bird alive across a
  // border between TWO hosts: flying Rio's fragata, stepping through the
  // departures board into Pasto, and arriving with a black bird with a scarlet
  // throat circling Galeras — carrying Rio's plumage, hunting thermals that are
  // two chapters away, inside a fence that has moved. It also swallowed the
  // arrival whistle, because a bird already in `circling` takes the
  // second-whistle branch and returns before the summon can tick anything.
  //
  // A bird belongs to the chapter it was called in. It goes away at EVERY
  // border, exactly as it always did; the host only decides whether a new one
  // can be called on the other side.
  game.events.on('biome:enter', function () {
    condorShotVisit = false;                 // the summon shot is once per visit
    if (game.state) game.state.flierWhistleT = 0;
    condorDespawn(true);
    if (condorHost() && condorState === 'gone') condorDetachBody();
  });

  return api;
}

// =============================================================================
// BUILD — one condor, built once, reused forever
// =============================================================================

/** Run fn with anything it adds tagged to a private set the streamer never touches. */
function condorCapture(game, fn) {
  if (game.biome && typeof game.biome.capture === 'function') return game.biome.capture('condor', fn);
  return fn();
}

function condorBuild(game) {
  if (condorBuiltMesh) return;
  condorBuiltMesh = true;

  condorGroup = new THREE.Group();
  condorGroup.name = 'condor';
  condorGroup.visible = false;
  condorBuildMesh(condorGroup);
  condorCapture(game, function () { game.scene.add(condorGroup); });

  condorBody = new CANNON.Body({
    mass: condorMASS,
    shape: new CANNON.Sphere(condorRADIUS),
    material: (game.mats && game.mats.prop) || undefined,
    linearDamping: 0,          // all drag is modelled explicitly
    angularDamping: 0.42,
    allowSleep: false,
  });
  condorBody.position.set(0, 60, 0);
  condorBody.previousPosition.copy(condorBody.position);
  condorBody.interpolatedPosition.copy(condorBody.position);
  condorBody.updateMassProperties();
  condorBody.addEventListener('collide', condorOnCollide);

  condorApi.group = condorGroup;
  condorApi.body = condorBody;
  condorApi.talonAnchor = condorTalonAnchor;
}

// ---------------------------------------------------------------------------
// DRAW-CALL BUDGET. The bird used to be 33 separate meshes — 66 draws with
// shadows, ~30% of the whole 220 budget — and most of them were rigidly parented
// and could never move relative to each other. Everything rigid is merged into
// one BufferGeometry per articulated part, the same way pasto.js does it, with
// the palette colour written into a per-vertex `color` buffer so one flat
// Lambert material still covers several palette entries. Result: 9 meshes.
//
// BufferGeometryUtils is not importable under the contract, so the concatenation
// is hand-rolled. Build-time only — nothing here runs per frame.
// ---------------------------------------------------------------------------
const condorBASE = new THREE.Color(PALETTE.condorRuff);   // lightest entry used
function condorUnbase(c) { c.r /= condorBASE.r; c.g /= condorBASE.g; c.b /= condorBASE.b; return c; }

/** parts: [{ g: BufferGeometry, c: paletteHex, m: Matrix4|null }] -> one geometry. */
function condorMerge(parts) {
  const tmp = new THREE.Color();
  const flat = [];
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const g = p.g.index ? p.g.toNonIndexed() : p.g.clone();
    if (p.m) g.applyMatrix4(p.m);
    g.computeVertexNormals();
    flat.push({ g: g, c: p.c });
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
    tmp.setHex(flat[i].c);
    condorUnbase(tmp);
    for (let k = 0; k < n; k++) {
      const s = k * 3, d = (o + k) * 3;
      pos[d] = pa[s]; pos[d + 1] = pa[s + 1]; pos[d + 2] = pa[s + 2];
      nor[d] = na[s]; nor[d + 1] = na[s + 1]; nor[d + 2] = na[s + 2];
      col[d] = tmp.r; col[d + 1] = tmp.g; col[d + 2] = tmp.b;
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

/** Build-time transform helper for condorMerge parts. */
function condorXf(px, py, pz, rx, ry, rz, sx, sy, sz) {
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0));
  return new THREE.Matrix4().compose(
    new THREE.Vector3(px || 0, py || 0, pz || 0), q,
    new THREE.Vector3(sx === undefined ? 1 : sx, sy === undefined ? 1 : sy, sz === undefined ? 1 : sz));
}

/** One vertex-coloured flat Lambert mesh from a parts list. */
function condorPart(parts, round) {
  const m = new THREE.Mesh(condorMerge(parts), mat(PALETTE.condorRuff, { vertexColors: true }));
  m.castShadow = true;
  if (round) condorRoundOn(m, parts);
  return m;
}
// THE ROUNDED BIRD (AAA pass). The body and the head get a twin in which every
// box of 4.5 cm or more is the same box with its edges off (roundBoxGeo, a
// chamfer at 0.4 of its thinnest side), handed to the rounded person's switch
// (npc.js, game.personRound): a condor with a barrel, not a crate, on the same
// flag and rung. The wings stay slabs: they are feathers, and they flap.
function condorRoundOn(m, parts) {
  if (!condorGame || !condorGame.personRound) return;
  const tw = parts.map(function (p) {
    const q = p.g.type === 'BoxGeometry' ? p.g.parameters : null;
    if (!q || Math.min(q.width, q.height, q.depth) < 0.045) return p;
    return { g: roundBoxGeo(q.width, q.height, q.depth, 0.4, 2), c: p.c, m: p.m };
  });
  condorGame.personRound(m, condorMerge(tw));
  m.userData.roundAnimal = true;
}

// ---- PLUMAGE, AND IT BELONGS TO THE HOST ----------------------------------
// Six colours, which is the whole difference between an Andean condor and a
// magnificent frigatebird as far as this mesh is concerned: the silhouette of a
// big soaring bird is the same bird everywhere, and it is the plumage that says
// which one. A host publishes `flier: { plume: {...} }` and gets its own; a host
// that does not publish one gets the condor, which is what Pasto does by saying
// nothing at all.
//
// Deliberately NOT in PALETTE. shared.js's palette is the game's, and a bird
// that belongs to one chapter belongs in that chapter's file next to everything
// else about it — the same rule the grade rows and the ambience rows keep.
const condorPLUME_CONDOR = {
  wing: PALETTE.condorWing, body: PALETTE.condorBody, ruff: PALETTE.condorRuff,
  skin: PALETTE.condorHead, beak: PALETTE.condorBeak, comb: PALETTE.condorComb,
};
let condorPlumeNow = null;      // what is actually baked into the mesh right now

/** The live host's plumage, or the condor's. */
function condorPlumeOf(host) {
  const f = host && host.flier;
  const p = f && f.plume;
  if (!p) return condorPLUME_CONDOR;
  return {
    wing: p.wing === undefined ? condorPLUME_CONDOR.wing : p.wing,
    body: p.body === undefined ? condorPLUME_CONDOR.body : p.body,
    ruff: p.ruff === undefined ? condorPLUME_CONDOR.ruff : p.ruff,
    skin: p.skin === undefined ? condorPLUME_CONDOR.skin : p.skin,
    beak: p.beak === undefined ? condorPLUME_CONDOR.beak : p.beak,
    comb: p.comb === undefined ? condorPLUME_CONDOR.comb : p.comb,
  };
}

/**
 * RE-PLUME FOR THE LIVE HOST. Called from the summon and from nowhere else:
 * it is the one moment the bird is guaranteed not to be on screen, and it
 * happens about once a chapter rather than once a frame.
 *
 * The colours are baked into a MERGED geometry with vertexColors, so this is a
 * rebuild rather than a material write — and the rebuild is safe because the
 * only state condorBuildMesh owns is the wing rig and three pivots, all of
 * which are cleared here. Anything holding a reference to condorGroup (the
 * scene graph, condorApi.group) keeps it: the group survives, its children do
 * not.
 */
function condorRePlume() {
  if (!condorGroup) return;
  const want = condorPlumeOf(condorHost());
  if (condorPlumeNow &&
      condorPlumeNow.wing === want.wing && condorPlumeNow.body === want.body &&
      condorPlumeNow.ruff === want.ruff && condorPlumeNow.skin === want.skin &&
      condorPlumeNow.beak === want.beak && condorPlumeNow.comb === want.comb) return;
  for (let i = condorGroup.children.length - 1; i >= 0; i--) {
    const c = condorGroup.children[i];
    condorGroup.remove(c);
    c.traverse(function (o) {
      if (o.geometry && o.geometry.dispose) o.geometry.dispose();
      if (o.material && o.material.dispose) o.material.dispose();
    });
  }
  condorWings.length = 0;
  condorHeadPivot = null; condorTailPivot = null; condorTailFan = null;
  condorBuildMesh(condorGroup, want);
}

function condorBuildMesh(root, plume) {
  const P = plume || condorPLUME_CONDOR;
  condorPlumeNow = P;
  const DARK = P.wing;
  const BODY = P.body;
  const RUFF = P.ruff;
  const SKIN = P.skin;
  const BEAK = P.beak;
  const COMB = P.comb;

  // --- BODY: short and deep, all of it forward of the wing root. The old torso
  //     was 1.30 m of box plus a 0.36 m rump aft of the shoulders, which is what
  //     turned the overhead read into a plus-sign. Everything behind the wing is
  //     tail now. Legs and toes fold into the same merged mesh.
  const legX = 0.15;
  const bodyParts = [
    { g: new THREE.BoxGeometry(0.58, 0.48, 0.75), c: BODY, m: condorXf(0, 0, -0.05) },
    { g: new THREE.SphereGeometry(0.30, 8, 6), c: BODY, m: condorXf(0, -0.02, 0.34, 0, 0, 0, 1, 0.92, 1.05) },
    // THE WHITE IS A COLLAR, NOT A PLUMAGE. An Andean condor is a black bird with
    // a white ruff at the throat and a white flash on the upper wing; the previous
    // build ran condorRuff down the full length of both wing panels and across the
    // whole back, and from directly overhead — the only angle the player ever sees
    // — it read as a seagull. Everything aft of the throat is near-black now.
    { g: new THREE.SphereGeometry(0.30, 8, 6), c: RUFF, m: condorXf(0, 0.14, 0.50, 0, 0, 0, 1.16, 0.88, 0.88) },
    { g: new THREE.BoxGeometry(0.44, 0.10, 0.20), c: RUFF, m: condorXf(0, 0.20, 0.30) },
    // THE RUFF IS TWO TONES (ROADMAP-WOW Part C): a collar is a thing with an
    // edge, and one hex of white from throat to nape reads as a bandage. The
    // beak's pale tan on its rim — the seam seen from above where the white
    // meets the black, and the shadow line under the throat from the side.
    { g: new THREE.BoxGeometry(0.46, 0.06, 0.08), c: BEAK, m: condorXf(0, 0.245, 0.215) },
    { g: new THREE.BoxGeometry(0.62, 0.05, 0.56), c: BEAK, m: condorXf(0, -0.02, 0.50) },
  ];
  for (let s = -1; s <= 1; s += 2) {
    bodyParts.push({ g: new THREE.BoxGeometry(0.09, 0.42, 0.11), c: SKIN, m: condorXf(s * legX, -0.42, 0.10) });
    bodyParts.push({ g: new THREE.BoxGeometry(0.15, 0.07, 0.22), c: SKIN, m: condorXf(s * legX, -0.66, 0.14) });
  }
  root.add(condorPart(bodyParts, true));

  // --- head on its own pivot so it can track the direction of travel ---
  condorHeadPivot = new THREE.Object3D();
  condorHeadPivot.position.set(0, 0.20, 0.58);
  root.add(condorHeadPivot);
  condorHeadPivot.add(condorPart([
    { g: new THREE.CylinderGeometry(0.085, 0.115, 0.24, 6), c: SKIN, m: condorXf(0, 0.10, 0.05, -0.45) },
    { g: new THREE.SphereGeometry(0.155, 8, 6), c: SKIN, m: condorXf(0, 0.22, 0.17, 0, 0, 0, 0.92, 1, 1.06) },
    { g: new THREE.BoxGeometry(0.055, 0.16, 0.28), c: COMB, m: condorXf(0, 0.37, 0.13, -0.18) },
    { g: new THREE.BoxGeometry(0.10, 0.11, 0.09), c: COMB, m: condorXf(0, 0.10, 0.19) },
    { g: new THREE.ConeGeometry(0.095, 0.30, 6), c: BEAK, m: condorXf(0, 0.21, 0.33, Math.PI / 2) },
    { g: new THREE.BoxGeometry(0.07, 0.10, 0.07), c: BEAK, m: condorXf(0, 0.16, 0.42, 0.5) },
    { g: new THREE.SphereGeometry(0.038, 6, 4), c: PALETTE.capyEye, m: condorXf(0.115, 0.26, 0.24) },
    { g: new THREE.SphereGeometry(0.038, 6, 4), c: PALETTE.capyEye, m: condorXf(-0.115, 0.26, 0.24) },
  ], true));

  // --- WINGS: 4.6 m of them, broad in the chord, and each panel carries a
  //     condorRuff top surface. Andean condors are read from above by the huge
  //     white secondary panel, and it is the only thing that stops a near-black
  //     bird from being an unreadable hole over dark valley green.
  const half = condorSPAN * 0.5;                 // 2.30
  const shoulderX = 0.24;
  const innerLen = 0.85, outerLen = 0.65, primLen = half - shoulderX - innerLen - outerLen;
  const innerChord = 0.95, outerChord = 0.70, primChord = 0.20;
  for (let w = 0; w < 2; w++) {
    const sign = w === 0 ? 1 : -1;               // +1 = bird's left (+X)
    const mirror = new THREE.Object3D();
    mirror.position.set(sign * shoulderX, 0.14, 0.02);
    if (sign < 0) mirror.rotation.y = Math.PI;   // mirrored frame: same local anims
    root.add(mirror);

    const shoulder = new THREE.Object3D();
    mirror.add(shoulder);
    shoulder.add(condorPart([
      { g: new THREE.BoxGeometry(innerLen, 0.085, innerChord), c: DARK, m: condorXf(innerLen * 0.5, 0, -0.02) },
      // the shoulder flash — inboard third of the secondary coverts only
      // (the z offset carries `sign` because the right wing lives in a frame that
      //  is rotated 180 deg about Y — without it the two flashes sit on opposite
      //  edges of the wing and the bird reads lopsided from above)
      { g: new THREE.BoxGeometry(innerLen * 0.42, 0.05, innerChord * 0.34), c: RUFF, m: condorXf(innerLen * 0.30, 0.065, -0.24 * sign) },
    ]));

    const elbow = new THREE.Object3D();
    elbow.position.set(innerLen, 0, 0);
    shoulder.add(elbow);
    elbow.add(condorPart([
      { g: new THREE.BoxGeometry(outerLen, 0.070, outerChord), c: DARK, m: condorXf(outerLen * 0.5, 0, -0.05) },
      // no white out here: the outer panel of a condor is black to the wrist
      { g: new THREE.BoxGeometry(outerLen * 0.96, 0.045, outerChord * 0.48), c: BODY, m: condorXf(outerLen * 0.5, 0.048, -0.25) },
    ]));

    const wrist = new THREE.Object3D();
    wrist.position.set(outerLen, 0, 0);
    elbow.add(wrist);

    // primaries: the fingers were only ever splayed by one shared scalar, so
    // the fan is baked and the whole hand is animated as one object.
    //
    // FIVE FINGERS, NOT FOUR, AND EACH ONE IS TWO COLOURS (ROADMAP-WOW Part C,
    // the movers uplift). An Andean condor's hand is the one part of the
    // silhouette anybody can name, and four equal black slats read as a comb.
    // Five, splayed a little wider, the inboard half in the wing's own near-
    // black and the outboard half in the body's warmer dark, so the fan has
    // a band across it where the fingers separate — the same c-band trick the
    // roster figure's hem uses. Still one merged mesh per hand, still planar.
    // The flex is on the pivot (see condorAnimate: the fan lags the flap).
    const fan = new THREE.Object3D();
    wrist.add(fan);
    const primParts = [];
    const innerFrac = 0.56;
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.125;
      const place = condorXf(0, 0, -0.30 + i * 0.152, 0, a, 0);
      const len0 = primLen * innerFrac, len1 = primLen - len0;
      primParts.push({
        g: new THREE.BoxGeometry(len0, 0.050, primChord), c: DARK,
        m: place.clone().multiply(condorXf(len0 * 0.5, 0, 0)),
      });
      primParts.push({
        g: new THREE.BoxGeometry(len1, 0.042, primChord * 0.82), c: BODY,
        m: place.clone().multiply(condorXf(len0 + len1 * 0.5, 0, 0)),
      });
    }
    fan.add(condorPart(primParts));
    condorWings.push({ shoulder, elbow, wrist, fan, sign, lagD: 0 });
  }

  // --- tail: short, starting straight off the torso. Baked fan, one mesh; the
  //     airbrake open/close is a scale on the whole fan.
  condorTailPivot = new THREE.Object3D();
  condorTailPivot.position.set(0, 0.03, -0.42);
  root.add(condorTailPivot);
  condorTailFan = new THREE.Object3D();
  condorTailPivot.add(condorTailFan);
  const tailParts = [];
  for (let i = 0; i < 5; i++) {
    tailParts.push({
      g: new THREE.BoxGeometry(0.13, 0.045, 0.36), c: DARK,
      m: condorXf(0, 0, 0, 0, (i - 2) * 0.16, 0).multiply(condorXf(0, 0, -0.18)),
    });
  }
  condorTailFan.add(condorPart(tailParts));

  // --- the anchor the capybara hangs from ---
  condorTalonAnchor = new THREE.Object3D();
  condorTalonAnchor.position.set(condorTalonLocal.x, condorTalonLocal.y, condorTalonLocal.z);
  root.add(condorTalonAnchor);
}

// =============================================================================
// SUMMON / DESPAWN
// =============================================================================
function condorSummon() {
  const game = condorGame;
  if (!game || !condorBody) return false;
  if (!condorHost()) return false;
  // The one moment the bird is guaranteed to be off screen. See condorRePlume.
  condorRePlume();

  // ---- THE SECOND WHISTLE IS A LESSON, AND A LESSON IS TAUGHT ONCE -------
  //
  // Measured from a cold summon (qa/mv-condor.js): four seconds of inbound
  // spiral, then the bird circles at fourteen metres and WAITS, and it takes a
  // second whistle plus about two and a half seconds of descent before the
  // talons are in reach — a shade over ten seconds of standing still in front
  // of the best two minutes in the chapter.
  //
  // That is exactly right the first time. The toast on the transition says
  // 'whistle again to bring it down', and the player has to learn that the
  // whistle is a conversation rather than a button; the chapter is built on it.
  //
  // It is a tax every time after that. So once the bird has actually been
  // RIDDEN — this session, or on the file, which is what makes it survive a
  // reload — a summon arms the low orbit from the start and the bird spirals
  // straight down to the talons. Nothing else changes: same states, same
  // spiral, same bored timer, same everything for a player who has not yet
  // worked out what the whistle is for.
  // ...and the id is the HOST's, not Pasto's. Left as the literal it used to be,
  // a player who learned the lesson in Rio arrived in Pasto and was taught it
  // again, while a Pasto rider got the shortcut in Rio — the lesson leaking one
  // way only, which is worse than it not leaking at all.
  if (!condorRodeOnce && typeof game.taskDone === 'function') {
    const rideId = condorTaskId('ride');
    if (rideId && game.taskDone(rideId)) condorRodeOnce = true;
  }

  // ---- A WHISTLE AT THE BIRD IS NOT A WHISTLE AT THE DOOR (T1e) -----------
  // Rio's travel door and Pasto's crater door count Q presses inside the same
  // circle the bird is called in, and the third press of a slow descent opened
  // the departures board over the chapter's star moment. Every press this
  // function spends on the bird marks the next six seconds as the bird's;
  // systems.js reads it in homeOk. This file is its one writer (the decay is in
  // condorUpdate).
  if (condorState !== 'gone' && condorState !== 'carrying' && game.state) game.state.flierWhistleT = 6;

  // ---- ...AND ONE BLOWN WHILE IT IS STILL COMING IN IS NOT LOST (T1e) -----
  // The inbound spiral is four seconds of GAME time, and at rung 3 a frame is
  // 60-80 ms, so a player who waits five seconds on the wall clock and whistles
  // again whistles at an inbound bird — which returned false and did nothing,
  // and the bird then circled at 14 m waiting for a press that had been made.
  if (condorState === 'inbound') {
    if (!condorLowered) {
      if (typeof game.sfx === 'function') game.sfx('whistle');
      condorLowered = true;
      condorOrbitYTarget = condorORBIT_LOW_Y;
      condorOrbitRTarget = condorORBIT_LOW_R;
      if (typeof game.toast === 'function') game.toast('the condor drops lower…');
      return true;
    }
    return false;
  }

  // whistling again while it circles brings it down into actual reach
  if (condorState === 'circling') {
    if (typeof game.sfx === 'function') game.sfx('whistle');
    condorBoredT = 0;
    if (!condorLowered) {
      condorLowered = true;
      condorOrbitYTarget = condorORBIT_LOW_Y;
      condorOrbitRTarget = condorORBIT_LOW_R;
      if (typeof game.toast === 'function') game.toast('the condor drops lower…');
    }
    return true;
  }
  if (condorState !== 'gone') return false;

  const capy = game.capy;
  const cx = capy ? capy.body.position.x : 0;
  const cz = capy ? capy.body.position.z : 26;
  const cy = capy ? capy.body.position.y : 1.4;

  condorOrbitAng = rand(0, Math.PI * 2);
  condorSpawnR = 46;
  condorSpawnY = cy + 56;
  condorOrbitR = condorSpawnR;
  condorOrbitY = condorSpawnY - cy;
  // ...and this is where the lesson is skipped. See the note at the top of this
  // function. The inbound spiral is untouched — it still eases to the HIGH
  // orbit over its four seconds, because that spiral is the arrival and it is
  // the best thing the bird does — but the moment it reaches the circle it is
  // already heading for the talon height rather than waiting to be asked.
  condorLowered = condorRodeOnce;
  condorOrbitYTarget = condorRodeOnce ? condorORBIT_LOW_Y : condorORBIT_HIGH_Y;
  condorOrbitRTarget = condorRodeOnce ? condorORBIT_LOW_R : condorORBIT_HIGH_R;

  // teleport-in: the interpolation history MUST be rewritten with it
  condorBody.position.set(cx + Math.cos(condorOrbitAng) * condorSpawnR, condorSpawnY,
                          cz + Math.sin(condorOrbitAng) * condorSpawnR);
  condorBody.velocity.set(0, -6, 0);
  condorBody.angularVelocity.set(0, 0, 0);
  condorBody.quaternion.setFromEuler(0, condorOrbitAng, 0);
  condorBody.previousPosition.copy(condorBody.position);
  condorBody.interpolatedPosition.copy(condorBody.position);
  condorBody.previousQuaternion.copy(condorBody.quaternion);
  condorBody.interpolatedQuaternion.copy(condorBody.quaternion);
  condorBody.force.set(0, 0, 0);
  condorBody.torque.set(0, 0, 0);
  condorRenderInit = false;      // ...and so must the render filter's history

  // the townscape is whatever is standing in the world right now — rescan on
  // every summon so a collapsed stall or a streamed biome cannot leave a ghost
  condorScanObstacles();

  condorAttachBody();
  condorGroup.visible = true;
  condorSetState('inbound');
  condorBoredT = 0;
  condorOpenReset();
  if (game.state) game.state.flierWhistleT = 6;          // see the note at the top
  // once per visit; a flag that is cut simply never arms it (costs nothing)
  condorShotArmed = !condorShotVisit && !(game.state && game.state.noSummonShot);
  condorEchoT = (game.state && game.state.noSummonShot) ? 0 : 0.6;

  if (typeof game.sfx === 'function') game.sfx('whistle');
  // ---- ...AND THE TASK IT TICKS BELONGS TO THE HOST -----------------------
  // `condorSummonedOnce` is a MODULE latch and it stayed one, because what it
  // records is that the player has done this before. What it must not do is
  // gate the tick: with a second host, a player who called a condor in Pasto
  // and then a fragata in Rio would find Rio's line never ticked, because the
  // latch was already spent in another chapter. completeTask is idempotent —
  // it returns false on an id already done — so the call is simply made every
  // time and the latch is left to mean the one thing it means.
  condorSummonedOnce = true;
  if (typeof game.completeTask === 'function') game.completeTask(condorTaskId('summon'));
  if (typeof game.toast === 'function') game.toast('something enormous turns overhead');
  return true;
}

function condorAttachBody() {
  if (condorInWorld || !condorBody) return;
  condorCapture(condorGame, function () { condorGame.world.addBody(condorBody); });
  condorInWorld = true;
  condorApi.active = true;
}

function condorDetachBody() {
  if (!condorBody || !condorGame || !condorGame.world) return;
  if (condorGame.world.bodies.indexOf(condorBody) >= 0) condorGame.world.removeBody(condorBody);
  condorInWorld = false;
  condorApi.active = false;
  // ---- PARK IT. A DETACHED BODY DOES NOT INTEGRATE ------------------------
  // Removing a body from the world stops it being stepped, so whatever position
  // and velocity it held on the last frame it was alive stay on it for ever.
  // MEASURED, that read as a bug from the outside: after an auto-release the AI
  // climbed away, despawned at y = 55.9 doing 19.1 m/s, and then reported the
  // identical altitude and the identical speed at 38 s, 45 s and 53 s — a condor
  // apparently frozen in mid-air. Nothing was frozen (the mesh is hidden and the
  // body is out of the broadphase), but a stale flying state is indistinguishable
  // from a stuck one to anything that reads game.condor.body, so it is cleared:
  // the bird goes back to its parking spot, at rest, with the interpolation
  // history rewritten to match exactly as the contract requires of a teleport.
  condorBody.velocity.set(0, 0, 0);
  condorBody.angularVelocity.set(0, 0, 0);
  condorBody.force.set(0, 0, 0);
  condorBody.torque.set(0, 0, 0);
  condorBody.position.set(0, condorPARK_Y, 0);
  condorBody.quaternion.set(0, 0, 0, 1);
  condorBody.previousPosition.copy(condorBody.position);
  condorBody.interpolatedPosition.copy(condorBody.position);
  condorBody.previousQuaternion.copy(condorBody.quaternion);
  condorBody.interpolatedQuaternion.copy(condorBody.quaternion);
  condorRenderInit = false;                 // a park is a teleport: rebuild the filter
  if (condorGroup) condorRender(1/60);
}

function condorDespawn(silent) {
  condorOpenReset();
  condorShotArmed = false; condorEchoT = 0;
  condorLaunchGrace = 0;
  condorLaunchLift = 0;
  condorStalled = false;
  const capy = condorGame && condorGame.capy;
  if (capy && capy.group) {
    // hand the pose to the settle unwinder rather than snapping it — a 40 deg
    // pop to upright in one frame is exactly what the player is looking at.
    condorTumbleX = 0; condorTumbleY = 0; condorTumbleZ = 0;
    condorSettleT = condorSETTLE_T;
  }
  if (condorState === 'gone' && !condorConstraint) { condorDetachBody(); return; }
  condorRelease(true);
  condorDetachBody();
  if (condorGroup) condorGroup.visible = false;
  condorSetState('gone');
  condorLowered = false;
  if (!silent && condorGame && typeof condorGame.sfx === 'function') condorGame.sfx('gull', { pitch: 0.55, volume: 0.9 });
}

function condorSetState(s) {
  condorState = s;
  condorStateT = 0; condorRolls = 0; condorRollT = 0; condorAiT = 0;
  if (condorApi) {
    condorApi.state = s;
    condorApi.mounted = (s === 'carrying');
  }
}

// =============================================================================
// MOUNT / RELEASE
// =============================================================================
function condorMount() {
  const game = condorGame;
  const capy = game && game.capy;
  if (!capy || !capy.body || condorConstraint) return false;
  // T1e: collide again, follow the animal again (the counts stay for the audit)
  condorOpenOn = false; condorOpenT = 0; condorGhost(false);
  // The pilot's hands are empty at the moment of the grab. Without this the
  // filtered stick still holds whatever the capybara was walking in when the
  // talons closed, and the first half second of every ride is a turn nobody
  // asked for. See condorSTICK_ON.
  condorStickX = 0; condorStickZ = 0;

  // ---- SNAP THE PASSENGER INTO THE TALONS BEFORE THE ROD EXISTS ------------
  // The grab fires whenever the capybara is within condorREACH of the talon, so
  // the constraint is typically born with 1-2 m of violation in it — and a
  // PointToPointConstraint at 1e6 of max force answers a 1.8 m violation by
  // inventing 18 m/s of downward velocity for the bird, three metres off the
  // deck. Measured, that put the pair into the ground 2.1 seconds after every
  // pickup. So the capybara is carried to the anchor first and handed the bird's
  // velocity; the rod is then created already satisfied and has nothing to
  // correct. Same repair as the teleport guard, applied at the one moment the
  // game does the teleporting itself. It is a position write, so the
  // interpolation history goes with it (contract, "Rendering physics transforms").
  condorBody.quaternion.vmult(condorTalonLocal, condorTmpA);
  capy.body.quaternion.vmult(condorCapyPivot, condorTmpB);
  capy.body.position.set(condorBody.position.x + condorTmpA.x - condorTmpB.x,
                         condorBody.position.y + condorTmpA.y - condorTmpB.y,
                         condorBody.position.z + condorTmpA.z - condorTmpB.z);
  capy.body.velocity.copy(condorBody.velocity);
  capy.body.angularVelocity.set(0, 0, 0);
  capy.body.previousPosition.copy(capy.body.position);
  capy.body.interpolatedPosition.copy(capy.body.position);
  capy.body.force.set(0, 0, 0);
  capy.body.torque.set(0, 0, 0);

  condorConstraint = new CANNON.PointToPointConstraint(
    condorBody, condorTalonLocal, capy.body, condorCapyPivot, 1e6);
  // A TENDON, NOT A SCAFFOLDING POLE.
  // At cannon's default SPOOK parameters (stiffness 1e7, relaxation 3) this rod
  // is stiff enough that the solver spends every step arguing with itself about
  // a 30 kg mass hanging off a 52 kg one at 20 m/s: the residual comes back as a
  // few millimetres of buzz per step, which the camera — sitting 24 m behind the
  // pair and pointed straight at them — turns into a permanent shimmer.
  // Softening the constraint by half and giving it an extra step of relaxation
  // costs about 4 cm of steady-state stretch, which is invisible on a 1.45 m
  // tether and reads as the talons actually gripping something soft.
  for (let i = 0; i < condorConstraint.equations.length; i++) {
    condorConstraint.equations[i].setSpookParams(5e6, 4, 1 / 60);
  }
  game.world.addConstraint(condorConstraint);
  capy.carriedBy = condorApi;
  condorSetState('carrying');
  condorLaunchGrace = 0;

  // ---- THE LAUNCH ----------------------------------------------------------
  // Until this line the AI was cancelling gravity exactly, so the bird hovered.
  // The instant the constraint lands it becomes a pure glider at 52 kg whose
  // only speed is the orbit tangent (~3 m/s), which makes 0.9 m/s^2 of lift
  // against 24 of gravity: it used to hit the ground inside 0.6 s. So the grab
  // IS a launch — one hard beat that gives BOTH bodies the same delta-v (so the
  // constraint is never asked to absorb a discontinuity), a forced wingbeat, and
  // a gravity assist that FADES OUT over condorLAUNCH_T rather than cutting.
  // By the time it is gone the bird is at trim airspeed and flying honestly.
  condorLaunchLift = 1;
  // BEATING, for as long as the launch lasts. One 1.05 s beat was sized against a
  // launch that also switched gravity off; the wingbeat is now the ONLY thing the
  // bird has, and it is honest thrust along the nose — sustained, it buys a
  // flatter glide and never a net climb (measured: -0.57 m/s held for 20 s).
  condorFlapT = condorLAUNCH_T;
  condorFlapCool = 0;
  condorFlapPhase = 0;
  condorBody.velocity.x += condorFwd.x * condorLAUNCH_KICK;
  condorBody.velocity.y += condorFwd.y * condorLAUNCH_KICK + 1.5;
  condorBody.velocity.z += condorFwd.z * condorLAUNCH_KICK;
  capy.body.velocity.x += condorFwd.x * condorLAUNCH_KICK;
  capy.body.velocity.y += condorFwd.y * condorLAUNCH_KICK + 1.5;
  capy.body.velocity.z += condorFwd.z * condorLAUNCH_KICK;
  // C2: catching the descending orbit must not launch the passenger down.
  // Keep the authored kick and horizontal momentum; cancel only the missing
  // rise, equally on both bodies. Ordinary flight has no added lift source.
  const pickupRise = Math.max(0, 1.5 - condorBody.velocity.y);
  condorBody.velocity.y += pickupRise;
  capy.body.velocity.y += pickupRise;
  // the yank starts the pendulum trailing behind the acceleration
  condorPendOX = -condorFwd.x * 0.32; condorPendOZ = -condorFwd.z * 0.32;
  condorPendVX = 0; condorPendVZ = 0;
  condorPivAX = 0; condorPivAZ = 0;
  condorPrevVX = condorBody.velocity.x; condorPrevVZ = condorBody.velocity.z;
  condorTumbleX = 0; condorTumbleY = 0; condorTumbleZ = 0;
  condorYawOff = 0; condorSettleT = 0;
  condorPathPrev = 0; condorPathRate = 0;
  // seed the snapshot: postStep has not yet run with the constraint in place
  condorVelSnap.copy(capy.body.velocity);

  if (typeof game.sfx === 'function') { game.sfx('gull', { pitch: 0.6 }); game.sfx('gasp'); }
  if (typeof game.shake === 'function') game.shake(0.3);
  // Same rule as the summon above: the latch is "you have done this before" and
  // is global on purpose — it is what arms the low orbit, and the lesson is
  // learned once for the whole game. The TICK is the host's, and it is fired
  // every ride, because a ride in Pasto must not tick, or swallow, a ride in
  // Rio.
  condorRodeOnce = true;
  // ---- THE RIDE IS THE RIDE, NOT THE GRAB (W1) ------------------------------
  // The marquee used to tick on this line — the frame the talons closed — so
  // the banner, the slow beat and the lift all landed with the animal still
  // two metres off the market square, and the minute in the air that the
  // chapter is FOR ran under a paper that had already moved on. Now the grab
  // arms it: condorUpdate counts the seconds carried, hands them to the
  // signpost as "hanging on · 8 s · 60 m up", and ticks at condorRIDE_T with
  // the animal high over the place. Same id, same host rule, same once-per-
  // chapter payout — later, and in the air.
  const rideId = condorTaskId('ride');
  const first = !!(rideId && typeof game.taskDone === 'function' && !game.taskDone(rideId));
  // ...AND THE SHOT FIRES ON THE FIRST RIDE IN *THIS* CHAPTER, which is what
  // an open ride id in this host already says. Keyed off condorRodeOnce
  // instead, a player who rode in Pasto would arrive in Rio and get the shot
  // spent two chapters earlier.
  if (first) {
    const shotHost = condorHost();
    if (shotHost && typeof shotHost.condorShot === 'function') shotHost.condorShot();
  }
  if (typeof game.toast === 'function') game.toast('hold on');
  // ---- AND THE ONE CONTROL THE FLIGHT HAS, WHICH WAS NEVER TAUGHT (P3) ----
  // `wantFlap` reads `input.honkPressed` and the comment beside it says THE
  // PLAYER PRESSES IT — and nothing in nineteen chapters ever told them. The
  // only lines in the whole flight are 'hold on' and 'whistle again to bring it
  // down'; the thermal-peak clue says 'steer into the rising air off the
  // volcano'. R6's four scripted pilots measured what that costs: a naive pilot
  // who never flaps clears the crater on the SECOND ride and an average one who
  // does clears on the first, because the flight model flaps for you below
  // 5.4 m/s of airspeed. So the key is not the difference between failing and
  // clearing — it is the difference between one ride and two, and between a
  // verb you own and a save that arrives without you knowing why.
  //
  // Said on the second beat, after 'hold on' has landed, because the first
  // second of a condor is not a moment anybody reads a second sentence in. Via
  // game.say, so a pad reads B and a phone reads WHEEK — this is the first line
  // in the game outside systems.js that names a control.
  // ---- ...AND IT WAS THE WRONG `say` (F4) --------------------------------
  // `game.say` is npc.js's `sayAt(x, y, z, text)` — a speech bubble at a POINT
  // — and this called it with one string. `sayAt` begins `if (!text) return;`,
  // so the whole thing was a silent no-op: no bubble, no toast, no throw.
  // MEASURED: `game.say('...')` returns undefined and adds neither a bubble
  // nor a toast to the document. The comment above is a true and careful
  // account of a line that has never once been said.
  //
  // `game.hud.say(s)` is the one that takes a sentence — it is the only
  // caller of `sysSay`, which is what turns "press Q" into "tap WHEEK" on a
  // phone and into the pad's word on a pad. That substitution was written FOR
  // patterns like this one; it had simply never been handed this string.
  if (game.hud && typeof game.hud.say === 'function') {
    setTimeout(function () {
      if (condorConstraint) game.hud.say('press Q to beat the wings. it climbs.');
    }, 2400);
  }
  return true;
}

/** Remove the constraint. The capybara keeps the condor's FULL velocity — the drop is the joke. */
function condorRelease(silent) {
  const game = condorGame;
  if (!condorConstraint) return false;
  try { game.world.removeConstraint(condorConstraint); } catch (e) { /* already gone */ }
  condorConstraint = null;
  // ---- THE FLIGHT IS OVER, SO THE NUMBER IS FINAL. See condorCheckPeak ----
  // One file per flight, with the height the air actually got you to. The
  // running figure was on the paper the whole way up through recordLive; this
  // is the only place a 'personal best' card may come from.
  if (condorBestAGL > 0 && typeof game.record === 'function') {
    game.record('thermal-peak', condorBestAGL);
  }
  if (typeof game.recordEnd === 'function') game.recordEnd();

  const capy = game && game.capy;
  if (capy && capy.body) {
    capy.carriedBy = null;
    // velocity of the talon point = v + omega x r  (no damping, on purpose)
    condorBody.quaternion.vmult(condorTalonLocal, condorTmpA);
    condorBody.angularVelocity.cross(condorTmpA, condorTmpB);
    capy.body.velocity.set(
      condorBody.velocity.x + condorTmpB.x,
      condorBody.velocity.y + condorTmpB.y,
      condorBody.velocity.z + condorTmpB.z);
    condorVelSnap.copy(capy.body.velocity);
    // THE GRACE IS A STATE, NOT A TIMER. It holds until the capybara actually
    // lands (see condorUpdate); the number here is only a safety expiry in case
    // it never does. A 1.5 s timer used to cut the ballistic arc off mid-air —
    // capybara.js resumes vacuuming horizontal speed down to 4.25 m/s the moment
    // it lapses, so every drop from real altitude stopped dead and fell straight.
    condorLaunchGrace = condorGRACE_MAX;
    condorLaunchLift = 0;
    // TUMBLE. The drop is the joke; a rigid statue leaning 40 deg is not. Seed a
    // real spin and integrate it through the fall.
    // Deterministic, like the stall break: seeded off the release velocity rather
    // than rand(), so a QA run that reproduces the approach reproduces the drop.
    const rv = capy.body.velocity;
    const rvh = Math.sqrt(rv.x * rv.x + rv.z * rv.z);
    const axis = Math.atan2(rv.z, rv.x) + 1.9;
    const rate = clamp(4 + rvh * 0.22, 4, 8);
    condorTumbleX = Math.cos(axis) * rate;
    condorTumbleZ = Math.sin(axis) * rate;
    condorTumbleY = (condorBody.angularVelocity.y >= 0 ? 1 : -1) * clamp(2 + rvh * 0.11, 2, 4);
    condorYawOff = 0;
    condorSettleT = 0;
  }
  if (condorState === 'carrying') {
    condorSetState('circling');
    condorBoredT = condorBORED - 12;         // it sticks around a little longer
  }
  condorRegrabT = condorREGRAB_T;
  condorGrabRelease = !!(game && game.input && game.input.action);
  if (!silent && game && typeof game.sfx === 'function') game.sfx('gull', { pitch: 0.75 });
  return true;
}

// =============================================================================
// PHYSICS HOOKS
// =============================================================================
/** See condorMOUNT_SNAP. Runs before anything reads the mounted state, and is the
 *  only place in this module that is allowed to write a body position while the
 *  constraint is live — it is a repair, and it rewrites the interpolation history
 *  with it exactly as the contract requires of a teleport. */
function condorGuardMount() { condorGuardCore(false); }
function condorGuardPreStep() { condorGuardCore(true); }

function condorGuardCore(isPreStep) {
  if (!condorConstraint) { condorSyncHold = 0; return; }
  const capy = condorGame && condorGame.capy;
  if (!capy || !capy.body) return;
  const cb = condorBody, kb = capy.body;

  // a non-finite state can only be cleaned up by letting go
  const bad = !isFinite(cb.position.x + cb.position.y + cb.position.z +
                        cb.velocity.x + cb.velocity.y + cb.velocity.z +
                        kb.position.x + kb.position.y + kb.position.z);
  if (bad) { condorDespawn(true); return; }

  // NOTHING HANGING OFF THE TALONS MAY EXCEED WHAT THE BIRD CAN FLY AT. Anything
  // faster is not flight, it is a solver artefact, and clamping it here (rather
  // than at some larger "surely that is broken" number) means the artefact can
  // never survive into the next frame or be mistaken for a legitimate velocity.
  let cs = Math.sqrt(cb.velocity.x * cb.velocity.x + cb.velocity.y * cb.velocity.y + cb.velocity.z * cb.velocity.z);
  if (cs > condorMOUNT_VMAX) {
    const s = condorMOUNT_VMAX / cs;
    cb.velocity.x *= s; cb.velocity.y *= s; cb.velocity.z *= s;
    cb.angularVelocity.set(0, 0, 0);
    cs = condorMOUNT_VMAX;
  }

  // world positions of the two constraint anchors
  cb.quaternion.vmult(condorTalonLocal, condorTmpA);
  kb.quaternion.vmult(condorCapyPivot, condorTmpB);
  const ax = cb.position.x + condorTmpA.x, ay = cb.position.y + condorTmpA.y, az = cb.position.z + condorTmpA.z;
  const bx = kb.position.x + condorTmpB.x, by = kb.position.y + condorTmpB.y, bz = kb.position.z + condorTmpB.z;
  const gx = ax - bx, gy = ay - by, gz = az - bz;
  const gap = Math.sqrt(gx * gx + gy * gy + gz * gz);
  const repair = gap > condorMOUNT_SNAP;

  if (!repair && condorSyncHold <= 0) return;

  if (repair) {
    // Carry the passenger to the talons instead of letting the solver do it with
    // a hundred metres a second of impulse, and give it the carrier's velocity so
    // the constraint is never asked to absorb a discontinuity in either quantity.
    kb.position.set(kb.position.x + gx, kb.position.y + gy, kb.position.z + gz);
    kb.previousPosition.copy(kb.position);
    kb.interpolatedPosition.copy(kb.position);
    kb.previousQuaternion.copy(kb.quaternion);
    kb.interpolatedQuaternion.copy(kb.quaternion);
    kb.force.set(0, 0, 0);
    kb.torque.set(0, 0, 0);
    // the pendulum and the elevator's path memory are both stale after a jump
    condorPendOX = 0; condorPendOZ = 0; condorPendVX = 0; condorPendVZ = 0;
    condorPivAX = 0; condorPivAZ = 0;
    condorPathRate = 0;
    condorSyncVel.copy(cb.velocity);
    condorSyncHold = 8;
  } else if (isPreStep) {
    condorSyncHold--;
  }

  // Settling window. Cannon resolves a 150 m jump through more than the point
  // constraint — broadphase pairs, contacts at the destination — and those
  // arrive as impulses over the next couple of steps. Pinning both bodies to the
  // velocity they were teleported with, from inside preStep, means the solver
  // never gets to keep any of it.
  cb.velocity.copy(condorSyncVel);
  kb.velocity.copy(condorSyncVel);
  cb.angularVelocity.set(0, 0, 0);
  kb.angularVelocity.set(0, 0, 0);
  condorVelSnap.copy(condorSyncVel);
  condorPrevVX = condorSyncVel.x; condorPrevVZ = condorSyncVel.z;
}

// ---- A FORCE IS FOR THE WHOLE FRAME, NOT ITS FIRST SUBSTEP (T1e) -----------
// Every force in this file is written by update(), which main.js runs AFTER
// world.step — so it is spent by the NEXT frame's step. cannon-es clears
// body.force at the end of every internal step (World.clearForces), so a frame
// that takes two substeps gave the bird its lift, its seek and its wingbeat
// for the first 1/60 s and plain gravity for the second. From rung 2 the world
// takes two substeps every frame (MAIN_SHED_SUBSTEPS): the bird lived on half
// of everything it asked for, and measured at rung 3 it fell out of the high
// orbit straight onto the plaza 1.5 s after it arrived (qa/ten-t1e-condor.js,
// before: y 16.3 -> 0.7 m, and sat there). The frame's force and torque are
// kept on the first substep and put back on every later one, so a rung-3 frame
// flies the bird the way a rung-0 frame does. `noCondorSubstep` is the old way.
// ...AND THE SCRIPT RUNS ON THE SAME CLOCK AS THE BODY. The inbound spiral, the
// orbit's angle and its height easing were all written against `dt`, the game's
// clock, while the body they steer lives on the solver's. At rung 0 those agree.
// From rung 2 a frame is clamped to 1/20 s and the world takes two 1/60 steps
// of it (one, when a substep runs long and cannon-es bails), so the target
// moved 1.5-3x faster than the bird could: the four-second descent from 56 m
// became a 20 m/s dive through the high orbit and into the plaza. The AI states
// advance by what the solver actually simulated (condorAiDt), counted here.
let condorSubN = 0;                     // internal steps since the last update
let condorAiT = 0;                      // solver seconds in the current AI state
let condorAiRatio = 1;                  // solver seconds per game second, smoothed
function condorCountStep() { condorSubN++; }
let condorFrameFresh = false;           // update() has written this frame's forces
let condorFrameHeld = false;            // ...and the first substep has kept them
let condorHoldN = 0;                    // later substeps given the frame's force (audit)
const condorFrameF = new CANNON.Vec3();
const condorFrameTq = new CANNON.Vec3();
function condorHoldForces() {
  if (!condorBody || !condorInWorld) return;
  if (condorFrameFresh) {
    // cannon-es has already added m*g to the accumulator by the time preStep
    // fires, and adds it again on every substep. Kept with it, the second
    // substep flew under two gravities (measured: a low orbit asked for 6.9 m
    // held at 3.8, a hair under condorPickupReady's 4 m, for good).
    const W = condorGame.world, m = condorBody.mass;
    condorFrameF.set(condorBody.force.x - m * W.gravity.x,
                     condorBody.force.y - m * W.gravity.y,
                     condorBody.force.z - m * W.gravity.z);
    condorFrameTq.copy(condorBody.torque);
    condorFrameFresh = false;
    condorFrameHeld = true;
    return;
  }
  if (!condorFrameHeld || (condorGame && condorGame.state && condorGame.state.noCondorSubstep)) return;
  // cleared by the substep before, so this is the frame's force, not twice it
  condorBody.force.vadd(condorFrameF, condorBody.force);
  condorHoldN++;
  condorBody.torque.vadd(condorFrameTq, condorBody.torque);
}

function condorOnPostStep() {
  if (condorState !== 'carrying' && condorLaunchGrace <= 0) return;
  const capy = condorGame && condorGame.capy;
  if (capy && capy.body) condorVelSnap.copy(capy.body.velocity);
}

function condorOnCollide(e) {
  if (!condorApi || condorState === 'gone') return;
  const v = e && e.contact ? Math.abs(e.contact.getImpactVelocityAlongNormal()) : 0;
  if (v > condorLandSpeed) condorLandSpeed = v;
}

// =============================================================================
// UPDATE
// =============================================================================
function condorUpdate(dt) {
  const game = condorGame;
  if (!game || !condorBody) return;
  if (dt <= 0) dt = 1 / 60;
  if (dt > 0.05) dt = 0.05;

  // ---- biome early-out ------------------------------------------------------
  if (!condorHost()) {
    // Fires once on the way out, never every Sydney frame — this module must not
    // be writing another module's render root while it is not even live.
    if (condorState !== 'gone' || condorLaunchGrace > 0 || condorSettleT > 0) {
      condorDespawn(true);
      condorLaunchGrace = 0;
      condorSettleT = 0;
      condorYawOff = 0;
      const gcapy = game.capy;
      if (gcapy && gcapy.group) { gcapy.group.rotation.x = 0; gcapy.group.rotation.z = 0; }
    }
    return;
  }

  // a frame that returns before the forces are written has none to keep
  condorFrameFresh = false; condorFrameHeld = false;
  // what the solver simulated since the last update (see condorCountStep);
  // `noCondorSubstep` puts the script back on the game's clock
  const stepDt = game.world && game.world.dt > 0 ? game.world.dt : 1 / 60;
  const aiDt = (game.state && game.state.noCondorSubstep) ? dt : Math.min(0.1, condorSubN * stepDt);
  condorSubN = 0;
  condorAiRatio = damp(condorAiRatio, clamp(aiDt / dt, 0.2, 1.5), 2, dt);

  // ---- teleport guard: repair the mount BEFORE anything reads it ------------
  condorGuardMount();

  const input = game.input;
  if (input && input.whistlePressed && condorState !== 'carrying') condorSummon();

  // the post-landing unwind outlives the bird, so it runs ahead of every early-out
  condorSettle(dt);

  // T1e: the door guard decays here and nowhere else; the answer to the call
  // is a second, lower wheek 0.6 s behind it (`noSummonShot` never arms it).
  if (game.state && game.state.flierWhistleT > 0) game.state.flierWhistleT = Math.max(0, game.state.flierWhistleT - dt);
  if (condorEchoT > 0) {
    condorEchoT -= dt;
    if (condorEchoT <= 0 && condorState !== 'gone' && typeof game.sfx === 'function') {
      game.sfx('whistle', { pitch: 0.8, volume: 0.5 });
    }
  }

  if (condorState === 'gone') {
    condorLaunchGrace = 0;
    return;
  }

  if (condorRegrabT > 0) condorRegrabT -= dt;
  if (condorRollCool > 0) condorRollCool -= dt;
  if (condorRollT > 0) condorRollT -= dt;
  condorStateT += dt;
  // ---- the roll (L1) --------------------------------------------------------
  if (condorState === 'carrying' && input && input.jumpPressed && condorRollT <= 0 && condorRollCool <= 0) {
    const v0 = condorBody.velocity;
    const sp0 = Math.sqrt(v0.x * v0.x + v0.y * v0.y + v0.z * v0.z);
    if (sp0 >= condorROLL_V) {
      condorRollT = condorROLL_T; condorRollCool = condorROLL_T + 0.4; condorRolls++;
      if (typeof game.sfx === 'function') game.sfx('whistle', { volume: 0.34, pitch: 1.2, force: true });
      if (typeof game.punch === 'function') game.punch(0.06);
      if (typeof game.toast === 'function' && condorRolls === 1) game.toast('a roll. it liked that.');
    } else if (typeof game.control === 'function' && condorRollCool <= 0) {
      condorRollCool = 1.5;
      game.control('too slow to roll — Shift to tuck and pick up speed, then Space');
    }
  }
  // ---- the ride, counted (W1). See the note in condorMount. ------------------
  if (condorState === 'carrying') {
    const rideId = condorTaskId('ride');
    if (rideId && typeof game.taskDone === 'function' && !game.taskDone(rideId)) {
      const cb = game.capy && game.capy.body;
      const alt = cb ? Math.max(0, cb.position.y - condorTerrain(cb.position.x, cb.position.z)) : 0;
      if (typeof game.wowLive === 'function') {
        game.wowLive('hanging on · ' + Math.floor(condorStateT) + ' s · ' + Math.round(alt) + ' m up' +
                     (condorRolls ? ' · ' + condorRolls + (condorRolls === 1 ? ' roll' : ' rolls') : ' · Space to roll'),
                     condorStateT / condorRIDE_T);
      }
      if (condorStateT >= condorRIDE_T && typeof game.completeTask === 'function') {
        game.completeTask(rideId);
      }
    }
  }

  // ---- body frame -----------------------------------------------------------
  condorBody.quaternion.vmult(condorLocalFwd, condorFwd);
  condorBody.quaternion.vmult(condorLocalUp, condorUp);
  condorBody.quaternion.vmult(condorLocalSide, condorSide);

  const vel = condorBody.velocity;
  const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);

  // THERMALS ARE A MOVING AIRMASS, not a shove. Every aerodynamic quantity below
  // is measured against the RELATIVE WIND, so a column carries the bird up the
  // sky while its airspeed is untouched — which is the only reason a glider can
  // circle up one instead of mushing into a stall. Pure upward body force gives
  // a bird that climbs, pitches up chasing its own flight path, and dies.
  const wUp = (condorState === 'carrying') ? condorThermalUpdraft() : 0;
  condorRel.set(vel.x, vel.y - wUp, vel.z);
  const rsp = condorRel.length();
  const vFwd = condorRel.x * condorFwd.x + condorRel.y * condorFwd.y + condorRel.z * condorFwd.z;
  const vSide = condorRel.x * condorSide.x + condorRel.y * condorSide.y + condorRel.z * condorSide.z;
  const vUp = condorRel.x * condorUp.x + condorRel.y * condorUp.y + condorRel.z * condorUp.z;
  // AIRSPEED IS THE MAGNITUDE OF THE RELATIVE WIND, not its forward component.
  // Using vFwd meant a bird whose nose had fallen away from its flight path
  // reported "no airspeed", lost all its lift and all its control authority, and
  // could never recover — the mush was self-sustaining. Dynamic pressure does not
  // care which way the beak points.
  const airspeed = rsp;
  // 9, not 6. This lag sits on the SPRING half of the phugoid loop, and at the
  // mode's 2.6 rad/s a 1/6 s lag is 23 degrees of phase eaten straight out of the
  // damping. It is smoothing for the animation's benefit, not the controller's.
  condorSpeedSm = damp(condorSpeedSm, airspeed, 9, dt);

  const bank = Math.atan2(condorSide.y, condorUp.y);
  const pitch = Math.asin(clamp(condorFwd.y, -1, 1));
  const pathAng = rsp > 0.6 ? Math.asin(clamp(condorRel.y / rsp, -1, 1)) : pitch;
  // ANGLE OF ATTACK, MEASURED IN THE BODY FRAME. `pitch - pathAng` is only the
  // angle of attack when the bird is flying in its own plane of symmetry, and it
  // is the difference of two arcsines, so near a vertical flight path it is a
  // catastrophically badly conditioned way to compute a small angle. atan2 of the
  // two wind components the wing actually feels is exact at every attitude.
  const vPlane = Math.sqrt(vFwd * vFwd + vUp * vUp);
  const aoa = vPlane > 0.8 ? clamp(Math.atan2(-vUp, vFwd), -1.45, 1.45) : 0;
  condorAoASm = damp(condorAoASm, aoa, 10, dt);
  // How fast the flight path itself is rotating. Fed forward to the elevator, so
  // that following a curving path costs no standing attitude error — without it
  // the rate damper leaves (Kd/Kp) * pathRate of permanent angle-of-attack error,
  // which measured 0.25 rad in a descent and was most of the mush.
  const pathRateRaw = clamp((pathAng - condorPathPrev) / dt, -8, 8);
  condorPathPrev = pathAng;
  condorPathRate = damp(condorPathRate, pathRateRaw, 8, dt);

  const capy = game.capy;
  const mounted = condorState === 'carrying' && !!condorConstraint;
  const mEff = condorMASS + (mounted && capy && capy.body ? capy.body.mass : 0);
  const g = -game.world.gravity.y;

  let targetBank = 0, targetPitch = 0;

  // ==========================================================================
  // AI STATES — inbound spiral, lazy orbit, exit. Force-driven, never a rail.
  // ==========================================================================
  if (condorState !== 'carrying') {
    let cx = capy ? capy.body.position.x : 0;
    let cy = capy ? capy.body.position.y : 1.4;
    let cz = capy ? capy.body.position.z : 26;
    // T1e: the watchdog moved the orbit to open sky. Same height over the
    // ground there as the animal has where it stands, so walking under it is
    // the same pickup as ever. Wander off and the bird follows again.
    if (condorOpenOn) {
      if (condorState !== 'circling' || Math.hypot(cx - condorOpenX, cz - condorOpenZ) > condorOPEN_GIVE_UP) {
        condorOpenOn = false;
      } else {
        cy = condorTerrain(condorOpenX, condorOpenZ) + (cy - condorTerrain(cx, cz));
        cx = condorOpenX; cz = condorOpenZ;
      }
    }

    condorAiT += aiDt;                  // T1e: the solver's clock, see condorCountStep
    if (condorState === 'inbound') {
      const k = clamp(condorAiT / condorINBOUND_T, 0, 1);
      const ease = k * k * (3 - 2 * k);
      condorOrbitR = lerp(condorSpawnR, condorORBIT_HIGH_R, ease);
      condorOrbitY = lerp(condorSpawnY - cy, condorORBIT_HIGH_Y, ease);
      condorOrbitAng += (2.35 - 1.1 * ease) * aiDt;
      if (k >= 1) {
        condorSetState('circling');
        condorBoredT = 0;
        if (typeof game.sfx === 'function') game.sfx('gull', { pitch: 0.62, volume: 1 });
        // The line only helps somebody who does not know it yet. See THE SECOND
        // WHISTLE IS A LESSON in condorSummon — a bird that is already on its
        // way down would be telling the player to do a thing that is happening.
        if (!condorLowered && typeof game.toast === 'function') {
          game.toast('whistle again to bring it down');
        }
      }
    } else if (condorState === 'circling') {
      condorOrbitR = damp(condorOrbitR, condorOrbitRTarget, 1.4, aiDt);
      condorOrbitY = damp(condorOrbitY, condorOrbitYTarget, 1.2, aiDt);
      condorOrbitAng += (condorLowered ? 1.55 : 1.15) * aiDt;
      condorBoredT += dt;
      if (condorBoredT > condorBORED) {
        condorSetState('leaving');
        if (typeof game.sfx === 'function') game.sfx('gull', { pitch: 0.5, volume: 1 });
        if (typeof game.toast === 'function') game.toast('the condor gives up on you');
      }
    } else if (condorState === 'leaving') {
      condorOrbitR = damp(condorOrbitR, 70, 0.9, aiDt);
      condorOrbitY = damp(condorOrbitY, 70, 0.8, aiDt);
      condorOrbitAng += 0.9 * aiDt;
      if (condorAiT > 9) { condorDespawn(true); return; }
    }

    // seek target on the orbit
    const tx = cx + Math.cos(condorOrbitAng) * condorOrbitR;
    const tz = cz + Math.sin(condorOrbitAng) * condorOrbitR;
    let ty = cy + condorOrbitY;
    // T1e: THE LOW ORBIT HAS A FLOOR. 6.6 m over the animal is 6.6 m over the
    // paving only while nothing stands between them; over a fountain, a stall
    // row or a hillside it was an order to fly into it. Never less than
    // condorOPEN_LIFT of air under the hanging talons, whatever is below.
    if (condorState === 'circling' && !(game.state && game.state.noCondorOpen)) {
      const floorY = condorGroundTop(tx, tz) + condorHANG + condorOPEN_LIFT;
      if (ty < floorY) ty = floorY;
    }
    condorSeek.set(tx - condorBody.position.x, ty - condorBody.position.y, tz - condorBody.position.z);
    const derr = condorSeek.length();
    const want = clamp(derr * 1.5, 0, 26);
    if (derr > 1e-4) condorSeek.scale(want / derr, condorSeek);
    // PD onto the desired velocity, plus the WINGBEAT that holds the bird up.
    // This line used to read `+ mEff * g` — gravity cancelled exactly, in the
    // WORLD frame, every frame. Measured, the bird held vy = 0.00 m/s
    // indefinitely: a true hover, and the reason an earlier report diagnosed this
    // whole module as "hovering". Sustentation is now a force along the bird's OWN
    // up axis with a wingbeat's duty cycle on it, so (a) banking costs it
    // cos(bank) of its vertical component and the PD has to work for the altitude,
    // and (b) vy is never a flat zero — it bobs on every beat, which is what a
    // 30 kg bird holding station over your head actually does. Nothing in the
    // world frame is cancelled by anything.
    const beat = 1 + condorAI_BEAT * Math.sin(condorFlapPhase * 2);
    const sup = mEff * g * beat;
    let fx = (condorSeek.x - vel.x) * mEff * 2.6 + condorUp.x * sup;
    let fy = (condorSeek.y - vel.y) * mEff * 2.6 + condorUp.y * sup;
    let fz = (condorSeek.z - vel.z) * mEff * 2.6 + condorUp.z * sup;
    const fmax = mEff * 46;
    const fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    if (fl > fmax) { const s = fmax / fl; fx *= s; fy *= s; fz *= s; }
    condorBody.force.x += fx; condorBody.force.y += fy; condorBody.force.z += fz;
    // light drag so the seek never rings
    condorBody.force.x -= vel.x * mEff * 0.55;
    condorBody.force.y -= vel.y * mEff * 0.55;
    condorBody.force.z -= vel.z * mEff * 0.55;

    // bank into the turn: the lateral component of what it is asking for
    const latx = -condorSide.x, latz = -condorSide.z;   // bird's right, on the horizon
    const latMag = Math.sqrt(latx * latx + latz * latz);
    const lat = latMag > 1e-3 ? (fx * latx + fz * latz) / latMag : 0;
    targetBank = clamp(lat / (mEff * g) * 1.3, -condorMAX_BANK, condorMAX_BANK);
    targetPitch = clamp((condorSeek.y - vel.y) * 0.035, -condorMAX_PITCH, condorMAX_PITCH);
    condorFlapPhase += (2.4 + clamp(condorSeek.y * 0.25, 0, 4)) * dt;
    condorAiBeat = damp(condorAiBeat, clamp(condorSeek.y * 0.14, 0, 1), 3, dt);
    condorLandSpeed = 0;

    condorGhostTick(dt);
    if (condorState === 'circling' && !(game.state && game.state.noCondorOpen)) condorOpenWatch(dt, cy);
    if (condorShotArmed && (condorState === 'inbound' || condorState === 'circling')) condorShotCheck();

    // Tested last so a mount takes effect from the NEXT frame — the seek force
    // above must not be applied against a constraint that did not exist when it
    // was computed.
    if (condorState === 'circling') condorTryMount(dt);

  } else {
    // ========================================================================
    // FLIGHT — the real thing. Gravity is already in the world; everything else
    // is aerodynamics and the player's wrists.
    // ========================================================================

    // ---- player command: camera-relative stick -----------------------------
    // ACROSS the nose it is a heading command (bank). ALONG the nose it is a TRIM
    // SPEED bias, never a raw elevator angle — see condorSTICK_V.
    //
    // ---- AND THE STICK IS A WRIST, NOT A SWITCH (v20) ----------------------
    // Everything downstream of here — the heading error, the bank command, the
    // trim-speed bias — was being driven off `input.x/z` RAW, and on a keyboard
    // that is a step function: nothing, then a full-deflection command on the
    // next frame, then nothing again when the finger comes off. A step into a
    // heading loop whose plant is roll-rate-then-turn-rate is the textbook way
    // to make an aeroplane feel twitchy, and it is the whole of what "the
    // steering should be smoother" is describing. The aerodynamics are not the
    // problem and none of them are touched: the filter is on the PILOT.
    //
    // Two constants and they do different jobs. condorSTICK_ON is deliberately
    // slower than condorSTICK_OFF, because rolling INTO a turn is a decision
    // (and a big bird takes about a third of a second to make it) whereas
    // coming out of one is letting go, and a control that is sluggish to
    // centre feels like a control that is stuck.
    //
    // It is filtered in CARTESIAN camera space rather than as an angle, so
    // crossing the dead zone from one direction to another sweeps through the
    // middle instead of jumping the long way round the circle.
    let sx = 0, sz = 0, mag = 0;
    if (input) {
      const cyaw = Math.cos(input.camYaw), syaw = Math.sin(input.camYaw);
      let rx = input.x * cyaw + input.z * syaw;
      let rz = -input.x * syaw + input.z * cyaw;
      const rm = Math.sqrt(rx * rx + rz * rz);
      if (rm > 1) { rx /= rm; rz /= rm; }
      const lam = rm > 0.05 ? condorSTICK_ON : condorSTICK_OFF;
      condorStickX = damp(condorStickX, rx, lam, dt);
      condorStickZ = damp(condorStickZ, rz, lam, dt);
      sx = condorStickX; sz = condorStickZ;
      mag = Math.sqrt(sx * sx + sz * sz);
      if (mag > 1) { sx /= mag; sz /= mag; mag = 1; }
    } else {
      condorStickX = damp(condorStickX, 0, condorSTICK_OFF, dt);
      condorStickZ = damp(condorStickZ, 0, condorSTICK_OFF, dt);
    }
    const fhx = condorFwd.x, fhz = condorFwd.z;
    const fh = Math.sqrt(fhx * fhx + fhz * fhz);
    let stickPitch = 0;                         // -1 pull .. +1 push
    if (mag > 0.12 && fh > 1e-3) {
      const nfx = fhx / fh, nfz = fhz / fh;
      const along = (sx * nfx + sz * nfz) / (mag > 1e-4 ? mag : 1);
      // SIGNED HEADING ERROR, positive = the stick lies to the bird's RIGHT.
      // This was inverted, and it is the single reason the bird could never be
      // flown anywhere. With `up` = +Y and `fwd` = +Z the body's +X axis is the
      // bird's LEFT, so its right on the horizon is (-nfz, nfx) and the stick's
      // component along it is nfx*sz - nfz*sx — the negative of what was here.
      // The bank command therefore came out backwards: order the condor east and
      // it rolled west, kept rolling west until the error passed 180 degrees, and
      // then sat locked on the exact reciprocal of the heading it was given.
      // Measured: commanded +X from a northbound start, it settled dead on -X and
      // flew 50 m out of the thermal it was supposed to be circling.
      const cross = nfx * sz - nfz * sx;
      let hErr = Math.atan2(cross, sx * nfx + sz * nfz);
      // ---- THE REVERSAL SINGULARITY -------------------------------------
      // Directly astern, atan2 flips between +pi and -pi on the smallest wobble,
      // so the roll command reverses every few frames, the wings rock, the bird
      // makes no net turn at all — and, being a heading command, it then holds
      // that heading for ever. Measured, that is exactly what a "fly back to the
      // column" order did: commanded east, it settled pointing WEST at 11 m/s
      // and flew 50 m out of the lift before anyone noticed it had never turned.
      // So past 137 degrees the bird COMMITS to a direction and stays committed
      // until the error is small enough to be unambiguous. Which is what a bird
      // does: it picks a side and goes round.
      if (Math.abs(hErr) > 2.4) hErr = condorTurnSign * Math.abs(hErr);
      else if (Math.abs(hErr) > 0.20) condorTurnSign = hErr > 0 ? 1 : -1;
      targetBank = clamp(hErr * 1.35, -condorMAX_BANK, condorMAX_BANK) * mag;
      // ONLY THE PULL HALF OF THE STICK IS AN ELEVATOR. Steering to anywhere at
      // all means holding the stick roughly along the nose, so a push term is
      // biased on almost permanently: measured, that alone trimmed the bird at
      // 20.8 m/s, which is a 21 m turn radius, which is wider than every thermal
      // on the map but Galeras — it simply flew out of the lift every time. Pull
      // (the stick held BEHIND the nose, i.e. a reversal) slows the trim and opens
      // the stall; going faster is SHIFT, which is a deliberate act.
      stickPitch = clamp(along * mag, -1, 0);
    }

    // ---- TRIM: an ANGLE OF ATTACK schedule, never a pitch attitude ---------
    // Three terms, and only the first one is aerodynamics:
    //   (i)   the angle of attack that trims the turn's load factor at THIS
    //         airspeed. Slow, it asks for a lot; and because the ask is CLAMPED
    //         below the stall, slow means the wing simply cannot hold the bird up
    //         and the nose drops. That is the speed stability.
    //   (ii)  a speed error term, so the bird returns to a trim speed rather than
    //         drifting anywhere the phugoid leaves it.
    //   (iii) a damper on the air-relative flight path, 90 deg out of phase with
    //         (ii), which is what actually kills the phugoid.
    const vRef = rsp > 7 ? rsp : 7;
    const cosB = Math.cos(bank) > 0.34 ? Math.cos(bank) : 0.34;
    // BANK ANGLE PROTECTION, from the load factor the wing can actually make at
    // this airspeed rather than from a hand-fitted line. A 49 deg turn is 1.5 g;
    // asking for it at 9 m/s is a spiral dive, and the bird now simply refuses.
    // The load factor is the one the wing can hold ALL DAY (condorAOA_SUSTAIN,
    // comfortably below the stall), not the one it can touch for an instant: a
    // turn flown at the momentary maximum leaves the trim loop nothing to hold
    // the airspeed with, and measured it simply decayed — 15 -> 11 -> 7 m/s and
    // over the back of the lift curve in four seconds, in a thermal.
    const nMax = clamp(condorCL * condorCLShape(condorAOA_SUSTAIN) * vRef * vRef / g, 1.0, 3.2);
    // ...with a floor, because a bird that cannot bank at all cannot point itself
    // back at the lift either, and "wings locked level" is its own kind of trap.
    const bankMax = Math.min(condorMAX_BANK, Math.max(0.26, Math.acos(clamp(1 / nMax, 0.05, 1))));
    // HOW HARD THE PILOT IS ASKING TO TURN, taken BEFORE the protection clamps it
    // and before the wing has done anything about it. The circling-speed schedule
    // below is driven off this and not off the bank the bird actually has, and the
    // difference is the difference between a stable aeroplane and a limit cycle:
    // keyed to the achieved bank the loop closes on itself — slower trim raises the
    // angle of attack, which lowers the protection's bankMax, which unbanks the
    // bird, which speeds the trim back up — and MEASURED it swung the airspeed
    // between 4 and 22 m/s on a three-second period and put the bird in the plaza.
    // The stick has no such feedback path: it is the player's wrist.
    const bankAsk = Math.abs(targetBank);
    targetBank = clamp(targetBank, -bankMax, bankMax);
    // STALL RECOVERY IS WINGS-LEVEL, NOSE-DOWN. Holding bank into a stalled wing
    // is the spiral; the elevator below is already lowering the nose, and this is
    // the other half of it.
    if (aoa > condorAOA_STALL) targetBank *= clamp(1 - (aoa - condorAOA_STALL) * 5, 0, 1);
    let vTrimCmd = condorTRIM_V * (1 + condorSTICK_V * stickPitch);
    // ---- A SOARING BIRD CIRCLES SLOWLY. THIS IS THE WHOLE THERMAL FIX -------
    // The turn RADIUS is v^2 / (g tan phi), so the speed the bird chooses to
    // circle at decides, on its own, whether it can stay inside a column at all.
    // This line used to trim the bird FASTER as it banked (*1.08 at 49 deg) and
    // the plaza column is 13 m in radius: MEASURED, entering it at 21 m/s with
    // 49 deg on gave a 14 m turn radius, a 28 m circle across a 26 m column, and
    // the bird spent most of every lap outside the lift — mean updraft 2.0 m/s
    // against 1.5 of sink, a net 0.5 m/s, and the climb asymptoted at 30 m after
    // fifty seconds. It is not a lift problem, it is a geometry problem.
    // So a hard bank now commands a SLOWER cruise, which is exactly what a condor
    // does when it finds lift: at 13.2 m/s and the 43 deg the protection settles
    // on, the radius is 7.8 m, the whole circle sits inside the core, and the
    // measured mean updraft is 3.9 m/s against 2.0 of sink.
    // Nothing here is a force. It is the speed the autopilot aims for; the wing
    // still has to buy it by lowering the nose, and gravity still does all the
    // work of getting there.
    const circF = clamp((bankAsk - condorCIRC_BANK0) / condorCIRC_BAND, 0, 1);
    vTrimCmd = lerp(vTrimCmd, condorCIRC_V, circF);
    if (input && input.run) vTrimCmd = condorVMAX * condorTUCK_V;      // tuck and run
    const aoaBase = condorTrimAoA(1 / cosB, vRef, g);
    // THE SPEED TERM HAS TO BE ABLE TO BEAT THE LOAD-FACTOR TERM. aoaBase on its
    // own trims one gravity at WHATEVER speed the bird happens to have, so it is
    // neutrally stable in speed: with a weak speed term the bird found a perfectly
    // valid equilibrium at 10 m/s and angle of attack 0.30 and sat there — level
    // through the airmass, too slow to bank (see the protection above), unable to
    // circle a column. At 10 m/s aoaBase asks for 0.31, so the speed term needs
    // authority of the same order or it is decoration.
    // ...and the damper has to be raised with it. P on the speed error is the
    // phugoid's own feedback path: crank it without the derivative and the bird
    // porpoises, measured 0.3 to 4.2 m/s of sink on a 3 s period. In an
    // energy-conserving phugoid the flight-path angle IS the speed derivative
    // (dv/dt = -g*sin(gamma)), so this term is the derivative that damps it, and
    // it is zero in a steady glide so it costs the trim nothing.
    // Asymmetric on purpose: being slow is the dangerous side of trim (it ends in
    // the mush), being fast is merely untidy, so the nose-down authority is half
    // again the nose-up authority. It also stops a sustained turn settling 3 m/s
    // below the speed it was asked for.
    const vErr = condorSpeedSm - vTrimCmd;
    // Gains stay modest BECAUSE aoaBase is now one-sided: the lift itself is the
    // speed spring (it goes as v^2 at a fixed angle of attack), so this term only
    // has to bias the trim, not manufacture the stability. Raising it to 0.060
    // on top of the one-sided base doubled the nose-down authority when slow and
    // measured a divergent phugoid — 3.4 to 24 m/s and into the plaza.
    const trimP = clamp(vErr * (vErr < 0 ? 0.048 : 0.030), -0.26, 0.20);
    // ---- THE PHUGOID DAMPER, SIZED RATHER THAN GUESSED ---------------------
    // Linearising the loop above: with alpha = kp*dv - kd*dgamma, dv' = -g*dgamma
    // and gamma' = 4*CL*v*dalpha, the closed loop is s^2 + (a*kd) s + a*kp*g with
    // a = 4*CL*v = 6.9 at trim. That puts the natural period at 2.45 s — and the
    // MEASURED oscillation was 2.3-2.5 s, so this is the mode, not a guess. At the
    // old kd = 0.60 the damping ratio is 0.80 on paper, but the term CLAMPED at
    // 0.16 rad of nose-up, which a 0.3 rad flight-path excursion blows straight
    // through: past that the damper is a constant and the loop is bang-bang. It
    // never settled. Measured in cruise it held +/- 5 m and 8.8-21.7 m/s for ever,
    // and — because the trough of every cycle put the bird low enough to trip the
    // ground-avoidance wingbeat — it was being PUMPED: 58 J/kg per cycle of honest
    // nose thrust, added at the bottom, banked as height at the top. That is what
    // delivered the bird to a 13 m thermal at 21.7 m/s in a dive.
    // kd = 1.15 is a damping ratio of 1.5 (deliberately over-damped: a bird with
    // prey in its feet is not a sailplane), and the clamps are opened past the
    // excursions the term is supposed to kill so it stops being bang-bang. It is
    // still exactly zero in a steady glide, so the trim, the sink and the glide
    // ratio are all untouched — only the transient changes.
    const trimD = clamp((condorGLIDE_ANG - pathAng) * 1.15, -0.34, 0.30);
    // The ceiling is the whole fix. The automatic elevator may never stall the
    // wing; only a deliberate hard pull (stick held BEHIND the nose) can, which is
    // also a hard reversal turn — exactly the manoeuvre that should be able to
    // break it. The G limit rides on top so the wing is never overloaded either.
    const aoaG = condorTrimAoA(condorG_LIMIT, vRef, g);
    const ceil = Math.min(stickPitch < -0.6 ? condorAOA_MAX : condorAOA_TRIM_MAX,
                          aoaG > 0.05 ? aoaG : 0.05);
    let targetAoA = clamp(aoaBase + trimP + trimD, condorAOA_MIN, ceil);

    // ---- soft world edge: bank it home, don't wall it ---------------------
    const px = condorBody.position.x, pz = condorBody.position.z;
    const outX = Math.abs(px) - condorEDGE_SOFT, outZ = Math.abs(pz) - condorEDGE_SOFT;
    const out = Math.max(outX, outZ);
    if (out > 0 && fh > 1e-3) {
      const w = clamp(out / (condorEDGE_HARD - condorEDGE_SOFT), 0, 1);
      const hx = -px, hz = -pz;
      const hl = Math.sqrt(hx * hx + hz * hz) || 1;
      const nfx = fhx / fh, nfz = fhz / fh;
      // same right-hand convention as the stick above — this was inverted too, so
      // the "soft edge" used to bank the bird straight OUT over the world border
      const cross = nfx * (hz / hl) - nfz * (hx / hl);
      const hErr = Math.atan2(cross, (hx / hl) * nfx + (hz / hl) * nfz);
      targetBank = lerp(targetBank, clamp(hErr * 1.5, -condorMAX_BANK, condorMAX_BANK), w);
      condorBody.force.x += (hx / hl) * mEff * 6 * w;
      condorBody.force.z += (hz / hl) * mEff * 6 * w;
    }
    // ---- ...AND A SOFT EDGE IS NOT A WORLD BOUNDARY (v20) -----------------
    // Everything above is a persuasion: a bank home and 0.6 g of nudge, both
    // saturating at 130 m and neither of them able to stop a bird that is
    // pointed out and diving. Past the persuasion there has to be something
    // that CANNOT be argued with, because outside pasto.bounds() there is no
    // rigid body at all — the four heightfield strips end, the analytic terrain
    // does not, and a capybara put down out there falls until the session ends.
    // Galeras makes this reachable rather than theoretical: the cone is centred
    // at z = -70 with a 70 m radius, so flying up the volcano and over the top
    // takes the bird straight at the one edge its own apron already crosses.
    //
    // The fence removes only the OUTWARD component of velocity, so the bird
    // slides along it and keeps every bit of the speed it was carrying parallel
    // to it. That is a wall you can lean on rather than one you hit, and it is
    // invisible unless you go looking for it.
    condorFence(dt);

    // ---- SEE THE GROUND — with the PASSENGER on the end of the string ------
    // See condorGND_CLEAR. This is the fix for the crater. There is no force
    // here and no rail: the clearance under the capybara (now, and along the
    // ground track) simply commands the elevator, levels the wings so the whole
    // lift vector points up, and calls for a beat. It is exactly the input a
    // pilot gives, and the bird then has to buy the climb with its own wing.
    const gClear = condorClearance(vel);
    if (gClear < condorGND_CLEAR) {
      const u = clamp(1 - gClear / condorGND_CLEAR, 0, 1);
      // A PULL IS ONLY WORTH ANYTHING IF THERE IS AIRSPEED TO PULL WITH. Hauling
      // the stick back at 9 m/s is how you arrive at the hillside slower, not
      // higher — measured, an unconditional pull to the trim ceiling turned every
      // low pickup into a mush at 0.8 m/s and the wedge check then let go. So the
      // pull is scaled by the margin over the stall AND capped at the angle the
      // wing can hold all day; when the bird is slow the right answer near the
      // ground is to keep flying, and the beat below is what buys the climb.
      const able = clamp((airspeed - condorSTALL) / (condorTRIM_V - condorSTALL), 0, 1);
      // ---- AND A PULL-UP IS FINISHED WHEN THE BIRD IS GOING UP --------------
      // This was the pump that survived every other fix. The pull was a function
      // of clearance alone, so a bird that had ALREADY answered — nose up, climbing
      // hard — went on being told to pull, because the clearance under it had not
      // caught up yet. MEASURED, the flight path reached +1.25 rad (72 degrees nose
      // up) over the flat plaza, the airspeed fell to 4.1 m/s at the top of it, the
      // bird fell out of the resulting stall back to 3 m and did it again: a
      // 20-metre porpoise from the cobbles to 25 m, once every 3 seconds, and the
      // 1.3 m/s airspeed at thermal entry was the top of one of these. A pilot
      // pulls until the aeroplane is climbing and then stops pulling. So does this.
      //
      // And it LEADS the flight path rather than trailing it. Gated on the angle
      // the bird has this instant, the elevator kept pulling all the way through
      // the rotation and the nose sailed past the 17 degrees asked for to 48 —
      // a zoom that arrives at 5.4 m/s. condorPathRate is the rate the path is
      // already turning at, so a third of a second of it is the climb the pull has
      // already bought and not yet been charged for.
      const pathLead = pathAng + condorPathRate * condorGND_LEAD;
      const needClimb = clamp((condorGND_PATH - pathLead) / condorGND_PATH, 0, 1);
      const want = Math.min(condorAOA_SUSTAIN, ceil) * u * able * needClimb;
      if (want > targetAoA) targetAoA = want;
      // Wings level, so the whole lift vector points up...
      targetBank *= 1 - u * 0.85;
      // ...until the ground is close enough that a pull alone cannot do it, and
      // then TURN ALONG THE SLOPE. Measured, the terrain into the Galeras crater
      // rises 27 m across the 22 m of ground track the lookahead covers — four
      // times the best climb gradient this wing has, so a bird that only ever
      // pulls flies into the wall no matter how early it starts. What a soaring
      // bird does with a hillside is fly along it, so the autopilot samples the
      // ground either side of its track and banks toward the lower one. On the
      // Galeras flank that is also, conveniently, where the lift is.
      const tw = clamp((u - 0.35) / 0.4, 0, 1);
      const sh = Math.sqrt(condorSide.x * condorSide.x + condorSide.z * condorSide.z);
      if (tw > 0 && sh > 1e-3) {
        const ax2 = px + vel.x * condorGND_LOOK, az2 = pz + vel.z * condorGND_LOOK;
        const ox = (condorSide.x / sh) * 18, oz = (condorSide.z / sh) * 18;
        // +side is the bird's LEFT (see the stick's heading convention above)
        const hL = condorGroundTop(ax2 + ox, az2 + oz);
        const hR = condorGroundTop(ax2 - ox, az2 - oz);
        targetBank = lerp(targetBank, clamp((hL - hR) * 0.08, -bankMax, bankMax), tw);
      }
      // ---- THE BEAT, ON THREE CONDITIONS INSTEAD OF ONE ---------------------
      // Deep into the margin the bird beats, and then it may beat continuously:
      // this is the one situation where the wingbeat cooldown is the wrong answer.
      // But the beat is 9 m/s^2 of thrust along the nose, and on a single clearance
      // test it was the engine that drove the whole low-level porpoise. It now
      // needs all three:
      //   u > 0.55       — really low (3.2 m under the capybara), not merely low.
      //                    At the old 0.3 it fired at 4.9 m, which over the flat
      //                    plaza is simply where the bird cruises, so it lit at the
      //                    bottom of every phugoid cycle and added 58 J/kg a lap.
      //   needClimb      — not already climbing. Thrust into an aircraft that has
      //                    answered is a pump, not a save.
      //   below trim     — and actually SLOW. This was the worst of the three: the
      //                    beat fired in the DIVE, where the clearance is worst and
      //                    the airspeed is highest, which is exactly where thrust
      //                    does nothing for the problem and everything for the next
      //                    zoom. MEASURED, the cruise diverged on it — troughs at
      //                    6.5, 4.8 and 0.7 m with 15.7, 18.4 and 22.2 m/s at the
      //                    bottom of each.
      // A bird low and FAST already has the energy and should spend it on the pull;
      // a bird low and SLOW has nothing to pull with, and that is what wings are for.
      // The PULL above is untouched and still scales smoothly from the first metre.
      if (u > 0.55 && needClimb > 0.25 && airspeed < condorTRIM_V) {
        if (condorFlapT <= 0) { condorFlapT = condorFLAP_T; condorFlapPhase = 0; }
        condorFlapCool = 0;
      }
    }

    // The elevator is an ANGLE OF ATTACK loop. Expressing it as an attitude error
    // (rather than an absolute commanded pitch that has to be clamped somewhere)
    // is what lets the nose follow a vertical flight path without saturating.
    targetPitch = pitch + clamp(targetAoA - aoa, -0.9, 0.9);

    // ---- LIFT: CL * v^2, PERPENDICULAR TO THE RELATIVE WIND ---------------
    // This is the change that makes the bird an aircraft instead of a parachute.
    // Lift applied along the body's own up-axis, scaled by the wind components in
    // the plane of symmetry, is only correct while the nose is roughly on the
    // flight path. Let the nose fall away from the path — a gust, a thermal
    // entry, a botched turn — and that formulation reports almost no airspeed,
    // makes almost no lift, and hands the whole job of holding the bird up to the
    // drag terms, which point wherever the airflow does. Measured, that state was
    // absorbing: airspeed 15 -> 6 m/s and 10 m/s of sink, for ever.
    //
    // The textbook decomposition has no such hole. Lift is CL * V^2 acting at
    // right angles to the airflow, in the plane spanned by the airflow and the
    // wing normal; drag is CD * V^2 straight down the airflow. V is the FULL
    // relative wind. Bank tilts the wing normal, which tilts the lift vector,
    // which curves the flight path: the turn is unchanged. What changes is that
    // there is no attitude at which the wing quietly stops being a wing.
    if (rsp > 0.5) {
      const inv = 1 / rsp;
      const vhx = condorRel.x * inv, vhy = condorRel.y * inv, vhz = condorRel.z * inv;
      const d = condorUp.x * vhx + condorUp.y * vhy + condorUp.z * vhz;
      let lx = condorUp.x - vhx * d, ly = condorUp.y - vhy * d, lz = condorUp.z - vhz * d;
      const ll = Math.sqrt(lx * lx + ly * ly + lz * lz);
      if (ll > 1e-3) {
        lx /= ll; ly /= ll; lz /= ll;
        let lift = condorCL * mEff * rsp * rsp * condorCLShape(aoa);
        const liftCap = condorLIFT_CAP * mEff * g;
        if (lift > liftCap) lift = liftCap;
        condorBody.force.x += lx * lift;
        condorBody.force.y += ly * lift;
        condorBody.force.z += lz * lift;
      }
    }

    // ---- DRAG: along -(relative wind), plus a span-wise wall ---------------
    // Bounded (condorCD_MAX): broadside to the airflow the bird is a parachute at
    // ~9.6 m/s of descent, which is a fall, not a hover. Unbounded it was a floor.
    if (rsp > 1e-3) {
      const s = condorCDShape(aoa) * mEff * rsp;
      condorBody.force.x -= condorRel.x * s;
      condorBody.force.y -= condorRel.y * s;
      condorBody.force.z -= condorRel.z * s;
    }
    if (speed > 26) {                     // approaching the hard ceiling
      const s = (speed - 26) * mEff * 3.0 / speed;
      condorBody.force.x -= vel.x * s;
      condorBody.force.y -= vel.y * s;
      condorBody.force.z -= vel.z * s;
    }
    // SPAN-WISE DRAG, CAPPED — see condorSIDE_CAP. Uncapped this term was the
    // same bug the plunge term used to have: measured against the relative wind,
    // so a banked bird in a column reads the updraft as sideslip and gets 19 m/s^2
    // of upward "drag" at zero airspeed. A drag term may stop a slip; it may never
    // carry the aircraft.
    let sideA = -(condorCD_SIDE * Math.abs(vSide) + condorCD_SIDE_LIN) * vSide;
    const sCap = condorSIDE_CAP * g;
    if (sideA > sCap) sideA = sCap; else if (sideA < -sCap) sideA = -sCap;
    const sideF = sideA * mEff;
    condorBody.force.x += condorSide.x * sideF;
    condorBody.force.y += condorSide.y * sideF;
    condorBody.force.z += condorSide.z * sideF;
    // PLUNGE, ON A LEASH. See condorPLUNGE_CAP: this is a small damper on the
    // wing's motion through its own plane, and it is capped at a fraction of the
    // bird's weight precisely so it can never be the thing carrying the aircraft.
    let plungeA = -condorCD_PLUNGE * vUp;
    const pCap = condorPLUNGE_CAP * g;
    if (plungeA > pCap) plungeA = pCap; else if (plungeA < -pCap) plungeA = -pCap;
    condorBody.force.x += condorUp.x * plungeA * mEff;
    condorBody.force.y += condorUp.y * plungeA * mEff;
    condorBody.force.z += condorUp.z * plungeA * mEff;

    // (thermals were folded into the relative wind above — the ONLY net climb)

    // ---- LAUNCH ASSIST: the tail of the pickup beat, fading to nothing -----
    // THRUST ALONG THE NOSE — see condorLAUNCH_THRUST. This was `force.y +=
    // mEff * g * condorLaunchLift`, i.e. gravity switched off for 3.2 s after
    // every grab: +10.1 m and +157 J/kg out of nothing in still air, farmable by
    // re-grabbing. Gravity is now never cancelled anywhere in the carrying branch.
    if (condorLaunchLift > 0) {
      condorLaunchLift -= dt / condorLAUNCH_T;
      if (condorLaunchLift < 0) condorLaunchLift = 0;
      // ...and it is gated on being SLOW. Ungated, 3.2 s of nose thrust is 205
      // J/kg of work, which the trim loop banks as height: measured, the bird
      // still climbed 5 -> 20 m out of a pickup in dead air, which is the same
      // free-altitude bug wearing a different hat. The beat exists to get the
      // wing to flying speed and for no other reason, so it fades out as the
      // airspeed arrives and is worth nothing at all once the bird is at trim.
      const need = clamp((condorTRIM_V - airspeed) / condorTRIM_V, 0, 1);
      const lth = mEff * condorLAUNCH_THRUST * condorLaunchLift * need;
      condorBody.force.x += condorFwd.x * lth;
      condorBody.force.y += condorFwd.y * lth;
      condorBody.force.z += condorFwd.z * lth;
    }

    // ---- STALL: reachable, and it tells you --------------------------------
    // condorAOA_MAX is above condorAOA_STALL, so a hard pull breaks the wing.
    // A break the player cannot feel teaches nothing, so it drops a wing.
    if (aoa > condorAOA_STALL + 0.02) {
      if (!condorStalled) {
        condorStalled = true;
        // DETERMINISTIC. This was seeded with rand(), and it writes the angular
        // VELOCITY — a physics quantity — so two runs from byte-identical initial
        // conditions diverged completely: one settled into a 0.4 m/s hover at
        // y = 50, the next climbed to y = 107 and despawned. That made the whole
        // module untestable by measurement and is almost certainly why successive
        // QA reports disagreed with each other. A stalling wing drops the wing
        // that was ALREADY low, by an amount set by how far past the break it is:
        // same effect on the player, and it is reproducible.
        const drop = (bank >= 0 ? 1 : -1) * (2.2 + clamp((aoa - condorAOA_STALL) * 6, 0, 1.2));
        condorBody.angularVelocity.x += condorFwd.x * drop;
        condorBody.angularVelocity.y += condorFwd.y * drop;
        condorBody.angularVelocity.z += condorFwd.z * drop;
        if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 1, pitch: 0.38 });
        if (typeof game.shake === 'function') game.shake(0.22);
      }
    } else if (aoa < condorAOA_STALL - 0.08) {
      condorStalled = false;
    }

    // ---- FLAP: a save, not a jetpack. THE PLAYER PRESSES IT ----------------
    // The voice key (input.honk) is unbound in flight, so the flap is bound to it and the
    // automatic fire survives only as a floor at genuinely dead airspeed. It can
    // never be a jetpack: at full AoA drag accel is 0.42*v^2, which passes the
    // flap's 15 m/s^2 of thrust by v = 6, so it buys a save and never a cruise.
    if (condorFlapT > 0) {
      condorFlapT -= dt;
      const beat = 0.5 + 0.5 * Math.sin(condorFlapPhase);
      // THRUST ALONG THE NOSE, AND NOTHING ELSE — see condorFLAP_THRUST. The
      // vertical term that used to live on the next line was 72% of the bird's
      // weight at the top of every beat; sustained, that is a jetpack and the
      // thermals stop mattering.
      condorBody.force.x += condorFwd.x * mEff * condorFLAP_THRUST * beat;
      condorBody.force.y += condorFwd.y * mEff * condorFLAP_THRUST * beat;
      condorBody.force.z += condorFwd.z * mEff * condorFLAP_THRUST * beat;
      condorFlapPhase += 9.5 * dt;
      if (condorFlapT <= 0) condorFlapCool = condorFLAP_COOL;
    } else {
      if (condorFlapCool > 0) condorFlapCool -= dt;
      const wantFlap = !!(input && input.honkPressed) || airspeed < condorSTALL * 0.6;
      if (condorFlapCool <= 0 && wantFlap) {
        condorFlapT = condorFLAP_T;
        condorFlapPhase = 0;
        if (typeof game.sfx === 'function') game.sfx('rustle', { volume: 0.8, pitch: 0.7 });
      }
      condorFlapPhase += clamp(airspeed * 0.10, 0.5, 2.2) * dt;
    }

    // ---- hard speed ceiling ----------------------------------------------
    if (speed > condorVMAX) {
      const s = damp(speed, condorVMAX, 6, dt) / speed;
      vel.x *= s; vel.y *= s; vel.z *= s;
    }

    condorFlightFeedback(dt, airspeed, speed);
    condorCheckPeak();

    // ---- release ----------------------------------------------------------
    // Holding something turns the action key into a BOMB RELEASE rather than a
    // dismount: capybara.js has already thrown the prop by the time this runs,
    // and letting go of the bird in the same frame threw the capybara after it.
    // Posting an empanada into Galeras from three hundred feet is the best joke
    // in the chapter and it was unreachable. Whistle still always lets go.
    const threw = !!(game.capy && game.capy.threwAt === game.state.time);
    // GRAB ONLY. The voice key is the flap, and now that the whistle and the
    // wheek are one button, leaving the dismount on the whistle would mean every
    // flap threw the passenger off the bird.
    if (input && (input.actionPressed && !threw)) {
      condorRelease(false);
    }
  }

  // ==========================================================================
  // ATTITUDE — torques only. The quaternion is never written.
  // ==========================================================================
  condorAttitude(dt, targetBank, targetPitch, bank, pitch, airspeed, mounted, mEff,
                 condorState === 'carrying' ? condorPathRate : 0);

  // ==========================================================================
  // The dangling capybara: put back the velocity the solver actually gave it.
  // capybara.js clamps horizontal speed to walking pace every frame, which at
  // 20 m/s is 5 g of imaginary brakes on the constraint. Not while it dangles.
  // ==========================================================================
  if (capy && capy.body) {
    if (condorState === 'carrying') {
      capy.body.velocity.copy(condorVelSnap);
      capy.carriedBy = condorApi;
      condorSwingCapy(dt, capy);
    } else if (condorLaunchGrace > 0) {
      condorLaunchGrace -= dt;                    // safety expiry only
      const terr = condorTerrain(capy.body.position.x, capy.body.position.z);
      // Water owns a released passenger as soon as it enters. Keeping the
      // ballistic snapshot through a swim overwrites the buoyancy drag below.
      if (capy.grounded || capy.swimming || capy.body.position.y < terr + 0.6) {
        condorLaunchGrace = 0;
        condorTumbleX = 0; condorTumbleY = 0; condorTumbleZ = 0;
        condorSettleT = condorSETTLE_T;           // unwind, do not snap
      } else {
        capy.body.velocity.copy(condorVelSnap);   // undamped ballistic arc
        condorTumbleCapy(dt, capy);
      }
    }
  }

  condorFrameFresh = true;              // see condorHoldForces
  condorAnimate(dt, airspeed, bank, pitch, mounted);
  condorRender(dt);
}

// ---------------------------------------------------------------------------
/** Updraft speed of the airmass at the bird, m/s. Guarded for a missing host. */
function condorThermalUpdraft() {
  let cols = condorHostThermals(condorHost());
  if (!cols || !cols.length) cols = condorFallbackThermals;
  const px = condorBody.position.x, py = condorBody.position.y, pz = condorBody.position.z;
  let w = 0;
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (!c) continue;
    const r = c.radius || 0;
    if (r <= 0) continue;
    const top = c.top === undefined ? 999 : c.top;
    if (py > top) continue;
    const dx = px - c.x, dz = pz - c.z;
    const n = (dx * dx + dz * dz) / (r * r);      // normalised radial distance, squared
    if (n >= 1) continue;
    // Falls off toward the wall and feathers out over the last 8 m so the top of
    // the column is not a cliff edge. The fractional power (rather than a straight
    // 1 - n) widens the usable core, and it has to be wide: MEASURED, a thermalling
    // turn holds a 10-16 m radius, and in a 13-16 m column a 0.7 power put most of
    // that circle in air rising at 2 m/s against 1.5 m/s of sink — technically
    // climbing, at half a metre a second, which reads as broken. 0.45 keeps the
    // axis speed exactly as authored and flattens the bowl underneath it.
    // 0.35, not 0.45, for the same reason the floor moved: MEASURED, a bird
    // weaving through the plaza column under a player's thumb sits at 8-11 m from
    // the axis for most of every lap, and 0.45 gave it 3.5-4.1 m/s out there
    // against 1.9 of turning sink. The axis value is untouched either way — this
    // only flattens the bowl underneath it.
    const s = (condorTHERMAL_FLOOR + (c.strength || 8) / condorTHERMAL_ACC_PER_MS) *
              Math.pow(1 - n, 0.35) * clamp((top - py) / 8, 0, 1);
    if (s > w) w = s;                              // strongest column wins, never additive
  }
  return w > condorTHERMAL_MAX ? condorTHERMAL_MAX : w;
}

// ---------------------------------------------------------------------------
function condorAttitude(dt, tBank, tPitch, bank, pitch, airspeed, mounted, mEff, qPath) {
  void dt;
  // Control authority comes from airflow, with a floor so a stalled bird can
  // still right itself instead of tumbling forever.
  const auth = clamp(airspeed / 13, 0.30, 1.7);
  // A 30 kg capybara swinging under the talons is most of the roll inertia.
  const I = 0.4 * condorMASS * condorRADIUS * condorRADIUS * (mounted ? 4.4 : 1);
  const w = condorBody.angularVelocity;

  // ---- THE KEEL, CANCELLED ------------------------------------------------
  // The constraint hangs the capybara's whole weight off a pivot 0.98 m below the
  // condor's centre of mass, so the passenger is a pendulum keel: r x F is a
  // restoring moment that fights every commanded attitude and grows with the sine
  // of the tilt. Measured, it held the bird to an 11 degree dive on full forward
  // stick — no dive means no speed, and no speed means no zoom climb. Chasing it
  // with raw gain only trades a standing error for a ringing one, so it is
  // cancelled where it comes from, as a feed-forward. 0.85, not 1.0: the last
  // fraction of the keel is what keeps the bird from flying inverted, and a bird
  // with prey in its feet genuinely does hang a little pendulous.
  //
  // The moment is derived, not guessed. For a rigid two-body system the tension
  // in the cord is T = m_capy * F_aero / m_total (gravity cancels: both bodies
  // fall at the same rate), the reaction on the condor is -T at the talon, and so
  // the moment about the condor's centre of mass is -(m_capy/m_total) * (r x
  // F_aero). Note what that says: in trimmed flight F_aero is almost parallel to
  // the talon arm, the cross product is nearly zero and the keel costs nothing —
  // it only bites in a push-over, exactly where the dive was being strangled.
  // F_aero is condorBody.force: cannon-es adds gravity inside the step, so at
  // this point the accumulator holds only lift, drag, flap and the edge nudge.
  if (mounted) {
    const share = ((mEff - condorMASS) / mEff) * 0.9;
    condorBody.quaternion.vmult(condorTalonLocal, condorMomArm);
    condorMomF.set(condorBody.force.x * share, condorBody.force.y * share, condorBody.force.z * share);
    condorMomArm.cross(condorMomF, condorMomF);          // tau = r x F
    condorBody.torque.x += condorMomF.x;
    condorBody.torque.y += condorMomF.y;
    condorBody.torque.z += condorMomF.z;
  }

  // ---- THE TURN THE BIRD IS ALREADY IN ------------------------------------
  // A coordinated turn is not a disturbance, it is a body rate the bird must HOLD:
  // banked by phi at speed v it rotates about the world vertical at g tan(phi)/v,
  // which in the body frame is a steady nose-up pitch rate AND a steady yaw rate.
  // Rate dampers that do not know this fight the turn every frame — measured, a
  // held turn ran a third of a radian of standing attitude error, mushed the wing
  // to the stall and bled 14 m/s to 5 in two seconds. So the expected rates are
  // computed and the dampers only ever see the ERROR against them.
  // THE FEED-FORWARD IS ONLY VALID WHILE THE WING IS FLYING. The expected turn
  // rate g*tan(phi)/v goes to infinity as the airspeed goes to zero, and at 7 m/s
  // and 40 degrees of bank it was telling the pitch damper to expect 1.9 rad/s of
  // nose-up rotation. A stalled bird is not in that turn — but the damper dutifully
  // added nose-up torque to produce the rate it had been promised, and held the
  // bird in the mush that killed it. So the reference speed has a floor, the rate
  // has a ceiling, and the whole term fades out once the wing lets go.
  const vT = airspeed > 12 ? airspeed : 12;
  const gT = -condorGame.world.gravity.y;
  const bT = clamp(bank, -1.2, 1.2);
  const flying = clamp(1 - (condorAoASm - condorAOA_STALL) * 4, 0, 1);
  const omegaY = clamp(-gT * Math.tan(bT) / vT, -2.2, 2.2);   // turn rate about world +Y
  const qExp = -omegaY * condorSide.y * flying;     // the same rate seen as pitch

  // roll about the world forward axis: +bank = right wing down
  const rollRate = w.x * condorFwd.x + w.y * condorFwd.y + w.z * condorFwd.z;
  // GAINS AGAINST THE KEEL. The constraint hangs 30 kg from a pivot 0.98 m below
  // the centre of mass, so the passenger is a pendulum keel: 720 N on a 1 m arm
  // is ~325 N.m of restoring moment at 30 deg of tilt, all of it trying to hold
  // the bird level. Measured, the old gains left ~0.35 rad of standing attitude
  // error against it — commanded -0.22 of angle of attack, achieved -0.12 — which
  // is why a dive would not steepen and there was no energy for a zoom climb.
  let aRoll = (tBank - bank) * 30 - rollRate * 9.0;
  aRoll = clamp(aRoll, -34, 34) * auth;
  condorBody.torque.x += condorFwd.x * I * aRoll;
  condorBody.torque.y += condorFwd.y * I * aRoll;
  condorBody.torque.z += condorFwd.z * I * aRoll;

  // pitch about the span axis (elevator): nose up is -side
  // qPath is the rate the FLIGHT PATH is rotating at. Riding a curving path is
  // not a disturbance either — it is a pitch rate the bird must hold — and a rate
  // damper that does not know about it leaves (Kd/Kp) * qPath of permanent angle
  // of attack error. Measured in a steep descent that was 0.25 rad, i.e. the wing
  // sat 0.25 rad past what the elevator had asked for, which is most of a stall.
  const pitchRate = -(w.x * condorSide.x + w.y * condorSide.y + w.z * condorSide.z);
  let aPitch = (tPitch - pitch) * 36 - (pitchRate - qExp - (qPath || 0)) * 9.0;
  aPitch = clamp(aPitch, -36, 36) * auth;
  condorBody.torque.x -= condorSide.x * I * aPitch;
  condorBody.torque.y -= condorSide.y * I * aPitch;
  condorBody.torque.z -= condorSide.z * I * aPitch;

  // WEATHERVANE, not a turn control: a tail fin dragging the nose onto the
  // velocity vector. Banking turns the bird; this is only what follows.
  const vel = condorBody.velocity;
  const vh = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  const fh = Math.sqrt(condorFwd.x * condorFwd.x + condorFwd.z * condorFwd.z);
  if (vh > 1.2 && fh > 1e-3) {
    const nfx = condorFwd.x / fh, nfz = condorFwd.z / fh;
    const nvx = vel.x / vh, nvz = vel.z / vh;
    // (fwd x vel).y — positive means the velocity lies at a positive rotation
    // about +Y from the nose, which is the direction the torque must push.
    const cross = nfz * nvx - nfx * nvz;
    const yawErr = Math.atan2(cross, nfx * nvx + nfz * nvz);
    const aYaw = clamp(yawErr * 7.0 * clamp(vh / 14, 0, 1.4) - (w.y - omegaY) * 3.0, -12, 12);
    condorBody.torque.y += I * aYaw;
  }
}

// ---------------------------------------------------------------------------
/** A REAL PENDULUM, integrated here.
 *
 *  The P2P constraint cannot produce a swing: capybara.js drives its own
 *  angularVelocity.y from yaw intent and erases roll/pitch every single frame
 *  (it re-derives the quaternion from yaw alone), so the solver has no rotational
 *  degree of freedom left to give. The previous version faked it by mirroring the
 *  horizontal position offset onto the render root — but with 1e6 of constraint
 *  stiffness that offset is an exact algebraic function of the bird's bank, so
 *  the lean was a rigid mirror with no overshoot, no ring, and dead flat in
 *  straight-and-level flight.
 *
 *  So the DOF lives here: a 2-axis spherical pendulum in the talon frame, driven
 *  by the talon's own acceleration, with its own inertia and its own damping. It
 *  overshoots a rolled-in turn and rings out of it, which is the joke.
 *
 *  o'' = -(g/L) o  -  a_pivot  -  c o'      (o = horizontal bob offset, metres)
 *  Semi-implicit Euler; omega = sqrt(24/1.45) = 4.1 rad/s, zeta = 0.18. */
function condorSwingCapy(dt, capy) {
  if (!capy.group) return;
  const g = -condorGame.world.gravity.y;
  const L = condorHANG;
  const v = condorBody.velocity;
  const ax = clamp((v.x - condorPrevVX) / dt, -70, 70);
  const az = clamp((v.z - condorPrevVZ) / dt, -70, 70);
  condorPrevVX = v.x; condorPrevVZ = v.z;
  condorPivAX = damp(condorPivAX, ax, 14, dt);
  condorPivAZ = damp(condorPivAZ, az, 14, dt);

  const k = g / L, c = 1.5;
  condorPendVX += (-k * condorPendOX - condorPivAX - c * condorPendVX) * dt;
  condorPendVZ += (-k * condorPendOZ - condorPivAZ - c * condorPendVZ) * dt;
  condorPendOX += condorPendVX * dt;
  condorPendOZ += condorPendVZ * dt;
  // the cord cannot stretch: clamp the bob onto the sphere and kill the radial rate
  const lim = L * 0.80;
  const r = Math.sqrt(condorPendOX * condorPendOX + condorPendOZ * condorPendOZ);
  if (r > lim) {
    const s = lim / r;
    condorPendOX *= s; condorPendOZ *= s;
    condorPendVX *= 0.4; condorPendVZ *= 0.4;
  }
  capy.group.rotation.x = -Math.asin(clamp(condorPendOZ / L, -0.82, 0.82));
  capy.group.rotation.z = Math.asin(clamp(condorPendOX / L, -0.82, 0.82));
}

/** The drop: integrate the seeded tumble. No mirroring, no clamp-and-hold. */
function condorTumbleCapy(dt, capy) {
  if (!capy.group) return;
  capy.group.rotation.x += condorTumbleX * dt;
  capy.group.rotation.z += condorTumbleZ * dt;
  condorYawOff += condorTumbleY * dt;
  capy.group.rotation.y += condorYawOff;      // capybara.js rewrites .y every frame
}

/** Touchdown: unwind whatever pose the fall left, over condorSETTLE_T. Assigning
 *  0 in one frame is a visible pop at exactly the moment the camera is watching. */
function condorSettle(dt) {
  if (condorSettleT <= 0) return;
  condorSettleT -= dt;
  const capy = condorGame && condorGame.capy;
  if (!capy || !capy.group) { condorSettleT = 0; return; }
  const lam = 11;
  capy.group.rotation.x = damp(capy.group.rotation.x, 0, lam, dt);
  capy.group.rotation.z = damp(capy.group.rotation.z, 0, lam, dt);
  condorYawOff = damp(condorYawOff, 0, lam, dt);
  capy.group.rotation.y += condorYawOff;
  if (condorSettleT <= 0) {
    capy.group.rotation.x = 0;
    capy.group.rotation.z = 0;
    condorYawOff = 0;
  }
}

// ---------------------------------------------------------------------------
/** Distance from the capybara to the talon, or Infinity if there is no bird. */
function condorTalonDist() {
  const game = condorGame;
  const capy = game && game.capy;
  if (!capy || !capy.body || !condorBody || !condorApi || !condorApi.active) return Infinity;
  condorBody.quaternion.vmult(condorTalonLocal, condorTmpA);
  const dx = capy.body.position.x - (condorBody.position.x + condorTmpA.x);
  const dy = capy.body.position.y - (condorBody.position.y + condorTmpA.y);
  const dz = capy.body.position.z - (condorBody.position.z + condorTmpA.z);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
function condorTalonInReach() {
  if (condorConstraint || condorRegrabT > 0) return false;
  return condorTalonDist() < condorREACH && condorPickupReady();
}

function condorPickupReady() {
  if (!condorBody) return false;
  const q = condorBody.quaternion, p = condorBody.position;
  const up = 1 - 2 * (q.x * q.x + q.z * q.z);
  const nose = 2 * (q.y * q.z - q.w * q.x);
  // A held grab waits for a level, clear pass instead of attaching during
  // the inbound dive. Four metres leaves room below the hanging passenger.
  if (!(up > 0.65 && nose > -0.15 && nose < 0.45 &&
    p.y - condorTerrain(p.x, p.z) > 4)) return false;
  // A level pickup can still fire straight into a facade. Check the first
  // 1.4 seconds of the authored kick without borrowing future climb height.
  const vx = condorBody.velocity.x + 2 * (q.x * q.z + q.w * q.y) * condorLAUNCH_KICK;
  const vz = condorBody.velocity.z + (1 - 2 * (q.x * q.x + q.y * q.y)) * condorLAUNCH_KICK;
  for (let i = 0; i <= 7; i++) {
    const t = i * 0.2;
    if (condorGroundTop(p.x + vx * t, p.z + vz * t) + condorHANG + 0.5 >= p.y) return false;
  }
  return true;
}

function condorTryMount(dt) {
  void dt;
  const game = condorGame;
  const capy = game.capy;
  const input = game.input;
  // REIMAGINE C2: "hold E" must work when the talons arrive later. Re-arm
  // on key-up even out of reach or during the existing release cooldown.
  if (!input || !input.action) condorGrabRelease = false;
  if (!capy || !capy.body || condorConstraint) return;
  if (condorRegrabT > 0) return;                 // see condorRegrabT

  condorBody.quaternion.vmult(condorTalonLocal, condorTmpA);

  condorTalonW.set(condorBody.position.x + condorTmpA.x,
                   condorBody.position.y + condorTmpA.y,
                   condorBody.position.z + condorTmpA.z);
  const dx = capy.body.position.x - condorTalonW.x;
  const dy = capy.body.position.y - condorTalonW.y;
  const dz = capy.body.position.z - condorTalonW.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (d > condorREACH + 1.0) return;

  const grabbed = !!(input && (input.actionPressed || (input.action && !condorGrabRelease))) && d < condorREACH;
  // a leap into the talons counts even without the grab key
  const leapt = !capy.grounded && capy.body.velocity.y > 0.6 && d < condorREACH + 1.0;
  if ((grabbed || leapt) && condorPickupReady()) condorMount();
}

// ---------------------------------------------------------------------------
// THE BIRD CAN BE CAUGHT (T1e). See condorOPEN_LIFT for the measurement.
// ---------------------------------------------------------------------------
/** Everything the watchdog holds goes back to "following the animal". */
function condorOpenReset() {
  condorOpenT = 0; condorOpenOn = false; condorOpens = 0;
  condorOpenSaid = false; condorPins = 0;
  condorGhost(false);
}

/** Contacts off (on = true) while a jammed bird climbs out, and back on. Its
 *  own collide listener still fires; nothing else reads collisionResponse. */
function condorGhost(on) {
  condorGhostT = on ? 4.0 : 0;          // 4 s is a safety expiry, not the rule
  if (condorBody) condorBody.collisionResponse = !on;
}

/** The rule for switching them back: clear of anything a stall could be, and
 *  over whatever tall thing the obstacle table knows about. */
function condorGhostTick(dt) {
  if (condorGhostT <= 0) return;
  condorGhostT -= dt;
  const p = condorBody.position;
  // with no contacts the paving is not a floor either: measured, a ghost that
  // had not yet climbed sank to 1.3 m under the plaza. It keeps a floor.
  const floorY = condorTerrain(p.x, p.z) + condorRADIUS + 0.1;
  if (p.y < floorY) {
    p.y = floorY;
    if (condorBody.velocity.y < 0) condorBody.velocity.y = 0;
    condorBody.previousPosition.copy(p);
    condorBody.interpolatedPosition.copy(p);
  }
  if (condorGhostT <= 0 || (p.y - condorTerrain(p.x, p.z) > condorGHOST_AGL &&
                            p.y > condorGroundTop(p.x, p.z) + condorHANG)) condorGhost(false);
}

/**
 * THE WATCHDOG. Runs while circling. Three seconds in a row of "lowered, at its
 * height, and still not ready" — or of sitting jammed low and slow, which is
 * what a crash into a stall leaves — and it stops circling the animal and
 * circles the nearest open piece of sky instead.
 */
function condorOpenWatch(dt, cy) {
  const game = condorGame;
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = condorBody.position, v = condorBody.velocity;
  const agl = p.y - condorTerrain(p.x, p.z);
  const sp = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  const pinned = agl < condorHANG + condorOPEN_LIFT - 1 && sp < condorPIN_V;
  // "at its height" is the eased orbit arriving, so the 2.5 s descent after the
  // second whistle is not mistaken for a refusal
  const settled = condorLowered && condorRegrabT <= 0 &&
                  Math.abs(condorOrbitY - condorOrbitYTarget) < 1.0;
  if (!(pinned || (settled && !condorPickupReady()))) { condorOpenT = 0; return; }
  condorOpenT += dt;
  if (condorOpenT < condorOPEN_T) return;
  condorOpenT = 0;
  if (pinned) { condorPins++; condorGhost(true); }
  const ax = capy.body.position.x, az = capy.body.position.z;
  // Already over open sky with the animal under it: moving again would only
  // chase it round the plaza. Stay, and let the ghost do the rest.
  if (condorOpenOn && Math.hypot(ax - condorOpenX, az - condorOpenZ) < 4) return;
  if (condorOpenFind(ax, az, cy - condorTerrain(condorOpenOn ? condorOpenX : ax, condorOpenOn ? condorOpenZ : az))) {
    condorOpenOn = true;
    condorOpens++;
    condorBoredT = Math.min(condorBoredT, condorBORED - 12);   // time to walk 20 m
  }
  if (!condorOpenSaid && typeof game.toast === 'function') {
    condorOpenSaid = true;
    const host = condorHost();
    const line = host && host.flier && typeof host.flier.openLine === 'string' ? host.flier.openLine
      : (game.biome && game.biome.current === 'pasto'
        ? 'it will not come down under the flags. somewhere with more sky.'
        : 'it will not come down here. somewhere with more sky.');
    game.toast(line);
  }
}

/**
 * THE NEAREST OPEN SKY. 8 bearings at 8, 14 and 20 m round the animal; a point
 * is open if nothing stands ON it (a ray down finds only the ground) and at
 * least six of eight launch headings from it clear everything the avoidance
 * table knows for 18 m at the talon height. Nearest ring wins, then the most
 * headings. Runs on the watchdog's event only — 24 rays and ~600 table reads.
 */
const condorOPEN_RINGS = [8, 14, 20];
function condorOpenFind(ax, az, hOver) {
  const world = condorGame && condorGame.world;
  if (!(hOver > 0.2)) hOver = 0.35;
  let best = -1, bx = 0, bz = 0;
  for (let ri = 0; ri < condorOPEN_RINGS.length && best < 0; ri++) {
    const r = condorOPEN_RINGS[ri];
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4;
      const x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r;
      if (!condorOverGround(x, z)) continue;
      const th = condorTerrain(x, z);
      if (condorGroundTop(x, z) > th + 0.5) continue;
      if (world && typeof world.raycastClosest === 'function') {
        // stops short of the ground: the collider and terrainHeight disagree by
        // a few centimetres on a lattice, and the ground is not an obstacle
        condorRayFrom.set(x, th + 12, z); condorRayTo.set(x, th + 0.6, z);
        condorRayRes.reset();
        world.raycastClosest(condorRayFrom, condorRayTo, { skipBackfaces: true }, condorRayRes);
        if (condorRayRes.hasHit && condorRayRes.body && condorRayRes.body.mass === 0 &&
            condorRayRes.body !== condorBody) continue;
      }
      const yo = th + hOver + condorORBIT_LOW_Y - condorHANG - 0.5;
      let clear = 0;
      for (let j = 0; j < 8; j++) {
        const b = j * Math.PI / 4, cb = Math.cos(b), sb = Math.sin(b);
        if (condorGroundTop(x + cb * 6, z + sb * 6) < yo &&
            condorGroundTop(x + cb * 12, z + sb * 12) < yo &&
            condorGroundTop(x + cb * 18, z + sb * 18) < yo) clear++;
      }
      if (clear >= 6 && clear > best) { best = clear; bx = x; bz = z; }
    }
  }
  if (best < 0) return false;
  condorOpenX = bx; condorOpenZ = bz;
  return true;
}

/**
 * THE SUMMON SHOT. Once per visit, the first frame the inbound bird is inside
 * condorSHOT_R of the animal: the lens goes round behind the animal, away from
 * where the bird will be condorSHOT_LEAD from now, and looks up. Not a
 * cutscene — frameShot yields to the mouse, Z/X and the stick.
 */
function condorShotCheck() {
  const game = condorGame;
  const capy = game.capy;
  if (!capy || !capy.body) return;
  const p = condorBody.position, a = capy.body.position;
  const dx = p.x - a.x, dy = p.y - a.y, dz = p.z - a.z;
  if (dx * dx + dy * dy + dz * dz > condorSHOT_R * condorSHOT_R) return;
  condorShotArmed = false;
  condorShotVisit = true;
  if ((game.state && game.state.noSummonShot) || typeof game.frameShot !== 'function') return;
  // lead round the ORBIT, not along the tangent: a straight line 1.4 s long on
  // a 15 m circle at 20 m/s points 40 degrees short of where the bird will be
  const v = condorBody.velocity;
  const r2 = dx * dx + dz * dz;
  const w = r2 > 1 ? clamp((dx * v.z - dz * v.x) / r2, -2.5, 2.5) : 0;
  // w is per SOLVER second and the hold is on the wall clock; from rung 2 the
  // solver runs slower than the wall (see condorCountStep), so the lead is too
  const ang = Math.atan2(dz, dx) + w * condorSHOT_LEAD * condorAiRatio;
  const lx = Math.cos(ang), lz = Math.sin(ang);
  // Measured first as the review proposed it (dist 11, pitch -22 deg, raise 1.5):
  // the camera sank to its floor looking level at the animal and the bird was in
  // 0 of 7 sampled frames. The bird is 12-25 m UP and circling, so the lens goes
  // further back, only a little above the animal, and looks up at a point 5 m
  // over it: the animal sits in the bottom third of a 48-degree frame and the
  // far half of the circle is sky. The lead puts the middle of the hold, not its
  // start, on the far side.
  game.frameShot({ yaw: Math.atan2(lx, lz) + Math.PI, dist: 15, pitch: 0.08,
                   raise: 5.0, hold: 2.6 });
  condorShots++;
}

// ---------------------------------------------------------------------------
function condorFlightFeedback(dt, airspeed, speed) {
  const game = condorGame;
  // wind, scaled by airspeed
  condorWindT -= dt;
  if (condorWindT <= 0 && airspeed > 11) {
    condorWindT = 1.35;
    if (typeof game.sfx === 'function') {
      game.sfx('hiss', { volume: clamp((airspeed - 10) / 17, 0, 1) * 0.75, pitch: clamp(0.7 + airspeed / 42, 0.5, 1.6) });
    }
  }
  // hard landing
  if (condorLandSpeed > 0) {
    const v = condorLandSpeed;
    condorLandSpeed = 0;
    if (v > 7) {
      if (typeof game.shake === 'function') game.shake(clamp(v / 26, 0, 1) * 0.75);
      if (typeof game.sfx === 'function') game.sfx('thud', { volume: clamp(v / 20, 0.4, 1) });
    }
  }
  // WEDGED. The terrain test below only knows about terrain; the plaza is full of
  // market stalls, a church and a bell tower, and a bird that flies into one is
  // held there by the contact solver with no airspeed, no lift and no way out —
  // measured, 45 seconds hanging motionless off a stall roof at 0.1 m/s, still
  // "carrying". An aircraft that is not moving is not flying, so it lets go.
  // WEDGED MEANS NOT MOVING IN THE WORLD — not "no ground speed". This keyed on
  // ground speed alone, and inside a thermal the AIRMASS is moving: a bird
  // circling a column can be flying perfectly well at walking pace over the
  // ground and was dropped for it. MEASURED, that is what actually let go of the
  // capybara at t = 3.17 s in the Galeras test, with the wing still making lift.
  // Something jammed against scenery is stationary in EVERY axis and has no
  // airspeed either; a thermalling bird is going up at 3 m/s with 6 m/s of wind
  // over the wing. All three have to be true before it lets go.
  const wv = condorBody.velocity;
  const wHoriz = Math.sqrt(wv.x * wv.x + wv.z * wv.z);
  if (condorLaunchLift <= 0 && wHoriz < 2.2 && Math.abs(wv.y) < 1.2 && airspeed < condorSTALL) {
    condorStuckT += dt;
    if (condorStuckT > 1.1) {
      condorStuckT = 0;
      if (typeof game.shake === 'function') game.shake(0.35);
      condorRelease(false);
      condorLowered = true;
      condorOrbitYTarget = condorORBIT_LOW_Y;
      condorOrbitRTarget = condorORBIT_LOW_R;
      return;
    }
  } else {
    condorStuckT = 0;
  }

  // Scraped the ground with a passenger: the condor lets go and climbs away.
  // Suppressed through the launch window — the pickup happens 3.6 m off the deck
  // and the beat out of it is allowed to dip before it climbs.
  // MEASURED AT THE PASSENGER, NOT AT THE BIRD. The capybara hangs condorHANG +
  // 0.98 = 2.43 m below the condor's centre of mass, so `condorBody.position.y <
  // terr + 1.5` reported 1.5 m of clearance while the passenger was already
  // 0.9 m INSIDE the hillside. Entering the Galeras crater below the rim that
  // annihilated ~600 kg m/s of the pair's momentum in a single frame against an
  // applied impulse of (5, 6) — a collision, which nothing in this file's
  // aerodynamics can produce — and the wedge check then dropped the capybara in
  // the bottom of the crater. The avoidance loop up in the flight branch is what
  // stops this happening at all; this is the last resort behind it.
  let scrapeX = condorBody.position.x, scrapeZ = condorBody.position.z;
  let scrapeY = condorBody.position.y - 1.5;
  const pass = game.capy;
  if (condorState === 'carrying' && pass && pass.body) {
    scrapeX = pass.body.position.x; scrapeZ = pass.body.position.z;
    scrapeY = pass.body.position.y - 0.5;
  }
  const terr = condorTerrain(scrapeX, scrapeZ);
  // ...AND NEVER OUTSIDE THE WORLD. condorTerrain is the ANALYTIC height law,
  // which answers for the whole plane; the rigid heightfields stop at
  // pasto.bounds(). So out past the edge this test reads a hillside that has no
  // collision behind it, decides the pair has scraped it, and drops the
  // capybara into a place with no floor — which is the "flying up the volcano
  // drops you outside the map" bug, and it is a release rather than a fall.
  // condorFence now makes this unreachable; the guard stays because a check
  // that would be catastrophic if it ever fired should not depend on another
  // function being correct.
  if (condorLaunchLift <= 0 && scrapeY < terr && condorOverGround(scrapeX, scrapeZ)) {
    if (typeof game.shake === 'function') game.shake(clamp(speed / 24, 0, 1) * 0.5);
    condorRelease(false);
    condorLowered = true;
    condorOrbitYTarget = condorORBIT_LOW_Y;
    condorOrbitRTarget = condorORBIT_LOW_R;
  }
}

// ---------------------------------------------------------------------------
/** The lowest point of the crater rim ring, measured off the terrain once. */
function condorCraterRimY() {
  if (condorRimY > 0) return condorRimY;
  const host = condorHost();
  const c = host && host.craterCentre;
  if (!c) return 0;
  let lo = Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const h = condorTerrain(c.x + Math.cos(a) * condorCRATER_R, c.z + Math.sin(a) * condorCRATER_R);
    if (h < lo) lo = h;
  }
  if (isFinite(lo) && lo > 0) condorRimY = lo;
  return condorRimY;
}

function condorCheckPeak() {
  // LATCHED. This had no latch at all: MEASURED, 180+ completions in a single
  // 10 s run, one per frame, every one of them re-emitting the event.
  const game = condorGame;
  const host = condorHost();
  const capy = game.capy;
  if (!host || !capy || !capy.body) return;
  // ---- how high the bird got you, which is the whole point of a thermal ----
  // Kept whether or not the rim task is still open, and measured only while the
  // capybara is actually HANGING OFF THE TALONS: the number has to mean "the
  // air carried me here", so a hop off a clifftop or a walk up the moraine road
  // must not enter into it. Height above the ground under the animal, not above
  // sea level, or the record would simply be a map of where the mountain is.
  //
  // AND IT IS MEASURED FOR ANY HOST, WHICH IS WHY THIS FUNCTION NO LONGER
  // RETURNS EARLY ON A MISSING CRATER. It used to bail on `!pasto.craterCentre`
  // before it got here, so the moment a second chapter hosted a flier the
  // height record would simply never have filed — a chapter-neutral number lost
  // to a guard belonging to one chapter's joke. The rim task below keeps the
  // guard, because the rim task IS the joke.
  // ---- AND IT IS FILED WHEN THE FLIGHT ENDS, NOT WHILE IT IS CLIMBING -----
  // `game.record` TOASTS whenever the new value beats the saved one, so filing
  // on every improvement means filing on every few centimetres of climb. Seen
  // in the frame of Rio's first flight: FOUR stacked 'personal best · carried
  // up to 9 m' cards over the beach, all reading the same rounded number,
  // because the metre they share was crossed five times on the way up.
  //
  // It needs a climbing flight to show, which is why one chapter of thermals
  // never surfaced it and two did. `recordLive` — built for exactly this, a
  // number that moves while you are earning it — carries the running figure on
  // the paper, and the record itself is filed once, by condorRelease, when
  // there is a final answer to file.
  if (condorState === 'carrying' && capy.body.position.y === capy.body.position.y) {
    const g = condorTerrain(capy.body.position.x, capy.body.position.z);
    const agl = capy.body.position.y - g;
    if (agl > condorBestAGL) {
      condorBestAGL = agl;
      if (typeof game.recordLive === 'function') game.recordLive('thermal-peak', agl);
    }
  }
  if (condorPeakDone) return;
  if (!host.craterCentre) return;

  const c = host.craterCentre;
  const dx = capy.body.position.x - c.x, dz = capy.body.position.z - c.z;
  if (dx * dx + dz * dz > 225) return;               // 15 m
  // ABOVE THE RIM — and craterCentre.y is the crater FLOOR, not the rim. The old
  // test was `y < c.y - 1`, i.e. 44.6 m, against a floor at 45.6: merely BEING in
  // the crater completed the chapter's soaring task, no climbing required. The
  // rim is measured off the terrain instead.
  if (capy.body.position.y < condorCraterRimY() + condorPEAK_MARGIN) return;
  condorPeakDone = true;
  const peakId = condorTaskId('peak');
  if (peakId && typeof game.completeTask === 'function') game.completeTask(peakId);
}

/** Metres between the hanging PASSENGER and the terrain — now, and along the
 *  ground track over the next condorGND_LOOK seconds. Worst of three samples.
 *  This is the number the flight branch flies to; see condorGND_CLEAR. */
function condorClearance(vel) {
  const drop = condorHANG + 0.98;             // talon offset + hang length
  const px = condorBody.position.x, py = condorBody.position.y, pz = condorBody.position.z;
  let worst = 1e9;
  // Only the DESCENT is projected, and only for condorGND_SINK_T — see the note
  // on that constant. Projecting a climb would invent clearance the bird has not
  // got yet; projecting a full 1.4 s of sink invented an emergency over flat
  // ground and pumped the phugoid with the avoidance wingbeat.
  const vy = vel.y < 0 ? vel.y : 0;
  for (let i = 0; i <= 2; i++) {
    const t = (i * condorGND_LOOK) / 2;
    const tv = t < condorGND_SINK_T ? t : condorGND_SINK_T;
    const c = (py + vy * tv - drop) - condorGroundTop(px + vel.x * t, pz + vel.z * t);
    if (c < worst) worst = c;
  }
  return worst;
}

// ---------------------------------------------------------------------------
// THE HOST — and it is the sixth time this codebase has replaced a list of
// biome names with the question the list was standing in for.
//
// This module's own header has always said it is biome-neutral, and the FLIGHT
// LAW is: lift, induced drag, the G-limited elevator and the weathervane yaw do
// not know where they are. The PLUMBING was not. Every terrain sample, every
// fence test, the updraft and both of the early-outs went to `game.pasto` by
// name, so the best-simulated thing in the game could only ever happen in one
// chapter of nineteen — which is exactly the shape the dive was in before v19,
// the climb before v31, and slip, wind and localWater before them.
//
// So a chapter hosts a flier by publishing ONE thing: `thermals`. That is the
// right flag rather than a bare boolean because it is also the only part of the
// contract a chapter cannot fake — bounds and terrain nearly everybody already
// has, and a chapter with no rising air has nowhere for a soaring bird to go.
// Everything else is optional and degrades:
//
//   thermals       REQUIRED. The columns. No thermals, no host, no bird.
//   terrainHeight  ground under the bird. Missing -> sea level, and it flies.
//   bounds()       the fence. Missing -> condorFENCE_FALLBACK, as before.
//   condorShot()   the chapter frames its own launch. Missing -> the rig's own.
//   craterCentre() Pasto's joke, and Pasto's alone. Missing -> no rim task.
//   flier          appearance and voice. Missing -> the Andean condor.
//
// Pasto is untouched by all of this: it published `thermals` before this comment
// existed, so it answers the new question exactly as it answered the old one.
function condorHost() {
  const game = condorGame;
  if (!game || !game.biome) return null;
  const api = game[game.biome.current];
  if (!api) return null;
  const t = api.thermals;
  // An array OR a getter, because pasto publishes the live array and a chapter
  // whose columns move with the sun will want to compute them.
  if (typeof t === 'function' || (t && t.length !== undefined)) return api;
  return null;
}

/**
 * WHICH LINE ON THE PAPER THIS HOST'S BIRD TICKS.
 *
 * Pasto's three ids were written into this file as string literals, which is
 * fine while one chapter has a bird and wrong the moment two do. A host names
 * its own through `flier.tasks`; anything it does not name falls back to
 * Pasto's, so Pasto — which names nothing — is unchanged.
 *
 * `peak` is deliberately allowed to be absent rather than defaulted per host:
 * "ride a thermal to the crater rim" is a question about a crater, and a host
 * without one should tick nothing rather than tick Pasto's line from Rio.
 */
const condorTASK_FALLBACK = { summon: 'whistle-condor', ride: 'condor-ride', peak: 'thermal-peak' };
function condorTaskId(which) {
  const host = condorHost();
  const t = host && host.flier && host.flier.tasks;
  const id = t && t[which];
  if (typeof id === 'string' && id) return id;
  if (which === 'peak' && t) return null;      // a host with tasks but no peak has no peak
  return condorTASK_FALLBACK[which];
}

/** The live host's thermal columns, or null. */
function condorHostThermals(host) {
  if (!host) return null;
  const t = host.thermals;
  if (typeof t === 'function') { try { return t(); } catch (e) { return null; } }
  return t;
}

/**
 * WHERE THERE IS GROUND TO LAND ON. The host's bounds(), inset by
 * condorFENCE_PAD so the bird turns round before the passenger's shadow leaves
 * the world rather than after. Falls back to the old symmetric square if the
 * chapter has not published one, so this file still works against a host that
 * predates it.
 */
function condorBounds() {
  const host = condorHost();
  if (host && typeof host.bounds === 'function') {
    const b = host.bounds();
    if (b && isFinite(b.x0 + b.x1 + b.z0 + b.z1)) return b;
  }
  return condorFENCE_FALLBACK;
}

/**
 * THE FENCE. Kill the outward component of velocity outside the world, and
 * carry the body back in if a frame has already put it there.
 *
 * Not a force and not a bounce: a force can be out-flown (the soft edge above
 * is one, and it can) and a bounce is a thing the player can feel and will
 * therefore go looking for. Zeroing the outward component leaves the tangential
 * speed untouched, so at the boundary the bird simply runs along it — which
 * from the saddle reads as a bird that has decided not to go that way.
 */
function condorFence(dt) {
  void dt;
  const b = condorBounds();
  const p = condorBody.position, v = condorBody.velocity;
  const x0 = b.x0 + condorFENCE_PAD, x1 = b.x1 - condorFENCE_PAD;
  const z0 = b.z0 + condorFENCE_PAD, z1 = b.z1 - condorFENCE_PAD;
  let hit = false;
  if (p.x < x0) { if (v.x < 0) v.x = 0; p.x = x0; hit = true; }
  else if (p.x > x1) { if (v.x > 0) v.x = 0; p.x = x1; hit = true; }
  if (p.z < z0) { if (v.z < 0) v.z = 0; p.z = z0; hit = true; }
  else if (p.z > z1) { if (v.z > 0) v.z = 0; p.z = z1; hit = true; }
  // A position write is a teleport and the interpolation history goes with it,
  // or the render lerps the bird across the map for a frame. Contract,
  // "Rendering physics transforms".
  if (hit) {
    condorBody.previousPosition.copy(p);
    condorBody.interpolatedPosition.copy(p);
  }
}

/** Is (x, z) somewhere the game actually has a floor? See condorFence. */
function condorOverGround(x, z) {
  const b = condorBounds();
  return x > b.x0 + 1 && x < b.x1 - 1 && z > b.z0 + 1 && z < b.z1 - 1;
}

function condorTerrain(x, z) {
  const host = condorHost();
  if (host && typeof host.terrainHeight === 'function') {
    const h = host.terrainHeight(x, z);
    return (typeof h === 'number' && isFinite(h)) ? h : 0;
  }
  return 0;
}

/** Reduce the static scenery to discs-with-a-height. See condorObs. Runs on a
 *  summon, never in the flight path. */
function condorScanObstacles() {
  condorObsN = 0;
  const world = condorGame && condorGame.world;
  if (!world || !world.bodies) return;
  const bodies = world.bodies;
  for (let i = 0; i < bodies.length; i++) {
    const b = bodies[i];
    if (!b || b.mass > 0 || b === condorBody || !b.shapes) continue;
    for (let k = 0; k < b.shapes.length; k++) {
      if (condorObsN >= condorOBS_MAX) return;
      const s = b.shapes[k];
      if (!s || typeof s.calculateWorldAABB !== 'function') continue;
      b.quaternion.vmult(b.shapeOffsets[k], condorObsOff);
      condorObsOff.vadd(b.position, condorObsOff);
      b.quaternion.mult(b.shapeOrientations[k], condorObsQ);
      try { s.calculateWorldAABB(condorObsOff, condorObsQ, condorObsLo, condorObsHi); }
      catch (e) { continue; }
      const top = condorObsHi.y;
      if (!(top > condorOBS_MIN_H)) continue;               // also rejects NaN
      const rx = (condorObsHi.x - condorObsLo.x) * 0.5;
      const rz = (condorObsHi.z - condorObsLo.z) * 0.5;
      // an infinite plane and the volcano's heightfield land here; both are
      // terrain, both are already answered by pasto.terrainHeight
      if (!(rx < condorOBS_SPAN || rz < condorOBS_SPAN)) continue;
      const o = condorObsN * condorOBS_STRIDE;
      condorObs[o] = (condorObsLo.x + condorObsHi.x) * 0.5;
      condorObs[o + 1] = (condorObsLo.z + condorObsHi.z) * 0.5;
      condorObs[o + 2] = rx + condorOBS_PAD;
      condorObs[o + 3] = rz + condorOBS_PAD;
      condorObs[o + 4] = top;
      condorObsN++;
    }
  }
}

/** The height of whatever the bird would hit at (x, z) — terrain OR townscape.
 *  This is what the AVOIDANCE loop flies to. The release and landing tests keep
 *  using condorTerrain: being 3 m over the church roof at 40 m of altitude is
 *  not a scrape, and dropping the passenger for it would be absurd. */
function condorGroundTop(x, z) {
  let h = condorTerrain(x, z);
  for (let i = 0; i < condorObsN; i++) {
    const o = i * condorOBS_STRIDE;
    const t = condorObs[o + 4] - condorOBS_SLACK;
    if (t <= h) continue;
    const dx = x - condorObs[o];
    if (dx < 0 ? -dx > condorObs[o + 2] : dx > condorObs[o + 2]) continue;
    const dz = z - condorObs[o + 1];
    if (dz < 0 ? -dz > condorObs[o + 3] : dz > condorObs[o + 3]) continue;
    h = t;
  }
  return h;
}

// =============================================================================
// ANIMATION — purely procedural, read straight off the physics state
// =============================================================================
function condorAnimate(dt, airspeed, bank, pitch, mounted) {
  const flapping = condorFlapT > 0;
  const fast = clamp((airspeed - 12) / 14, 0, 1);          // 0 = lazy, 1 = full dive
  const slow = clamp(1 - airspeed / 11, 0, 1);
  const loadSag = mounted ? 0.16 : 0;

  let dihedral, sweep, elbowFold, splay;
  if (flapping) {
    // big, slow, laboured beats
    const beat = Math.sin(condorFlapPhase);
    dihedral = 0.30 + beat * 0.72;
    sweep = 0.10 + clamp(-beat, 0, 1) * 0.22;
    elbowFold = -0.10 + beat * 0.34;
    splay = 0.30 + clamp(beat, 0, 1) * 0.22;
  } else {
    // gliding: held high and flat. diving: curled down and swept back.
    dihedral = lerp(0.20, -0.20, fast) + slow * 0.16 - loadSag;
    sweep = lerp(0.04, 0.52, fast);
    elbowFold = lerp(0.02, -0.30, fast);
    splay = lerp(0.34, 0.06, fast);
    // ...and the AI's climb beat on top, in the SAME phase the sustentation
    // force pulses on (sin(phase * 2), see the seek loop), so what the bird
    // is drawn doing and what is holding it up are one thing.
    if (!mounted && condorAiBeat > 0.02) {
      const b = Math.sin(condorFlapPhase * 2) * condorAiBeat;
      dihedral += b * 0.42;
      elbowFold += b * 0.18;
      splay += clamp(b, 0, 1) * 0.10;
    }
  }
  // pulling up fans everything out as an airbrake
  const brake = clamp(pitch * 1.6, 0, 1);
  splay += brake * 0.30;
  dihedral += brake * 0.18;

  for (let i = 0; i < condorWings.length; i++) {
    const w = condorWings[i];
    // roll the outboard panel with the bank so the wings look like they are
    // holding the turn rather than being dragged through it
    const rollBias = bank * (w.sign > 0 ? -0.16 : 0.16);
    w.shoulder.rotation.z = damp(w.shoulder.rotation.z, dihedral + rollBias, 14, dt);
    w.shoulder.rotation.y = damp(w.shoulder.rotation.y, w.sign * sweep, 12, dt);
    w.elbow.rotation.z = damp(w.elbow.rotation.z, elbowFold, 12, dt);
    w.elbow.rotation.y = damp(w.elbow.rotation.y, w.sign * sweep * 0.6, 12, dt);
    // the hand is one baked mesh now: splay is a cock of the whole fan
    w.fan.rotation.y = damp(w.fan.rotation.y, w.sign * (splay - 0.20) * 0.55, 12, dt);
    // ...AND THE FINGERS TRAIL THE BEAT (ROADMAP-WOW Part C). A hand on a
    // wing that is being driven through the air bends the other way: down on
    // the upstroke, up on the downstroke, and it comes back to flat when the
    // wing does. `lagD` is the dihedral a few frames late, and the difference
    // is the flex — zero in a glide, about a third of a radian at the bottom
    // of a laboured beat. It costs one damp per wing and reads at the play
    // distance as the one thing on the bird that is not the whole bird.
    w.lagD = damp(w.lagD, dihedral, 5.5, dt);
    const flex = clamp((w.lagD - dihedral) * 0.85, -0.42, 0.42);
    w.fan.rotation.z = damp(w.fan.rotation.z, splay * 0.34 + flex, 12, dt);
  }

  // tail: closed in a glide, fanned wide as an airbrake. One baked mesh, so the
  // spread is a lateral scale — wider and a touch shorter, exactly as it reads.
  const fan = clamp(0.06 + brake * 0.9 + (flapping ? 0.3 : 0), 0, 1);
  condorTailFan.scale.x = damp(condorTailFan.scale.x, 0.62 + fan * 0.75, 10, dt);
  condorTailFan.scale.z = damp(condorTailFan.scale.z, 1.06 - fan * 0.20, 10, dt);
  condorTailPivot.rotation.x = damp(condorTailPivot.rotation.x, -brake * 0.55 + fast * 0.12, 9, dt);

  // head always tracks the direction of travel
  const vel = condorBody.velocity;
  const sp = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
  if (sp > 0.6) {
    condorBody.quaternion.conjugate(condorQInv);
    condorHeadDir.set(vel.x / sp, vel.y / sp, vel.z / sp);
    condorQInv.vmult(condorHeadDir, condorTmpB);
    const yaw = Math.atan2(condorTmpB.x, condorTmpB.z);
    const pit = -Math.asin(clamp(condorTmpB.y, -1, 1));
    condorHeadPivot.rotation.y = damp(condorHeadPivot.rotation.y, clamp(yaw, -0.7, 0.7), 8, dt);
    condorHeadPivot.rotation.x = damp(condorHeadPivot.rotation.x, clamp(pit, -0.6, 0.6), 8, dt);
  }
}

// ---------------------------------------------------------------------------
/**
 * Render from the INTERPOLATED transform — never body.position — and then
 * predict-and-correct on top of it, for the reason set out at length in
 * capybara.js: cannon's interpolation alpha is not monotonic when frame times
 * wobble, so the rendered transform sawtooths by up to a whole physics step.
 * A step at 20 m/s is 33 cm, and the camera sits 24 m behind it amplifying
 * every wobble into a shake of the whole sky.
 * MEASURED in flight, second difference of the rendered transform in mm/frame^2:
 * steady 60 Hz reads 2.68 for the bird and 4.51 for the camera; the same run
 * with +/-30% of jitter on dt reads 38.3 and 48.1.
 * The prediction uses the velocity the solver just produced, so at constant
 * velocity it is exact and costs nothing; the correction only ever sees the
 * sawtooth. Same for the attitude: the angular velocity integrates the
 * quaternion forward and the slerp mops up.
 */
function condorRender(dt) {
  const p = condorBody.interpolatedPosition;
  const q = condorBody.interpolatedQuaternion;
  if (!condorRenderInit) {
    condorRenderInit = true;
    condorRenderPos.set(p.x, p.y, p.z);
    condorRenderQ.set(q.x, q.y, q.z, q.w);
  }
  const v = condorBody.velocity;
  condorRenderPos.x += v.x * dt;
  condorRenderPos.y += v.y * dt;
  condorRenderPos.z += v.z * dt;
  const k = 1 - Math.exp(-condorRENDER_L * dt);
  condorRenderPos.x += (p.x - condorRenderPos.x) * k;
  condorRenderPos.y += (p.y - condorRenderPos.y) * k;
  condorRenderPos.z += (p.z - condorRenderPos.z) * k;
  const ex = condorRenderPos.x - p.x, ey = condorRenderPos.y - p.y, ez = condorRenderPos.z - p.z;
  // a summon, a park or a QA teleport is not a prediction error
  if (ex * ex + ey * ey + ez * ez > condorRENDER_SNAP2) condorRenderPos.set(p.x, p.y, p.z);
  condorGroup.position.copy(condorRenderPos);

  condorRenderTmpQ.set(q.x, q.y, q.z, q.w);
  // slerp is the correct filter for an orientation; a per-component lerp of a
  // quaternion shortens it and shears the model at high rates.
  if (condorRenderQ.dot(condorRenderTmpQ) < 0) {
    condorRenderTmpQ.set(-q.x, -q.y, -q.z, -q.w);   // shortest arc
  }
  condorRenderQ.slerp(condorRenderTmpQ, k);
  condorGroup.quaternion.copy(condorRenderQ);
  // the roll (L1): once round the nose, eased, drawn on top of the flight
  if (condorRollT > 0) {
    const u = 1 - clamp(condorRollT / condorROLL_T, 0, 1);
    const a = (u * u * (3 - 2 * u)) * Math.PI * 2;
    condorRollQ.setFromAxisAngle(condorRollAxis, a);
    condorGroup.quaternion.multiply(condorRollQ);
  }
}
