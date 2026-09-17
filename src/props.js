import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { PALETTE, mat, matOwn, TASKS, rand, randInt, clamp, damp, lerp, grain, waterYAt } from './shared.js';

// ===========================================================================
// AGENT C — world physics + interactive props.
// Every prop is authored as a little group of flat-shaded boxes/cylinders,
// then baked ONCE per type into a single vertex-coloured BufferGeometry so a
// whole prop costs exactly one draw call. Colours still come from PALETTE —
// they are just carried on the vertices instead of on the material.
// ===========================================================================

// The baked PALETTE colours ride on the vertices, so the shared prop material
// must be an exact 1.0 multiplier. Built from unit RGB rather than a hex
// literal so no colour constant is hardcoded outside shared.js.
const physNEUTRAL = new THREE.Color(1, 1, 1).getHex();

const physIMPACT_MIN = 2.5;      // m/s before a bonk is worth reporting
const physSPILL_MIN = 3.0;       // m/s before a hot drink gives up
// --- THE BARGE. See the second branch of physOnCollide ----------------------
// physBARGE_MIN sits above the closing speed a walk can produce, so a
// considered approach still only pushes and only a RUN barges. physBARGE_DV is
// the ceiling on the VELOCITY granted (the impulse is multiplied by the prop's
// own mass), so nothing on the street is ever launched, however heavy or light.
const physBARGE_MIN = 3.2;       // m/s along the normal before it is a barge
const physBARGE_K   = 0.42;      // m/s of prop, per m/s of closing speed over the floor
const physBARGE_DV  = 1.9;       // m/s — the hard ceiling on what a barge grants
const physBARGE_UP  = 0.34;      // of that, upward, so a tall prop goes over
const physTIP_COS = 0.5;         // cos(60°) — bin considered toppled
const physHOLD_LAMBDA = 26;      // mouth snap ~0.12s
// 30 was the whole game's dust: a landing wanted six of it, a run scuffed one
// per stride, a dig took a handful and Pasto's ash column shares the same
// pool. A sprint into a hard landing therefore arrived with a pool that was
// already three quarters spent, and the landing — the one moment that is
// SUPPOSED to look like an impact — got whatever was left over.
const physDUST_MAX = 60;
const physFOAM_MAX = 8;
const physRUBBISH_MAX = 18;
const physWATER_FALLBACK = -0.5;
// ---- buoyancy (Archimedes, forces only — never a scripted bob) -------------
const physFLOAT_DEFAULT = 0.55;  // submerged fraction a prop is designed to settle at
const physBUOY_CLAMP = 3.0;      // hard cap on lift, in multiples of the prop's own weight
const physBUOY_DRAG_L = 6.0;     // linear drag, N per (m/s) per kg of submerged mass
const physBUOY_DRAG_A = 3.4;     // angular drag, 1/s (scaled by the body's inertia)
const physBUOY_RIGHT = 6.0;      // self-righting, rad/s² per unit sin(tilt)
const physBUOY_SWELL = 0.09;     // harbour swell, as a fraction of weight
const physBUOY_DRIFT = 0.30;     // lazy surface current, N per kg
const physBUOY_SPIN = 1.2;       // lazy yaw, rad/s²
const physBUOY_PROUD = 0.045;    // m of a floating prop that must stay above the (opaque) surface
const physBUOY_SPAN_MIN = 0.06;  // m — floor on the depth ramp, NOT a waterline dial

// ---- aerodynamics (quadratic drag; the air is a fluid like the water is) ----
const physAERO_RHO  = 1.2;       // kg/m³, air
const physAERO_AMAX = 40;        // m/s² ceiling on drag acceleration (integration guard)
const physAERO_CD_BOX = 1.05;    // bluff body
const physAERO_CD_SPH = 0.47;    // sphere
// ---- ...AND THE GUST IS PART OF THAT AIR (see physWindNow) -----------------
// weather.js's gust is centred on a per-chapter BASE that never stops blowing,
// so it cannot be fed to the props raw: a 1.5 m/s permanent breeze in Sydney
// would walk a ferry ticket off the quay while nobody was touching a key, and
// "a prop stays exactly where the player put it" is worth more than any of
// this. The floor is subtracted first and only the EXCESS is scaled, so:
//   - the nine calmest chapters produce exactly 0.000 and are untouched;
//   - five mid chapters top out at 0.4-2.6 m/s at the peak of the swing, which
//     stirs paper and nothing else;
//   - the four squall chapters (Reykjavik 4.6, Manly 4.8, Marrakech 6.5,
//     Antarctica 5.8 at peak) push past the 4 m/s test that has always guarded
//     the wake-a-sleeping-prop branch below, which is what that branch was
//     written for and has never once been able to do.
const physGUST_MIN = 2.8;        // m/s of gust that buys nothing at all
const physGUST_K = 1.2;          // ...and how hard the excess above it bites
// THE WAKE TEST, in m/s of EFFECTIVE wind (compared squared, below). A sleeping
// body is skipped by the solver entirely, so this gate — not the drag — decides
// whether the air exists at all for a prop at rest. It was 4.0, which the
// effective wind NEVER REACHES: measured over a 20 s sample in Manly, the
// windiest row in `wxMOOD`, the top of the range was 3.7 m/s and a settled prop
// was asleep for all 1200 frames. At 2.0 a squall wakes light props and the drag
// below is applied to them.
const physGUST_WAKE = 2.0;
//
// AND WHAT THIS DELIBERATELY DOES NOT DO: BLOW A PROP ACROSS A SQUARE.
// That was the intent and it is not reachable with drag alone, because a prop's
// terminal velocity under drag IS the wind speed. Swept in Manly at held raw
// gusts of 2/4/6/8/10/14 m/s, with ground-to-prop friction at 0.35, every light
// prop shows a stiction CLIFF and no band between the two sides of it:
//
//   sunglasses (0.10 kg)   raw 6 -> 0.002 m over 5 s   |   raw 8 -> 9.86 m
//   thong      (0.12 kg)   raw 6 -> 0.000 m            |   raw 8 -> 4.55 m
//
// Under the cliff nothing stirs; over it the prop accelerates toward the wind
// and sails four to ten metres in five seconds, which is not charm — it is
// props migrating away from where the player set them down, and tasks read
// prop positions. So `physGUST_K` stays at the value that keeps the effective
// wind (4.8 m/s at Manly's absolute peak) FAR under the cliff, and what the
// gust buys is what a prop already in motion or in the air feels: a thrown
// frisbee drifting downwind, not a hat leaving the beach.
//
// Doing it properly needs a second mechanism this does not have: a turbulent
// KICK to break stiction, and a cap on the speed it may leave with, so the
// prop skitters and stops instead of reaching wind speed. That is a design
// task, not a tuning one.
//
// ---- AND HERE IT IS (v23) --------------------------------------------------
// Both halves, because either one on its own is a different bug.
//
//   THE KICK is a PUFF and not a force: an impulse, a few times a second, at a
//   scattered heading, with a small vertical component so the thing skips
//   rather than slides. It breaks stiction because it arrives all at once —
//   which is exactly what the sweep above says continuous drag cannot do — and
//   between puffs ordinary friction stops the prop dead. The result is a
//   skitter: a few centimetres, a pause, a few more.
//
//   THE CAP is what stops the kick becoming the cliff. Drag may slow anything
//   down at any speed; it may not speed anything UP past physGUST_VMAX along
//   the wind. So a prop cannot reach wind speed and sail, and a thrown frisbee
//   is untouched because drag against its own velocity is still drag.
//
// And three things the kick refuses outright, which together are why this is
// safe to switch on in seventeen chapters:
//   - anything heavier than physGUST_LIGHT, the same 0.6 kg the wake test uses;
//   - anything held, owned, planted or frozen;
//   - anything that is a SOUVENIR (`keep`), because seventeen of those are the
//     spine of the journey and none of them may blow into the sea;
//   - and anything already more than physGUST_ROAM from its own home, which is
//     the promise that a square full of props is still a square full of props
//     twenty minutes later.
const physGUST_LIGHT   = 0.6;   // kg — a hat, a thong, a pair of sunglasses
const physGUST_KICK_W  = 2.0;   // m/s of EFFECTIVE wind before anything skitters. MEASURED.
const physGUST_KICK_V  = 4.5;   // m/s the strongest puff may leave it with. MEASURED.
const physGUST_KICK_UP = 1.5;   // m/s of hop. Without it a puff does nothing at all.
const physGUST_KICK_T  = 0.55;  // s mean gap between puffs, jittered per prop
const physGUST_KICK_SP = 1.1;   // rad of scatter on a puff's heading. Turbulence.
const physGUST_VMAX    = 2.2;   // m/s downwind the air may never accelerate past
const physGUST_REST    = 0.6;   // m/s under which a prop counts as settled enough to catch
const physGUST_ROAM    = 8;     // m from home the wind may ever carry a prop
// ---- a current is a drag, not a velocity write ----------------------------
// Toward the water rather than toward zero, so it composes with physBUOY_DRAG_L
// and the righting torque instead of fighting them. A floating prop therefore
// settles at k/(k + physBUOY_DRAG_L) = 0.60 of the current and LAGS the river,
// which is what a thing being carried looks like.
const physFLOW_DRAG = 9.0;       // N per (m/s) per kg of submerged mass
const physSEABED = 2.3;          // metres of harbour under the surface
const physGRP_STATIC = 1;        // ground / walls / capy / npcs (cannon default)
const physGRP_DYN = 2;           // props + rubbish
const physHELD_VMAX = 18;        // clamp on carried-body swing velocity

// ---- task causation -------------------------------------------------------
// Nothing on the checklist may tick itself. A task only counts if the capybara
// is demonstrably responsible: it is holding the prop, it touched the prop, or
// it threw the prop, within the relevant window.
const physTASK_GRACE = 2.0;      // s — the opening settle earns the player nothing
const physCAUSE_TIP = 1.5;       // s — bin must go over right after a capy hit
const physCAUSE_SPILL = 4.0;     // s — a lobbed cup gets a longer arc
const physCAUSE_WATER = 8.0;     // s — a thrown ball can take a while to bob in
// s — you knocked it out of their hands and then picked it up. Long, because
// the barge sends it tumbling and the animal has to turn round and chase it;
// short enough that a hat lying on the lawn since the last chapter is litter.
const physCAUSE_SNATCH = 12.0;

// ===========================================================================
// THE GETAWAY (M7) — a theft is not the moment you take it
// ===========================================================================
//
// Two dozen rows in this game are a theft, and every one of them ticked on the
// frame the prop entered the animal's mouth. So the most-repeated row type in
// the whole list was: walk up to a person, press E, done — and the machinery
// that exists to make that interesting, which is a great deal of machinery,
// happened AFTERWARDS, to a row that was already crossed off. The owner's
// errand, the fifteen-metre leash, the ten-second ceiling, the reclaim at 1.5 m:
// all of it plays out over a task the game has already awarded.
//
// The whole change is where the tick goes. Not a harder gate — the SAME gate,
// moved four seconds later, to the moment it means something:
//
//     A THEFT TICKS WHEN YOU GET AWAY WITH IT.
//
// ---- AND IT CANNOT LOSE YOU THE ROW. This is the part that had to be got
// right, because the review that proposed it named exactly this risk: if the
// owner's chase reliably takes the prop back, a gated theft is a task the
// player can be permanently denied, and `chapComplete` still governs the
// souvenir and the nineteen-of-nineteen finale.
//
// Three properties make that impossible, and each is load-bearing:
//
//   1. THE ARM IS BY TASK ID, NOT BY PROP. Grabbing re-points the entry at
//      whatever is in the mouth now. So a prop taken back, dropped in a canal,
//      destroyed, or left behind in another chapter costs nothing: pick up
//      another empanada and the same row is live again.
//   2. NOTHING EVER DISARMS IT. There is no failure branch. Losing the prop
//      leaves the entry exactly where it was — which is `paEmpWanted`'s rule,
//      already in this tree, and its comment is the right one: IT IS NOT A
//      GATE, IT IS A DEFERRAL.
//   3. DISTANCE **OR** PERSISTENCE. Fifteen metres is `npcOWN_LEASH` — the
//      exact radius at which the owner gives up and turns round, so the tick
//      lands on the frame they do, which is the readable moment. But a chapter
//      with no fifteen metres in it (a salon, a cave chamber, a drift island)
//      must not be able to hold a row hostage on its floor plan, so simply
//      keeping hold of the thing for twelve seconds is also getting away with
//      it — and it is, because `npcOWN_OUT_T` gives up at ten.
const physGETAWAY_T   = 4.0;    // s in the mouth before it can count at all
const physGETAWAY_D   = 15.0;   // m from where it lived. npcOWN_LEASH exactly.
const physGETAWAY_MAX = 12.0;   // s held, after which distance stops mattering
// id -> the prop currently standing for it. One entry per row, overwritten on
// every grab, never deleted except by success.
const physGetaway = Object.create(null);
let physGetawayN = 0;           // rows ticked this session — for the audit hook

/**
 * Arm a theft row. Called instead of `physTask` at the sites that used to tick
 * on the grab itself; safe to call every frame and safe to call twice.
 */
function physArmTheft(id, prop) {
  if (!id || !prop) return;
  physGetaway[id] = prop;
}

/** Has this one got clear? See the three properties above. */
function physGotAway(prop) {
  if (!prop || !prop.held || prop.removed) return false;
  const t = physGame.state ? physGame.state.time : 0;
  const carried = t - (prop.grabTime || 0);
  if (carried < physGETAWAY_T) return false;
  if (carried >= physGETAWAY_MAX) return true;
  const b = prop.body;
  if (!b) return false;
  const dx = b.position.x - prop.homeX, dz = b.position.z - prop.homeZ;
  return dx * dx + dz * dz > physGETAWAY_D * physGETAWAY_D;
}

/** Once a frame, from physUpdate. At most a handful of entries, ever. */
function physGetawayStep() {
  for (const id in physGetaway) {
    if (physGotAway(physGetaway[id])) {
      delete physGetaway[id];
      physGetawayN++;
      physTask(id);
    }
  }
}

/**
 * The harness window, and it reports COUNTS and the live arithmetic rather than
 * the table — `physGetaway` having a key says a row is armed, which is the
 * input, and this repo has shipped that mistake more than once.
 */
function physGetawayAudit() {
  const t = physGame.state ? physGame.state.time : 0;
  const rows = [];
  for (const id in physGetaway) {
    const p = physGetaway[id];
    const b = p && p.body;
    rows.push({ id: id, held: !!(p && p.held),
                carried: p ? +(t - (p.grabTime || 0)).toFixed(2) : -1,
                far: b ? +Math.hypot(b.position.x - p.homeX, b.position.z - p.homeZ).toFixed(1) : -1 });
  }
  return { armed: rows.length, ticked: physGetawayN, rows: rows,
           t: physGETAWAY_T, d: physGETAWAY_D, max: physGETAWAY_MAX };
}

// ===========================================================================
// A THROWN THING THAT HITS A PERSON (the lift pass)
// ===========================================================================
//
// The charged throw has existed since B10 and this file gives all nineteen
// chapters rigid bodies, and the two facts never met: five of the two hundred
// and thirty-two tasks mention throwing anything, and NOTHING in the game
// distinguished an orange landing on a person from an orange landing on the
// pavement beside them. npc.js has answered `prop:impact` since v33 — but with
// `localsReact` only, at a flat 4.2 m/s, on a thirteen-metre circle, scaled
// DOWN by distance. So a direct hit and a near miss were the same event, and
// Sydney's and Pasto's walking casts (which are `humans`/`paHumans`, not
// `locals`) were not reached by it at all.
//
// This is the one generic rule that makes the throw a verb: hit somebody and
// they jump, at full strength, and the incident chain that systems.js already
// runs off `prop:impact` opens on it. Four gates, and every one of them is
// load-bearing:
//
//   IT MUST HAVE BEEN THROWN. `releaseTime` is stamped by every let-go
//   including a set-down into a vessel, by npc.js's fumble and by the Pasto
//   stall collapse, so it is the wrong mark — a crate shaken off a barrow onto
//   a stallholder is the world's doing, not yours. physRelease stamps
//   `thrownT` only when it is handed a launch impulse, which is only ever
//   capybara.js's capyTryRelease. The mark EXPIRES (physHIT_WINDOW) and is
//   SPENT on the first person struck, so one throw is at most one incident
//   however many people it ricochets through.
//
//   IT MUST STILL BE FLYING. A prop in a mouth, in a hand or in a basket is
//   KINEMATIC and out of the collision set; the DYNAMIC test says so directly
//   rather than by listing the states that are not.
//
//   IT MUST HAVE ARRIVED. physHIT_MIN is along the contact normal, and the
//   number comes off a measurement rather than off taste. MEASURED over 160
//   solved throws at people in Sahara, Venice, Kowloon and Sydney (qa/throw-
//   hit.js), 60 of which touched somebody: the normal speeds come out in two
//   clusters with an empty band between them —
//
//       0.00 - 2.67 m/s   (14 of 60)  a prop that has already bounced off the
//                                     ground, or is rolling into an ankle
//       ----- nothing at all between 2.67 and 3.62 -----
//       3.62 - 14.0 m/s   (42 of 60)  the throw arriving
//
//   — so 3.6 sits in the gap. It is not a taste threshold: it is the line the
//   data draws between "you hit them" and "it ended up near them", and it is
//   also why a prop that skips off the pavement into somebody earns nothing.
//
//   AND IT MUST NOT BE THE SIXTH THIS SECOND. A player in the souk has thirty
//   oranges within reach. physHIT_COOL is a whole-game floor between two of
//   these. MEASURED (qa/throw-rate.js): eight throws at one Kowloon local
//   inside 2.0 s produced six contacts over the gate, of which TWO paid out and
//   four were refused — exactly ceil(2.0 / 1.2), so the ceiling is the cooldown
//   and not the player's hands.
//
// physHIT_R is deliberately under half npcLOC_REACT_R: a bang is heard across
// a square, but being HIT is about the person it happened to and the two or
// three standing with them. `startlePeople` is npc.js's own published sweep —
// nothing new is invented here, it is simply reached for the first time by
// something the player did on purpose.
//
// WHAT THE DIFFERENTIAL SAYS IT BUYS. The same eighty throws, run against this
// file and against the same file stashed. npc.js has answered a bang since v33,
// so the baseline is NOT zero — the question was only ever whether a hit is
// louder than a near miss, and it was not. Peak flinch spring on the person
// actually struck, read off npc.js's own record:
//
//                    without        with
//     Sahara     4.80 / max 7.62    20.97 / max 20.97
//     Venice     4.40 / max 6.96    11.33 / max 23.45
//     Kowloon    5.31 / max 8.10     8.94 / max 22.01
//
// The means move; the CEILING is the real finding. Struck by a thrown prop, the
// old build's spring never once passed 8.1 in any of the three chapters, which
// is the most (speed - 4.2)/9 can produce at the 5-9 m/s a throw arrives at.
// With the rule it reaches 21-23 every time, because a hit asks for strength 1
// and a bang cannot. Sydney's walkers have no flinch spring — they have a state
// machine instead — and there all three hits put the victim into a fright state.
const physHIT_WINDOW = 3.0;      // s a throw stays "in flight, and yours"
const physHIT_MIN    = 3.6;      // m/s along the normal before it is a hit
const physHIT_COOL   = 1.2;      // s — the whole-game floor between two of these
const physHIT_R      = 7.0;      // m of people who react, centred on the victim
// The lens kick, scaled by how hard it landed. 0.10 is capybara.js's own
// hop-landing punch and 0.26 is Hanoi's worst; a thrown mango is nearer the
// first than the second, so it tops out below both ends of that range.
const physHIT_PUNCH  = 0.09;
const physHIT_PUNCH_K = 0.014;   // ...per m/s over physHIT_MIN
const physHIT_PUNCH_MAX = 0.20;
// One line, from the person nearest the impact who still has a mouth. NOT the
// victim by construction: `startlePeople` has just spent their line pool on the
// startle itself and `saySomebodyNear` skips anybody whose talkCd is running,
// so this lands on a bystander when there is one and on nobody when there is
// not — which is the right shape for it. Kept short and place-neutral: this
// fires in nineteen cities and a line that names a currency or a coastline is
// wrong in eighteen of them.
const physHIT_LINES = [
  'Oi!',
  'That hit me!',
  'Who threw that?',
  'Watch it!',
  'It threw that. At me.',
  'Right at my head!',
];

// ---- the wheek is a pressure wave -----------------------------------------
// THIS IS EXPRESSION AND IT IS NOT A MECHANIC. Same rule wariness follows — IT
// DOES NOT DENY ANYTHING — read the other way round: it does not GRANT anything
// either. The nudge is capped as a velocity change rather than as an impulse,
// because 1/mass over a range from an 8 g ferry ticket to an 18 kg sack of
// coffee is four orders of magnitude and a fixed impulse would fire the ticket
// into the harbour. Capped, the lightest props all get the same small shove and
// a 9 kg bin gets 0.033 m/s and ignores you.
// MEASURED at the cap, on ordinary ground (mu 0.22, g 24): a prop travels
// v²/2a = 8 cm before friction takes it back, and hops 1.5 mm. That is too
// little to tick a task, to move a prop out of reach, or to walk one off a
// ledge it was deliberately left on — which is the whole design constraint.
const physWHEEK_R = 5.0;         // m — how far a wheek is felt by a prop
const physWHEEK_IMP = 0.30;      // N·s at zero distance, before the cap
const physWHEEK_DVMAX = 0.9;     // m/s — hard ceiling on the resulting nudge
const physWHEEK_LIFT = 0.3;      // ...of which this fraction is upward
const physWHEEK_SOFT = 0.34;     // a calm call is about a third of a loud one
const physWHEEK_FLINCH = 6;      // virtual m/s of impact per m/s of nudge
const physWHEEK_VOICE_DV = 0.35; // m/s below which a prop is stirred but silent
// systems.js drops a 'prop:impact' under 1.5 m/s outright, so a voice has to be
// reported just over that gate or it is not a voice at all. ONE prop per wheek
// gets it — the nearest one that actually moved. A burst of them off the most
// pressed button in the game would be a thud fest AND would inflate
// game.state.chaos, which drives the music and the crowd, for free.
const physWHEEK_VOICE_SPD = 1.6;

// ---- world surfaces -------------------------------------------------------
// Props must be spawned ON the surface under them, not at y = 0. The only
// raised walkable surface is the Opera House podium (CONTRACT.md world layout:
// centred (0,0,-4), 26x16, deck top 1.2). Its static collider is x [-13,13],
// z [-12,4]; the stair down to the forecourt occupies z 4 -> 7.
const physPODIUM_Y = 1.2;
// ...and the red podium on it, a 0.3 m block since L6 (environment.js
// envSTAGE_Y; the `operaStage` zone is exactly this rect)
const physSTAGE_Y = 1.5;
const physSTAGE_RECT = { x0: -6.5, z0: 0.0, x1: 6.5, z1: 2.9 };
// generous — anything even near the deck must resolve to the deck height
const physDECK_FULL = { x0: -13.1, z0: -12.1, x1: 13.1, z1: 4.1 };
// conservative — a prop may only be *scattered* well inside the deck
const physDECK_SAFE = { x0: -12.2, z0: -11.2, x1: 12.2, z1: 3.2 };
// the sloping stair: never a valid resting place
const physSTAIR = { x0: -11.4, z0: 3.2, x1: 11.4, z1: 7.4 };
// solid volumes standing ON the deck (shell bases + restaurant), + margin
const physDECK_BLOCK = [
  { x0: -13.6, z0: -11.8, x1: -1.6, z1: 0.8 },
  { x0: 2.6, z0: -9.3, x1: 13.0, z1: -0.7 },
  { x0: -12.7, z0: -1.2, x1: -8.5, z1: 3.6 },
];
const physDECK_ZONES = { operaStage: 1 };   // zones whose footprint IS the deck
const physFALL_Y = -1.5;         // below this a prop has escaped the world

// ---- Pasto, Nariño (chapter 2) --------------------------------------------
// Everything below is Andean content. It is built ONLY on the first
// 'biome:enter' for 'pasto', so every mesh and body it creates is auto-tagged
// to the Pasto biome by main.js and costs Sydney exactly nothing.
const physSTALL_MAX = 3;         // simultaneously collapsed stalls; the rest re-sleep
const physSTALL_R = 2.4;         // m — barge/tug reach around a stall centre
const physSTALL_BARGE = 3.4;     // m/s — capybara speed that brings a frame down
const physSHATTER_MIN = 6.0;     // m/s along the normal ≈ a 0.75 m drop at g = 24
const physUNWEDGE_MAX = 1.3;     // m — the most a collapsing frame may be hoisted
const physTIP_W = 5.2;           // rad/s of tumble on a collapsing frame
const physCAUSE_CRATER = 30;     // s — a lobbed prop can bounce a long way down
// Measured off game.pasto.terrainHeight: the vent floor is flat out to r ≈ 4.5,
// the inner wall runs 45 m -> 63 m between there and a rim crest at r ≈ 10.75.
// The payoff has to play at the BOTTOM, so the eat radius is the floor, not the
// bowl; the bowl itself is a no-resting zone (physCraterShove).
const physCRATER_EAT_R = 4.6;    // m — inside this, and low, the volcano takes it
const physCRATER_FLOOR_H = 2.4;  // m above craterCentre.y that still counts as "the vent"
const physCRATER_RIM = 11.8;     // m — the crest plus a metre of forgiveness
const physCRATER_STILL = 0.4;    // s without descending before the wall shrugs it on
const physCRATER_DESCEND = 0.25; // m of drop that counts as "still on its way down"
const physCRATER_GIVEUP = 9;     // shoves before the mountain just takes it anyway
const physPUFF_MAX = 24;
// ---- PUTTING A THING IN A THING (B9, item 4a) -----------------------------
//
// `vessel:` and NOT `receive:`. Item 4a reads "make `receive` mean something:
// a bin, a basket, a boat, a fountain, a pram, a gondola" — and `receive` in
// this file is `receiveShadow`, passed straight into physInstGroupFor and
// nothing else. Ten types carry it, and they include a traffic cone, a sign,
// a ruana and a dinner jacket. Measured live: Monte Carlo has eighteen props
// with `receive: true` in it, NINE OF WHICH ARE TRAFFIC CONES.
//
// So the container flag is new, and it goes on the three types that are
// actually a thing you could put a thing in. Measured across all nineteen
// chapters: eighteen of them build at least one, the nearest sits 2.5 m from
// the spawn in Monte Carlo and 26.8 m away in Sơn Đoòng, and Pasto — whose
// props are all food, cloth and pottery — has none at all.
const physPUT_R      = 1.2;      // m — how far a put-down will reach for a vessel
const physPUT_UP     = 0.10;     // m of clearance above the vessel's mouth
const physPUT_TIP    = 0.62;     // rad the vessel may lean before its contents leave
// ---- ...AND THE POOL HAS TO HOLD MORE THAN ONE BREAK (B9) -----------------
// This was 8, and a shatter throws five or six — so TWO breaks in the same
// second recycled the ring and the first one's shards vanished mid-air. That
// was survivable while exactly one type in the game was fragile; it is not
// survivable now that six are, and Monte Carlo can have a wine bottle, a
// camera and a pair of sunglasses go over in the same cascade. Twenty is three
// clear breaks. The cost is twelve more bodies that sleep, never leave the
// world and carry `collisionResponse = false` until they are thrown — the
// pool was built once and never removed for exactly this reason.
const physSHARD_MAX = 20;
const physSHARD_LIFE = 6;
const physHIDE_BOWL = 9;         // s before a shattered bowl is quietly restocked
const physHIDE_CRATER = 7;
const physPASTO_FALL = 9;        // m under the terrain before a prop is rescued
// Radius^2 past which a prop is by definition lost. The widest biome (the Manly
// fairway) reaches ~600 m out, so this has to clear that and still be tighter
// than "wherever a blow-up threw it".
const physESCAPE_R2 = 900 * 900;

// ---- scratch (allocated once, reused forever) -----------------------------
const physV1 = new THREE.Vector3();
const physV2 = new THREE.Vector3();
const physV3 = new THREE.Vector3();
const physQ1 = new THREE.Quaternion();
const physQ2 = new THREE.Quaternion();
const physM4 = new THREE.Matrix4();
const physEuler = new THREE.Euler();
const physUp = new THREE.Vector3(0, 1, 0);
const physCV1 = new CANNON.Vec3();
const physCV2 = new CANNON.Vec3(0, 0.5, 0);   // off-centre lever for bin topples
// Pasto scratch is kept separate: physStallCollapse can fire from inside a
// cannon collide callback, i.e. halfway through physOnCollide's own use of CV1/CV2.
const physCV3 = new CANNON.Vec3();
const physCV4 = new CANNON.Vec3();
// A permanently-zero lever, for an impulse that must produce NO rotation at all
// — see physOnWheek. Kept as its own vector because every other CANNON scratch
// in this file is written by somebody.
const physCV0 = new CANNON.Vec3(0, 0, 0);
const physPV1 = new THREE.Vector3();
const physPQ1 = new THREE.Quaternion();
const physPM4 = new THREE.Matrix4();
// `voice`, `vpitch` and `vgain` are the acoustic half of what the thing is made
// of — see physVOICE. They are OPTIONAL on the payload: a listener that has
// never heard of them (and every listener outside systems.js has not) reads
// prop, speed and position exactly as it always did.
// `spill` is the B9 flag and it exists because of a measurement: physSpill
// emits this event with speed === 0, and EVERY consumer of it gates on speed —
// npcLOC_BANG, npcOWN_BANG, a bare `> 3`, and systems.js's own
// `if (s < 1.5) return`, which is the line incAdd sits below. So a spill was
// heard by exactly one listener in the game, hardcoded to `coffee` and
// `icecream` and behind Sydney's biomeLive(). Measured, four forced spills at
// the feet of ten people in Sydney and three in Venice: 0 startles, 0
// incidents, in both. Raising the speed instead would have let a spill through
// four gates that are about how HARD a thing hit, which is not what a spill is.
const physImpactPayload = { prop: null, speed: 0, position: new THREE.Vector3(),
                            voice: 'thud', vpitch: 1, vgain: 1, spill: false };
const physWaterPayload = { prop: null };
const physDestroyPayload = { prop: null };
const physGrabPayload = { prop: null, from: null };
const physDropPayload = { prop: null };
const physSfxOpts = { volume: 1 };
// A thud heard from the rim of a 60 m volcano: quiet AND an octave down. Kept as
// its own literal so the shared physSfxOpts never carries a stale pitch.
const physSfxDeep = { volume: 0.5, pitch: 0.5 };
const physSfxDeep2 = { volume: 0.34, pitch: 0.36 };
const physSpot = { x: 0, z: 0, ok: false };

// ---- module state ---------------------------------------------------------
let physGame = null;
let physBallMat = null;
let physLightMat = null;
let physPropMat = null;
let physNextId = 1;
let physLastTick = -1;
// ---- the thrown hit (see physPersonHit) ----
// The cooldown is a TIMESTAMP and not a counter ticked in update(): the gate is
// read a handful of times a session, from inside a cannon collide callback, and
// a per-frame decrement for something that idle is a per-frame cost for nothing.
let physHitT = -1e9;             // state.time of the last hit that landed
let physHitN = 0;                // ...and how many, for physHitAudit
let physHitBlocked = 0;          // ...and how many were refused by a gate
let physHitLine = 0;             // rotating index into physHIT_LINES
let physThrowN = 0;              // charged/tapped throws armed, for the same audit
const physGeoCache = new Map();
const physInstGroups = [];
const physInstByKey = new Map();
const physBins = [];
const physRubbish = [];
const physBodyToProp = new Map();   // cannon body id -> prop, for causation lookups
let physDust = null;
let physDustColor = -1;          // hex currently on the (own, not shared) dust material
const physDustPos = new Float32Array(physDUST_MAX * 3);
const physDustVel = new Float32Array(physDUST_MAX * 3);
const physDustLife = new Float32Array(physDUST_MAX);
let physDustHead = 0;
let physDustDirty = true;
let physFoam = null;
const physFoamPos = new Float32Array(physFOAM_MAX * 3);
const physFoamLife = new Float32Array(physFOAM_MAX);
const physFoamMax = new Float32Array(physFOAM_MAX);
let physFoamHead = 0;
let physFoamDirty = true;

// ---- Pasto module state ---------------------------------------------------
let physPastoBuilt = false;
let physBindTimer = 0;
const physStalls = [];           // bound stall records (mine, not pasto.js's)
const physStallSeen = new Set();  // stall objects already bound
const physCollapsed = [];        // collapsed stalls, oldest first (max physSTALL_MAX)
const physHidden = [];           // props parked out of the world, awaiting restock
let physPuffMesh = null;
const physPuffPos = new Float32Array(physPUFF_MAX * 3);
const physPuffVel = new Float32Array(physPUFF_MAX * 3);
const physPuffLife = new Float32Array(physPUFF_MAX);
const physPuffSpan = new Float32Array(physPUFF_MAX);
// Per-particle size multiplier. The crater payoff happens ~16 m below the rim
// the player is standing on; at the default scuff size it is a few white pixels.
const physPuffSize = new Float32Array(physPUFF_MAX);
let physPuffHead = 0;
let physPuffDirty = true;
const physShards = [];
const physShardGeos = [];
let physShardHead = 0;

// ===========================================================================
// 1. PHYSICS WORLD
// ===========================================================================
// ---- THE SWEEP THAT NEVER BROKE (L4) ---------------------------------------
// cannon-es's SAPBroadphase.collisionPairs (vendor/cannon-es.js ~5480) asks
// needBroadphaseCollision BEFORE checkBounds, so a static body `continue`s past
// every other static in the list instead of `break`ing at the first one out of
// range — the sweep degrades toward N² in a chapter that is mostly statics.
// MEASURED (qa/l4r-qa-bp.js): Kyoto, 719 static boxes (a torii leg each),
// 118,429 needBroadphaseCollision calls per substep and 5.05 ms of broadphase
// against Sydney's 3,420 / 0.38 ms; Cali 50,475. vendor/ is not edited; the
// world gets this subclass instead.
//
// The bounds test goes first and it is the AABB, not the sphere: internalStep
// marks the list dirty every substep, sortList then updates every AABB and
// sorts by aabb.lowerBound on the axis, and useBoundingBoxes is on — so once
// bj.aabb.lowerBound is past bi.aabb.upperBound no later body can overlap bi
// on that axis and the break is exact. (Upstream's sphere test is kept for a
// broadphase without bounding boxes; a torii leg's sphere is ±3 m where its
// box is ±0.15, which is most of the difference between 5k and 1k pairs.)
//
// ---- AND TWO THINGS OF MASS ZERO NEVER MEET --------------------------------
// needBroadphaseCollision rejects static–static and sleeping–sleeping, not
// KINEMATIC–static or KINEMATIC–KINEMATIC. A carrier (the ferry, a floe, a
// gondola, the chiva, a crowd collider) against the heightfield is a full
// convexHeightfield walk every substep whose contact then moves nothing, both
// inverse masses being zero. MEASURED (qa/l4r-qa-phys.js): 18.5 heightfield
// pairs a substep in Antarctica (fifteen floes), 17.6 in Venice (sixteen
// gondolas), 189 broadphase pairs in Sydney from 54 crowd colliders. There are
// some sixty KINEMATIC constructors across the chapter modules, so the rule
// lives here rather than as a group on each: a pair with no DYNAMIC body in it
// never enters the narrowphase. The capybara and the props are DYNAMIC and
// keep every contact they had — the ride test in capybara.js reads the capy's
// own contacts, and nothing in src reads a kinematic-vs-static one.
//
// ---- AND THE AXIS IS THE ONE THAT TESTS LEAST ------------------------------
// The sweep axis was x for ever (cannon's default) and Kyoto's torii path runs
// mostly along z, so its legs share an x-interval and the bounds break arrives
// late. MEASURED (qa/l4-bp-axis.js) — pairs a sweep must test per substep by
// axis: Kyoto x 14,618 / z 4,027; Cali x 11,143 / z 9,327; Sydney x 2,435 /
// z 1,747. Not cannon's autoDetectAxis: that picks the axis of greatest
// POSITION VARIANCE, and y wins that in every chapter (a parked body a
// kilometre down, the heightfield) while testing 100k. Once every
// physBP_AXIS_EVERY substeps the three counts are taken directly — three
// sorts of the list and a counting sweep, well under a millisecond and less
// often than every two seconds — and the cheapest axis is kept. Any axis is
// correct; this is only a choice of order.
const physBP_AXIS_EVERY = 240;
class physSAPBroadphase extends CANNON.SAPBroadphase {
  pickAxis() {
    const bodies = this.axisList, N = bodies.length, keys = ['x', 'y', 'z'];
    let best = this.axisIndex, bestTests = Infinity;
    for (let a = 0; a < 3; a++) {
      const k = keys[a];
      const s = bodies.slice().sort((p, q) => p.aabb.lowerBound[k] - q.aabb.lowerBound[k]);
      let tests = 0;
      for (let i = 0; i < N && tests < bestTests; i++) {
        const hi = s[i].aabb.upperBound[k];
        for (let j = i + 1; j < N; j++) { if (s[j].aabb.lowerBound[k] > hi) break; tests++; }
      }
      if (tests < bestTests) { bestTests = tests; best = a; }
    }
    if (best !== this.axisIndex) { this.axisIndex = best; this.sortList(); }
  }
  collisionPairs(world, p1, p2) {
    const bodies = this.axisList, N = bodies.length;
    const boxes = this.useBoundingBoxes;
    if (this.dirty) { this.sortList(); this.dirty = false; }
    // ...and straight after the list changes size, which is a chapter arriving.
    if (boxes && ((this.physSub = (this.physSub | 0) + 1) % physBP_AXIS_EVERY === 1 || N !== this.physN)) { this.physN = N; this.pickAxis(); }
    const ax = this.axisIndex;
    const axisKey = ax === 0 ? 'x' : ax === 1 ? 'y' : 'z';
    for (let i = 0; i !== N; i++) {
      const bi = bodies[i];
      const hi = boxes ? bi.aabb.upperBound[axisKey] : 0;
      for (let j = i + 1; j < N; j++) {
        const bj = bodies[j];
        if (boxes) { if (bj.aabb.lowerBound[axisKey] > hi) break; }
        else if (!CANNON.SAPBroadphase.checkBounds(bi, bj, ax)) break;
        if (!this.needBroadphaseCollision(bi, bj)) continue;
        this.intersectionTest(bi, bj, p1, p2);
      }
    }
  }
  needBroadphaseCollision(a, b) {
    if (a.type !== CANNON.Body.DYNAMIC && b.type !== CANNON.Body.DYNAMIC) return false;
    return super.needBroadphaseCollision(a, b);
  }
}

// ---- THE MATRIX THAT WAS A HASH TABLE --------------------------------------
// World.collisionMatrixTick swaps two ArrayCollisionMatrix and resets one — a
// plain JS array whose `length` was set to n(n-1)/2 by setNumObjects, which
// V8 stores as a dictionary at that size: every one of the 292,206 writes of
// the reset is a hash insert. MEASURED with world.doProfiling (qa/l4-bp-
// prof.js), per substep: Kyoto 8.70 ms in collisionMatrixTick against 1.62 ms
// of broadphase and 1.23 of solver — more than every other phase together;
// Sydney 0.39 ms of a 1.55 ms step. The same matrix on a Uint8Array is a
// fill(). The index cannon uses, i(i+1)/2 + j - 1, runs past n(n-1)/2 on the
// last row (a JS array grew under it), so `set` grows the store itself and
// both matrices are replaced, since the swap makes each of them the current.
class physCollisionMatrix extends CANNON.ArrayCollisionMatrix {
  constructor() { super(); this.matrix = new Uint8Array(1024); }
  setNumObjects(n) {
    const need = ((n * (n + 1)) >> 1) + 1;
    if (this.matrix.length < need) this.matrix = new Uint8Array(Math.ceil(need * 1.25));
  }
  set(bi, bj, value) {
    let i = bi.index, j = bj.index;
    if (j > i) { const t = j; j = i; i = t; }
    const k = ((i * (i + 1)) >> 1) + j - 1;
    if (k >= this.matrix.length) { const m = new Uint8Array(Math.ceil((k + 1) * 1.5)); m.set(this.matrix); this.matrix = m; }
    this.matrix[k] = value ? 1 : 0;
  }
  reset() { this.matrix.fill(0); }
}

export function createPhysicsWorld(game) {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -24, 0) });
  world.broadphase = new physSAPBroadphase(world);
  world.broadphase.useBoundingBoxes = true;
  world.collisionMatrix = new physCollisionMatrix();
  world.collisionMatrixPrevious = new physCollisionMatrix();
  world.solver.iterations = 10;
  world.solver.tolerance = 0.002;
  world.allowSleep = true;
  world.defaultContactMaterial.friction = 0.4;
  world.defaultContactMaterial.restitution = 0.12;

  const ground = new CANNON.Material('ground');
  const prop = new CANNON.Material('prop');
  const capy = new CANNON.Material('capy');
  const npc = new CANNON.Material('npc');
  physBallMat = new CANNON.Material('ball');
  physLightMat = new CANNON.Material('light');
  game.mats = { ground, prop, capy, npc };

  physPair(world, ground, prop, 0.35, 0.34);
  // ---- THE GROUND MAY NOT BRAKE THE CHARACTER ------------------------------
  // capybara.js owns horizontal motion outright: it writes body.velocity every
  // frame from an acceleration model and damps to a stop at capySTOP_LAMBDA. A
  // Coulomb contact underneath that is not "grip", it is a second controller
  // fighting the first — and it wins, because it acts inside the solver.
  // MEASURED at mu 0.90 on flat ground with the stick held: the solver removed
  // 1.83 m/s of horizontal velocity on every frame the body had contact, the
  // controller could only add capyACCEL*dt = 0.92 m/s back, and the body ended up
  // oscillating 2.40 <-> 1.48 m/s for ever — a 4:1 swing in per-frame travel at a
  // metronome 60 Hz, which is exactly the jerk that was reported. It also cost
  // more than half the walk: 4.2 m/s authored, 1.9 m/s achieved.
  // The impulse is not proportional to mu (0.90 and 0.30 measured identically),
  // so it cannot be tuned out — the friction equations are cancelling the
  // sliding outright across three contact points. It has to be zero.
  // Swept: mu 0.05 -> 1.94 m/s and CV 0.31; mu 0.02 -> 3.71 m/s and CV 0.19;
  // mu 0.00 -> 4.20 m/s, CV 0.000, vertical range 0.0000 m, and the micro-bounce
  // that broke contact every other frame stops happening at all.
  // Moving platforms are handled where they belong, in the controller — see the
  // platform-frame block in capybara.js. They never needed friction.
  physPair(world, ground, capy, 0.00, 0.00);
  physPair(world, prop, capy, 0.30, 0.35);
  physPair(world, prop, prop, 0.30, 0.40);
  // sensible extras so NPCs and the beach ball behave
  physPair(world, ground, npc, 0.80, 0.00);
  physPair(world, prop, npc, 0.30, 0.30);
  physPair(world, capy, npc, 0.30, 0.10);
  physPair(world, ground, physBallMat, 0.22, 0.72);
  physPair(world, prop, physBallMat, 0.20, 0.60);
  physPair(world, capy, physBallMat, 0.20, 0.55);
  physPair(world, npc, physBallMat, 0.20, 0.55);
  // light tier — hats, thongs, frisbees. They must skitter, hop and cartwheel.
  physPair(world, ground, physLightMat, 0.22, 0.52);
  physPair(world, prop, physLightMat, 0.22, 0.55);
  physPair(world, capy, physLightMat, 0.22, 0.50);
  physPair(world, npc, physLightMat, 0.22, 0.50);
  physPair(world, physLightMat, physLightMat, 0.22, 0.55);
  physPair(world, physLightMat, physBallMat, 0.20, 0.58);

  game.world = world;
  return { update() {} };
}

function physPair(world, a, b, friction, restitution) {
  world.addContactMaterial(new CANNON.ContactMaterial(a, b, {
    friction, restitution,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3,
  }));
}

// ===========================================================================
// 2. GEOMETRY BAKERY
// ===========================================================================
function physAdd(group, geo, color, x, y, z, rx, ry, rz) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  if (rx || ry || rz) m.rotation.set(rx || 0, ry || 0, rz || 0);
  group.add(m);
  return m;
}
function physBoxG(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function physCylG(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 8, 1); }
function physSphG(r) { return new THREE.SphereGeometry(r, 8, 6); }
function physConeG(r, h) { return new THREE.ConeGeometry(r, h, 8); }

/** Bakes a small authored hierarchy into one vertex-coloured geometry. */
function physFlatten(root, originY, def) {
  root.updateMatrixWorld(true);
  const pos = [];
  const nrm = [];
  const col = [];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.geometry;
    const g = src.index ? src.toNonIndexed() : src.clone();
    g.applyMatrix4(o.matrixWorld);
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const c = o.material.color;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nrm.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
    src.dispose();
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (def) physFitDef(def, geo);
  geo.translate(def ? def.fitDX : 0, def ? def.fitDY : -originY, def ? def.fitDZ : 0);
  geo.computeBoundingSphere();
  return geo;
}

/**
 * THE COLLIDER IS THE THING THAT WAS DRAWN.
 *
 * Every `shape` in physTYPES used to be a hand-typed guess at the size of the
 * prop above it, and thirty guesses drift. Measured against the baked geometry
 * before this: the sign's collider was HALF the depth of the sign, so you walked
 * to the middle of it; the picnic basket's stopped 22 cm under its own handle;
 * the camera's enclosed 36% of the camera; the plantains' was 1.83x too wide in
 * x, 29% too short in y, and hung 4.6 cm of fruit through the ground because the
 * builder had authored the bunch below its own origin.
 *
 * So it is not typed any more. The prop is built, measured, and the box and the
 * origin both come off the measurement: the geometry is recentred on x/z, its
 * base is put exactly on -hy whatever the builder did, and hy is half the real
 * height — which is what makes the collider bracket the mesh exactly and the
 * drawn base rest exactly on the ground.
 */
function physFitDef(def, geo) {
  if (def.fitted) return;
  def.fitted = true;
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const w = bb.max.x - bb.min.x, h = bb.max.y - bb.min.y, d = bb.max.z - bb.min.z;
  const hy = h * 0.5;
  def.hy = hy;
  def.shape = def.shape[0] === 'sph'
    ? ['sph', Math.max(w, h, d) * 0.5]
    : ['box', w * 0.5, hy, d * 0.5];
  def.fitDX = -(bb.min.x + bb.max.x) * 0.5;
  def.fitDZ = -(bb.min.z + bb.max.z) * 0.5;
  def.fitDY = -bb.min.y - hy;
}

// ---- prop builders (authored with their base sitting on y = 0) ------------
function physBuildHat(g) {
  physAdd(g, physCylG(0.44, 0.44, 0.045), PALETTE.khaki, 0, 0.03, 0);
  physAdd(g, physCylG(0.23, 0.26, 0.2), PALETTE.cloth6, 0, 0.14, 0);
  physAdd(g, physCylG(0.265, 0.265, 0.055), PALETTE.cloth1, 0, 0.08, 0);
  physAdd(g, physCylG(0.2, 0.22, 0.03), PALETTE.cloth6, 0, 0.25, 0);
}
function physBuildCoffee(g) {
  physAdd(g, physCylG(0.115, 0.085, 0.28), PALETTE.coffee, 0, 0.14, 0);
  physAdd(g, physCylG(0.12, 0.105, 0.09), PALETTE.wood, 0, 0.13, 0);
  physAdd(g, physCylG(0.13, 0.13, 0.05), PALETTE.coffeeLid, 0, 0.3, 0);
  physAdd(g, physBoxG(0.05, 0.03, 0.05), PALETTE.coffeeLid, 0.05, 0.33, 0);
}
function physBuildCoffeeSpill(g) {
  physAdd(g, physCylG(0.6, 0.52, 0.025), PALETTE.coffeeLiquid, 0.12, 0.012, 0.05);
  physAdd(g, physCylG(0.22, 0.18, 0.03), PALETTE.coffeeLiquid, -0.34, 0.015, -0.2);
  physAdd(g, physCylG(0.115, 0.085, 0.28), PALETTE.coffee, -0.28, 0.12, 0.02, 0, 0, Math.PI * 0.5);
  physAdd(g, physCylG(0.13, 0.13, 0.05), PALETTE.coffeeLid, -0.05, 0.04, 0.16, 0, 0, Math.PI * 0.5);
}
function physBuildSandwich(g) {
  physAdd(g, physBoxG(0.36, 0.08, 0.32), PALETTE.bread, 0, 0.04, 0);
  physAdd(g, physBoxG(0.34, 0.045, 0.3), PALETTE.lettuce, 0.01, 0.1, 0.01, 0, 0.12, 0);
  physAdd(g, physBoxG(0.3, 0.05, 0.28), PALETTE.tomato, -0.01, 0.145, 0);
  physAdd(g, physBoxG(0.36, 0.09, 0.32), PALETTE.bread, 0, 0.21, 0, 0, -0.08, 0);
}
function physBuildBall(g) {
  physAdd(g, physSphG(0.38), PALETTE.ball, 0, 0.38, 0);
  const a = physAdd(g, physSphG(0.385), PALETTE.ballStripe, 0, 0.38, 0);
  a.scale.set(1, 0.32, 1);
  const b = physAdd(g, physSphG(0.385), PALETTE.cloth2, 0, 0.38, 0);
  b.scale.set(0.32, 1, 1);
}
function physBuildBin(g) {
  physAdd(g, physCylG(0.44, 0.36, 1.06), PALETTE.binGreen, 0, 0.53, 0);
  physAdd(g, physCylG(0.47, 0.47, 0.09), PALETTE.binLid, 0, 1.03, 0);
  const dome = physAdd(g, physSphG(0.45), PALETTE.binLid, 0, 1.06, 0);
  dome.scale.set(1, 0.34, 1);
  physAdd(g, physBoxG(0.24, 0.3, 0.03), PALETTE.cloth6, 0, 0.6, 0.37);
}
function physBuildDeckchair(g) {
  physAdd(g, physBoxG(0.66, 0.06, 0.52), PALETTE.cloth2, 0, 0.44, 0.06, -0.13, 0, 0);
  physAdd(g, physBoxG(0.66, 0.06, 0.58), PALETTE.cloth3, 0, 0.74, -0.3, -0.95, 0, 0);
  physAdd(g, physBoxG(0.05, 0.56, 0.05), PALETTE.wood, -0.34, 0.28, 0.24, 0.22, 0, 0);
  physAdd(g, physBoxG(0.05, 0.56, 0.05), PALETTE.wood, 0.34, 0.28, 0.24, 0.22, 0, 0);
  physAdd(g, physBoxG(0.05, 0.7, 0.05), PALETTE.woodDark, -0.34, 0.35, -0.28, -0.3, 0, 0);
  physAdd(g, physBoxG(0.05, 0.7, 0.05), PALETTE.woodDark, 0.34, 0.35, -0.28, -0.3, 0, 0);
  physAdd(g, physBoxG(0.72, 0.05, 0.05), PALETTE.wood, 0, 0.16, 0.02);
}
function physBuildFlower(g, petal) {
  physAdd(g, physCylG(0.21, 0.15, 0.26), PALETTE.cone, 0, 0.13, 0);
  physAdd(g, physCylG(0.22, 0.22, 0.05), PALETTE.sandstoneDark, 0, 0.25, 0);
  physAdd(g, physCylG(0.17, 0.17, 0.05), PALETTE.soil, 0, 0.26, 0);
  physAdd(g, physBoxG(0.05, 0.4, 0.05), PALETTE.leafC, 0, 0.47, 0, 0, 0, 0.06);
  physAdd(g, physBoxG(0.18, 0.03, 0.09), PALETTE.leafB, 0.11, 0.42, 0, 0, 0.3, 0.35);
  physAdd(g, physBoxG(0.18, 0.03, 0.09), PALETTE.leafB, -0.11, 0.52, 0.02, 0, -0.4, -0.3);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    physAdd(g, physBoxG(0.15, 0.045, 0.1), petal, Math.cos(a) * 0.1, 0.7, Math.sin(a) * 0.1, 0, -a, 0.22);
  }
  physAdd(g, physSphG(0.08), PALETTE.petalYellow, 0, 0.72, 0);
}
function physBuildEsky(g) {
  physAdd(g, physBoxG(0.72, 0.4, 0.46), PALETTE.esky, 0, 0.2, 0);
  physAdd(g, physBoxG(0.76, 0.1, 0.5), PALETTE.eskyLid, 0, 0.45, 0);
  physAdd(g, physBoxG(0.06, 0.14, 0.22), PALETTE.eskyLid, -0.38, 0.24, 0);
  physAdd(g, physBoxG(0.06, 0.14, 0.22), PALETTE.eskyLid, 0.38, 0.24, 0);
  physAdd(g, physBoxG(0.5, 0.05, 0.05), PALETTE.plastic, 0, 0.52, 0);
}
function physBuildThong(g) {
  physAdd(g, physBoxG(0.3, 0.05, 0.12), PALETTE.cloth2, 0, 0.025, 0);
  physAdd(g, physBoxG(0.1, 0.04, 0.1), PALETTE.cloth2, 0.14, 0.025, 0, 0, 0.5, 0);
  physAdd(g, physBoxG(0.16, 0.03, 0.03), PALETTE.cloth6, -0.04, 0.07, 0.04, 0.5, 0.4, 0);
  physAdd(g, physBoxG(0.16, 0.03, 0.03), PALETTE.cloth6, -0.04, 0.07, -0.04, -0.5, -0.4, 0);
}
function physBuildFrisbee(g) {
  physAdd(g, physCylG(0.33, 0.29, 0.045), PALETTE.cloth4, 0, 0.025, 0);
  physAdd(g, physCylG(0.24, 0.24, 0.06), PALETTE.cloth6, 0, 0.05, 0);
  physAdd(g, physCylG(0.1, 0.1, 0.02), PALETTE.cloth1, 0, 0.08, 0);
}
function physBuildBasket(g) {
  physAdd(g, physCylG(0.36, 0.3, 0.34), PALETTE.wood, 0, 0.17, 0);
  physAdd(g, physCylG(0.3, 0.3, 0.05), PALETTE.woodDark, 0, 0.33, 0);
  physAdd(g, physCylG(0.375, 0.375, 0.05), PALETTE.woodDark, 0, 0.24, 0);
  physAdd(g, physBoxG(0.05, 0.3, 0.05), PALETTE.woodDark, -0.28, 0.46, 0, 0, 0, 0.35);
  physAdd(g, physBoxG(0.05, 0.3, 0.05), PALETTE.woodDark, 0.28, 0.46, 0, 0, 0, -0.35);
  physAdd(g, physBoxG(0.48, 0.05, 0.05), PALETTE.woodDark, 0, 0.6, 0);
  physAdd(g, physBoxG(0.34, 0.04, 0.24), PALETTE.cloth6, 0, 0.35, 0, 0, 0.3, 0);
}
function physBuildCone(g) {
  physAdd(g, physBoxG(0.58, 0.06, 0.58), PALETTE.cone, 0, 0.03, 0);
  physAdd(g, physConeG(0.28, 0.72), PALETTE.cone, 0, 0.42, 0);
  physAdd(g, physCylG(0.155, 0.185, 0.13), PALETTE.cloth6, 0, 0.44, 0);
}
function physBuildHandbag(g) {
  physAdd(g, physBoxG(0.34, 0.26, 0.16), PALETTE.cloth5, 0, 0.15, 0);
  physAdd(g, physBoxG(0.35, 0.09, 0.17), PALETTE.cloth7, 0, 0.31, 0);
  physAdd(g, physBoxG(0.05, 0.22, 0.05), PALETTE.cloth7, -0.13, 0.44, 0, 0, 0, 0.3);
  physAdd(g, physBoxG(0.05, 0.22, 0.05), PALETTE.cloth7, 0.13, 0.44, 0, 0, 0, -0.3);
  physAdd(g, physBoxG(0.24, 0.05, 0.05), PALETTE.cloth7, 0, 0.55, 0);
  physAdd(g, physBoxG(0.07, 0.05, 0.03), PALETTE.petalYellow, 0, 0.27, 0.09);
}
function physBuildIcecream(g) {
  physAdd(g, physConeG(0.13, 0.36), PALETTE.bread, 0, 0.18, 0, Math.PI, 0, 0);
  physAdd(g, physCylG(0.14, 0.13, 0.05), PALETTE.bread, 0, 0.37, 0);
  physAdd(g, physSphG(0.16), PALETTE.petalPink, 0, 0.47, 0);
  physAdd(g, physSphG(0.11), PALETTE.petalWhite, 0.03, 0.6, -0.02);
  physAdd(g, physSphG(0.05), PALETTE.petalRed, 0, 0.69, 0);
}
function physBuildIcecreamSpill(g) {
  physAdd(g, physCylG(0.34, 0.28, 0.03), PALETTE.petalPink, 0.16, 0.015, 0.04);
  physAdd(g, physSphG(0.13), PALETTE.petalPink, 0.16, 0.05, 0.04);
  physAdd(g, physConeG(0.13, 0.36), PALETTE.bread, -0.22, 0.12, 0, 0, 0, Math.PI * 0.5);
  physAdd(g, physSphG(0.05), PALETTE.petalRed, 0.34, 0.05, -0.12);
}
function physBuildSign(g) {
  physAdd(g, physBoxG(0.09, 1.34, 0.09), PALETTE.metal, 0, 0.67, 0);
  physAdd(g, physBoxG(0.94, 0.52, 0.07), PALETTE.cloth6, 0, 1.3, 0);
  physAdd(g, physBoxG(0.86, 0.1, 0.09), PALETTE.cloth2, 0, 1.4, 0);
  physAdd(g, physBoxG(0.62, 0.08, 0.09), PALETTE.cloth2, -0.1, 1.2, 0);
  physAdd(g, physBoxG(0.4, 0.06, 0.4), PALETTE.metal, 0, 0.03, 0);
}
// ===========================================================================
// THE POSTER (item 6, B15) — AND WHY IT IS NOT A PHOTOGRAPH
//
// The item asks for "one grabbable wanted-poster per chapter, textured with
// the player's own album thumbnail". That was built far enough to look at and
// then refused, on three measurements:
//
//  1. THE ALBUM HOLDS POSTCARDS, NOT MUGSHOTS. A shot is a 288x180 blit of
//     the whole frame — `albAdd` draws the canvas, not the animal — so what
//     comes back is the place, with a capybara about twenty pixels tall
//     somewhere in it. Rendered on a plane in front of the camera and looked
//     at (`qa/poster-tex.png`): you cannot tell what it is a picture of. A
//     wanted poster whose portrait is unreadable is not a wanted poster.
//  2. IT COMES OUT DOUBLE-GRADED. The shot already has the composite's tone
//     map and airlight baked into it, and then renders THROUGH them again —
//     visibly paler and flatter than the world it is standing in.
//  3. IT WOULD BE THE FIRST TEXTURE IN THE GAME. One grep of src: a single
//     1x1 black DataTexture in main.js, a post-processing fallback. Nineteen
//     chapters of hand-built scenery and not one image on a surface — and the
//     exit board, the most important object in every one of them, is six rows
//     of split-flap colour chips for exactly this reason, in its own words:
//     "this game has no text in the world and is not about to grow a font
//     atlas."
//
// So it is drawn the way everything else in this file is drawn. A pinned
// sheet, a dark rodent shape on it, and three bars where the writing would be
// — which is a wanted poster by convention, at any distance, in any of the
// nineteen palettes, with no image and no letters. The bars are the same joke
// the departures board makes: the shape of writing, never the writing.
//
// The silhouette is the animal's own darkest colour rather than black: at 0.6
// m the eye reads the shape, and the family of the colour is what says it is
// about YOU rather than about a dog.
function physBuildPoster(g) {
  // post and foot
  physAdd(g, physBoxG(0.07, 0.78, 0.07), PALETTE.trunkDark, 0, 0.39, 0);
  physAdd(g, physBoxG(0.40, 0.06, 0.34), PALETTE.trunkDark, 0, 0.03, 0);
  // the board behind the paper, so the sheet reads as pinned to something
  physAdd(g, physBoxG(0.62, 0.72, 0.045), PALETTE.sandstoneDark, 0, 1.06, 0);
  physAdd(g, physBoxG(0.56, 0.66, 0.05), PALETTE.sail, 0, 1.06, 0.006);
  // ---- the animal ----
  // A loaf, a head, a snout and one ear: the same four parts the capybara's
  // own silhouette reads as at distance, flattened.
  const S = PALETTE.capyNose;
  physAdd(g, physBoxG(0.30, 0.155, 0.02), S, -0.02, 1.16, 0.034);
  physAdd(g, physBoxG(0.125, 0.115, 0.02), S, 0.165, 1.20, 0.034);
  physAdd(g, physBoxG(0.06, 0.055, 0.02), S, 0.245, 1.185, 0.034);
  physAdd(g, physBoxG(0.045, 0.045, 0.02), S, 0.145, 1.272, 0.034);
  physAdd(g, physBoxG(0.045, 0.06, 0.02), S, -0.10, 1.055, 0.034);
  physAdd(g, physBoxG(0.045, 0.06, 0.02), S, 0.06, 1.055, 0.034);
  // ---- and where the writing would be ----
  physAdd(g, physBoxG(0.34, 0.032, 0.02), PALETTE.stoneDark, 0, 0.955, 0.034);
  physAdd(g, physBoxG(0.24, 0.024, 0.02), PALETTE.stoneDark, -0.04, 0.905, 0.034);
  physAdd(g, physBoxG(0.29, 0.024, 0.02), PALETTE.stoneDark, 0.01, 0.865, 0.034);
  // two pins, because a sheet with no fixings reads as painted on
  physAdd(g, physCylG(0.018, 0.018, 0.02), PALETTE.metal, -0.22, 1.35, 0.04, Math.PI * 0.5, 0, 0);
  physAdd(g, physCylG(0.018, 0.018, 0.02), PALETTE.metal, 0.22, 1.35, 0.04, Math.PI * 0.5, 0, 0);
}
function physBuildTowel(g) {
  physAdd(g, physBoxG(0.94, 0.1, 0.62), PALETTE.towel, 0, 0.05, 0);
  physAdd(g, physBoxG(0.9, 0.09, 0.32), PALETTE.cloth6, 0.01, 0.14, -0.1, 0, 0.05, 0);
  physAdd(g, physBoxG(0.86, 0.06, 0.14), PALETTE.cloth1, 0, 0.2, -0.05);
}

// ---- THE YUZU (L8, F1) ----------------------------------------------------
// Chapter-neutral like `poster` above: the currency and none of it scatters
// from a chapter's own table. A ball plus a leaf nub, same low-poly budget
// as `dango` — the fruit has to read from 25-70 m (F1's table), not up close.
function physBuildYuzu(g) {
  physAdd(g, physSphG(0.10), PALETTE.yuzu, 0, 0.10, 0);
  physAdd(g, physBoxG(0.018, 0.05, 0.018), PALETTE.yuzuLeaf, 0.03, 0.19, 0, 0, 0, 0.5);
}
function physBuildYuzuGold(g) {
  physAdd(g, physSphG(0.12), PALETTE.yuzuGold, 0, 0.12, 0);
  physAdd(g, physSphG(0.122), PALETTE.yuzuGoldDk, 0, 0.12, 0).scale.set(1, 0.94, 1);
  physAdd(g, physBoxG(0.02, 0.06, 0.02), PALETTE.yuzuLeaf, 0.035, 0.225, 0, 0, 0, 0.5);
}
// THE GENERIC FOOD ROLL (L8, F4): a chapter with no edible of its own in
// `physBIOME_SCATTER` (iceland, sahara, drift, venice, palawan, goreme,
// manly, cave, antarctic, monaco — measured, see sysDROP_FOOD in
// systems.js) drops this instead of borrowing another chapter's dish. A
// ball plus a leaf nub, the same shape family as the yuzu it sits beside in
// the pool, in the one colour this pass adds.
function physBuildOrange(g) {
  physAdd(g, physSphG(0.085), PALETTE.orange, 0, 0.085, 0);
  physAdd(g, physBoxG(0.016, 0.04, 0.016), PALETTE.orangeLeaf, 0, 0.155, 0);
}
// THE BATH (F4): a tub, mesh only this pass. `grabbable: false` below is the
// real, final value — the bath is a proximity ride (hop in), never a grab —
// and its carriedBy sequence, the spawner, and the map star are all wave 1's
// job (see ROADMAP-LIFT8.md). Nothing spawns this type yet.
function physBuildYuzuBath(g) {
  physAdd(g, physCylG(0.62, 0.58, 0.42), PALETTE.woodDark, 0, 0.21, 0);
  physAdd(g, physCylG(0.56, 0.56, 0.36), PALETTE.water, 0, 0.28, 0);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, r = 0.32;
    physAdd(g, physSphG(0.09), i % 2 ? PALETTE.yuzu : PALETTE.yuzuGold,
      Math.cos(a) * r, 0.33, Math.sin(a) * r);
  }
}

// ---- Circular Quay set (chapter 1) ---------------------------------------
function physBuildChips(g) {
  // paper cone, apex down, stuffed with chips — readable from directly above
  physAdd(g, physConeG(0.17, 0.42), PALETTE.cloth6, 0, 0.22, 0, Math.PI, 0, 0);
  physAdd(g, physCylG(0.175, 0.175, 0.05), PALETTE.cloth1, 0, 0.4, 0);
  physAdd(g, physCylG(0.155, 0.155, 0.04), PALETTE.bread, 0, 0.41, 0);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    physAdd(g, physBoxG(0.05, 0.24, 0.05), i % 2 ? PALETTE.petalYellow : PALETTE.bread,
      Math.cos(a) * 0.07, 0.5, Math.sin(a) * 0.07, Math.sin(a) * 0.3, -a, Math.cos(a) * 0.3);
  }
}
function physBuildCamera(g) {
  physAdd(g, physBoxG(0.3, 0.18, 0.15), PALETTE.metal, 0, 0.12, 0);
  physAdd(g, physBoxG(0.2, 0.06, 0.13), PALETTE.stoneDark, -0.02, 0.23, 0);
  physAdd(g, physCylG(0.026, 0.026, 0.035), PALETTE.binRed, 0.09, 0.27, 0);
  physAdd(g, physBoxG(0.07, 0.045, 0.03), PALETTE.cloth6, -0.09, 0.25, 0.05);
  physAdd(g, physCylG(0.085, 0.095, 0.13), PALETTE.stoneDark, 0, 0.12, 0.13, Math.PI * 0.5, 0, 0);
  physAdd(g, physCylG(0.062, 0.062, 0.03), PALETTE.glass, 0, 0.12, 0.2, Math.PI * 0.5, 0, 0);
  // strap, looped up over the top
  physAdd(g, physBoxG(0.035, 0.22, 0.05), PALETTE.khaki, -0.16, 0.28, 0, 0, 0, 0.5);
  physAdd(g, physBoxG(0.035, 0.22, 0.05), PALETTE.khaki, 0.16, 0.28, 0, 0, 0, -0.5);
  physAdd(g, physBoxG(0.26, 0.035, 0.05), PALETTE.khaki, 0, 0.39, 0);
}
function physBuildSunglasses(g) {
  // Chunky folded shades. The folded arms are the *base*; the frame plate,
  // lenses and bridge all sit above y = 0.09 so nothing that reads as
  // "sunglasses" can end up buried under the quay's paving decals.
  physAdd(g, physBoxG(0.26, 0.04, 0.035), PALETTE.denim, 0.02, 0.022, 0.05, 0, 0.13, 0);
  physAdd(g, physBoxG(0.26, 0.04, 0.035), PALETTE.denim, 0.02, 0.022, -0.05, 0, -0.13, 0);
  physAdd(g, physBoxG(0.32, 0.055, 0.1), PALETTE.denim, 0, 0.1, 0);
  physAdd(g, physBoxG(0.115, 0.04, 0.085), PALETTE.glass, -0.095, 0.145, 0);
  physAdd(g, physBoxG(0.115, 0.04, 0.085), PALETTE.glass, 0.095, 0.145, 0);
  physAdd(g, physBoxG(0.06, 0.05, 0.07), PALETTE.cloth7, 0, 0.15, 0);
}
function physBuildTicket(g) {
  // A thick, slightly curled card. Chunky proportions on purpose: a wafer-thin
  // ticket disappears into the ground decals and reads as nothing at all.
  physAdd(g, physBoxG(0.26, 0.07, 0.17), PALETTE.cloth6, -0.02, 0.038, 0);
  physAdd(g, physBoxG(0.25, 0.05, 0.06), PALETTE.cloth2, -0.02, 0.095, -0.05);
  physAdd(g, physBoxG(0.08, 0.05, 0.05), PALETTE.petalYellow, -0.09, 0.095, 0.035);
  physAdd(g, physCylG(0.032, 0.032, 0.05), PALETTE.cloth2, 0.04, 0.095, 0.04);
  // the far end curls up off the deck — the silhouette from above
  physAdd(g, physBoxG(0.1, 0.07, 0.17), PALETTE.cloth6, 0.135, 0.062, 0, 0, 0, -0.6);
  physAdd(g, physBoxG(0.09, 0.065, 0.17), PALETTE.cloth2, 0.185, 0.135, 0, 0, 0, -1.15);
}
function physBuildMenu(g) {
  // A-frame chalkboard on the dining terrace
  physAdd(g, physBoxG(0.64, 0.92, 0.05), PALETTE.woodDark, 0, 0.48, 0.13, 0.22, 0, 0);
  physAdd(g, physBoxG(0.64, 0.92, 0.05), PALETTE.woodDark, 0, 0.48, -0.13, -0.22, 0, 0);
  physAdd(g, physBoxG(0.5, 0.74, 0.02), PALETTE.stoneDark, 0, 0.5, 0.18, 0.22, 0, 0);
  physAdd(g, physBoxG(0.5, 0.74, 0.02), PALETTE.stoneDark, 0, 0.5, -0.18, -0.22, 0, 0);
  physAdd(g, physBoxG(0.36, 0.05, 0.02), PALETTE.cloth6, -0.02, 0.74, 0.2, 0.22, 0, 0);
  physAdd(g, physBoxG(0.3, 0.04, 0.02), PALETTE.cloth6, 0.02, 0.6, 0.23, 0.22, 0, 0);
  physAdd(g, physBoxG(0.26, 0.04, 0.02), PALETTE.cloth3, -0.04, 0.46, 0.26, 0.22, 0, 0);
  physAdd(g, physBoxG(0.68, 0.06, 0.34), PALETTE.wood, 0, 0.94, 0);
}
function physBuildWinebottle(g) {
  physAdd(g, physCylG(0.09, 0.085, 0.34), PALETTE.leafC, 0, 0.17, 0);
  physAdd(g, physCylG(0.093, 0.093, 0.13), PALETTE.cloth6, 0, 0.16, 0);
  physAdd(g, physCylG(0.042, 0.09, 0.12), PALETTE.leafC, 0, 0.4, 0);
  physAdd(g, physCylG(0.04, 0.042, 0.13), PALETTE.leafC, 0, 0.52, 0);
  physAdd(g, physCylG(0.045, 0.045, 0.055), PALETTE.binRed, 0, 0.59, 0);
}

// ---- Pasto market set (chapter 2) ----------------------------------------
// Oversized on purpose: everything here has to read as itself from the fixed
// ~35 degree overhead camera, so silhouettes are fat and the details are few.
function physBuildEmpanada(g) {
  // The hero prop of the chapter, so the silhouette does the work: a fat golden
  // half-moon built as a tapered arc of squashed spheres, with a pale crimped
  // seam running along the outer curve. From the overhead camera the outline
  // reads as a crescent even at two pixels of detail.
  const R = 0.24;
  for (let i = 0; i < 5; i++) {
    const a = -1.15 + i * 0.575;
    const t = 1 - Math.abs(i - 2) * 0.24;
    const s = physAdd(g, physSphG(0.155), PALETTE.empanada,
      Math.sin(a) * R, 0.1, Math.cos(a) * R - 0.15);
    s.scale.set(t * 1.15, t * 0.72, t * 1.15);
  }
  const gloss = physAdd(g, physSphG(0.13), PALETTE.arepa, 0, 0.15, 0.03);
  gloss.scale.set(1.5, 0.34, 0.85);
  for (let i = 0; i < 6; i++) {
    const a = -1.22 + i * 0.488;
    const t = 1 - Math.abs(i - 2.5) * 0.16;
    physAdd(g, physBoxG(0.085 * t, 0.095 * t, 0.07), PALETTE.arepa,
      Math.sin(a) * (R + 0.095), 0.085, Math.cos(a) * (R + 0.095) - 0.15, 0, a, 0.32);
  }
  physAdd(g, physBoxG(0.06, 0.03, 0.05), PALETTE.bread, -0.05, 0.185, -0.04, 0, 0.4, 0);
  physAdd(g, physBoxG(0.05, 0.03, 0.04), PALETTE.bread, 0.07, 0.18, -0.02, 0, -0.3, 0);
}
function physBuildArepa(g) {
  physAdd(g, physCylG(0.26, 0.245, 0.13), PALETTE.arepa, 0, 0.065, 0);
  physAdd(g, physCylG(0.225, 0.225, 0.04), PALETTE.bread, 0, 0.145, 0);
  physAdd(g, physCylG(0.1, 0.1, 0.025), PALETTE.empanada, 0.05, 0.16, -0.04);
  physAdd(g, physBoxG(0.11, 0.025, 0.06), PALETTE.empanada, -0.09, 0.16, 0.07, 0, 0.6, 0);
}
// HANAMI DANGO — three rounds on a skewer, pink, white and matcha green.
//
// It exists because KYOTO HAD NOTHING EDIBLE IN IT. Batch 1 built a produce
// reaction — graze somebody's food and you get a line and a shoo — and the
// chapter could not reach it, because the reaction is driven off `edible` and
// Kyoto's ten scattered props were baskets, bins, cones and signs. Six of the
// eight chapters in this batch had the same hole.
//
// It also replaces two `cuencobowl` — a Nariño soup bowl — standing in a
// Japanese tea town, which is the same wrong-continent mistake the Marrakech
// scatter list was caught making, in the chapter directly after it.
function physBuildDango(g) {
  physAdd(g, physCylG(0.014, 0.012, 0.42), PALETTE.templeWood, 0, 0.05, 0, Math.PI * 0.5, 0, 0);
  physAdd(g, physSphG(0.062), PALETTE.sakura,      0, 0.062, 0.115);
  physAdd(g, physSphG(0.062), PALETTE.petalWhite,  0, 0.062, 0);
  physAdd(g, physSphG(0.062), PALETTE.matchaPale,  0, 0.062, -0.115);
}
// ---- THE ONE THING IN THIS GAME THAT IS GIVEN TO YOU (B8) ------------------
// A folded pastry in a twist of paper. It is deliberately the ONLY new edible
// and deliberately not any nation's: ROADMAP-FUN asks for one per chapter's
// palette — a mochi, an arepa, a rice cake, a melon — and ten new prop types
// with ten build functions is a batch of its own, while a bun that reads
// plausibly in Reykjavik, Marrakech, Venice, Göreme, Manly, Monte Carlo and
// on an Antarctic jetty ships the mechanic today. The per-chapter versions are
// authoring, and the shelf is where they belong until somebody wants them.
//
// The paper is what makes it read as GIVEN rather than dropped: a thing in a
// wrapper is a thing somebody was holding.
function physBuildSnack(g) {
  physAdd(g, physBoxG(0.15, 0.075, 0.11), PALETTE.bread, 0, 0.055, 0, 0, 0, 0.06);
  physAdd(g, physBoxG(0.115, 0.045, 0.085), PALETTE.empanada, 0, 0.095, 0.008, 0, 0, 0.04);
  // the twist of paper under it, wider than the bun and turned a few degrees
  physAdd(g, physBoxG(0.19, 0.012, 0.15), PALETTE.petalWhite, 0, 0.016, -0.01, 0, 0.22, 0);
  physAdd(g, physBoxG(0.055, 0.03, 0.05), PALETTE.petalWhite, -0.105, 0.03, -0.035, 0, 0.5, 0.35);
}
function physBuildMaiz(g) {
  physAdd(g, physCylG(0.095, 0.085, 0.42), PALETTE.maiz, 0, 0.1, 0, Math.PI * 0.5, 0, 0);
  physAdd(g, physConeG(0.09, 0.15), PALETTE.maiz, 0, 0.1, 0.27, -Math.PI * 0.5, 0, 0);
  physAdd(g, physBoxG(0.035, 0.035, 0.38), PALETTE.empanada, -0.055, 0.155, 0);
  physAdd(g, physBoxG(0.035, 0.035, 0.38), PALETTE.empanada, 0.02, 0.165, 0);
  physAdd(g, physBoxG(0.035, 0.035, 0.34), PALETTE.bread, 0.075, 0.13, 0);
  physAdd(g, physBoxG(0.13, 0.035, 0.3), PALETTE.coffeeLeaf, 0.08, 0.055, -0.2, 0.3, 0.3, 0);
  physAdd(g, physBoxG(0.13, 0.035, 0.26), PALETTE.paramoPale, -0.08, 0.05, -0.22, -0.25, -0.35, 0);
}
function physBuildPlantain(g) {
  physAdd(g, physCylG(0.05, 0.055, 0.16), PALETTE.coffeeLeaf, 0, 0.12, -0.19, 0.5, 0, 0);
  for (let i = 0; i < 4; i++) {
    const a = -0.45 + i * 0.3;
    physAdd(g, physCylG(0.055, 0.065, 0.34), PALETTE.plantain,
      Math.sin(a) * 0.11, 0.06 + (i & 1) * 0.055, Math.cos(a) * 0.12,
      Math.PI * 0.5 - 0.26, a, 0);
  }
  physAdd(g, physCylG(0.05, 0.06, 0.3), PALETTE.maiz, 0.02, 0.17, 0.02, Math.PI * 0.5 - 0.32, 0.12, 0);
}
function physBuildRuana(g) {
  // Folded wool, four bulky layers of ruana stripes plus a fringe. Heavy and
  // wide on purpose — it drags.
  physAdd(g, physBoxG(0.66, 0.07, 0.5), PALETTE.ruana1, 0, 0.035, 0);
  physAdd(g, physBoxG(0.62, 0.06, 0.46), PALETTE.ruana2, 0.02, 0.095, -0.01, 0, 0.09, 0);
  physAdd(g, physBoxG(0.58, 0.06, 0.42), PALETTE.ruana3, -0.02, 0.15, 0.01, 0, -0.07, 0);
  physAdd(g, physBoxG(0.54, 0.06, 0.36), PALETTE.ruana1, 0.01, 0.2, 0, 0, 0.05, 0);
  physAdd(g, physBoxG(0.56, 0.035, 0.08), PALETTE.ruana3, 0, 0.235, -0.1);
  physAdd(g, physBoxG(0.56, 0.035, 0.08), PALETTE.ruana2, 0, 0.235, 0.09);
  for (let i = 0; i < 5; i++) {
    physAdd(g, physBoxG(0.045, 0.035, 0.13), PALETTE.ruana3, -0.24 + i * 0.12, 0.03, 0.3);
  }
}
function physBuildMug(g) {
  physAdd(g, physCylG(0.16, 0.14, 0.30, 10), PALETTE.cloth6, 0, 0.15, 0);
  physAdd(g, physCylG(0.13, 0.13, 0.03, 10), PALETTE.coffeeLiquid, 0, 0.29, 0);
  physAdd(g, physCylG(0.17, 0.17, 0.035, 10), PALETTE.cloth2, 0, 0.30, 0);
  physAdd(g, physBoxG(0.045, 0.15, 0.045), PALETTE.cloth6, 0.185, 0.17, 0);
  physAdd(g, physBoxG(0.075, 0.045, 0.045), PALETTE.cloth6, 0.155, 0.245, 0);
  physAdd(g, physBoxG(0.075, 0.045, 0.045), PALETTE.cloth6, 0.155, 0.095, 0);
}
/** Breakfast. Beef before eleven, chicken after, and never the other way. */
function physBuildPhobowl(g) {
  physAdd(g, physCylG(0.30, 0.19, 0.16, 12), PALETTE.hanTempleW, 0, 0.08, 0);
  physAdd(g, physCylG(0.27, 0.27, 0.03, 12), PALETTE.hanFruit, 0, 0.145, 0);
  physAdd(g, physCylG(0.20, 0.20, 0.02, 10), PALETTE.hanRice, 0, 0.155, 0);
  physAdd(g, physBoxG(0.10, 0.02, 0.10), PALETTE.hanHerb, 0.06, 0.17, -0.04);
  physAdd(g, physBoxG(0.07, 0.02, 0.07), PALETTE.hanChilli, -0.07, 0.17, 0.05);
  physAdd(g, physBoxG(0.02, 0.02, 0.34), PALETTE.hanTrunk, 0.05, 0.19, 0.02, 0, 0.5, 0.18);
  physAdd(g, physBoxG(0.02, 0.02, 0.34), PALETTE.hanTrunk, 0.09, 0.19, 0.02, 0, 0.5, 0.18);
}
/** Somebody's whole Tuesday, off the back of a bicycle. */
function physBuildFlowers(g) {
  physAdd(g, physCylG(0.05, 0.07, 0.26, 6), PALETTE.hanLeafDk, 0, 0.13, 0);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    physAdd(g, physSphG(0.09), i % 2 ? PALETTE.hanFlow1 : PALETTE.hanFlow4,
            Math.cos(a) * 0.11, 0.30 + (i % 3) * 0.05, Math.sin(a) * 0.11);
  }
  physAdd(g, physBoxG(0.20, 0.02, 0.09), PALETTE.hanLeaf, 0.08, 0.22, 0.06, 0, 0.6, 0.3);
  physAdd(g, physBoxG(0.20, 0.02, 0.09), PALETTE.hanLeaf, -0.08, 0.24, -0.05, 0, -0.7, -0.3);
}
/** A mother-of-pearl casino plaque. Flat, edged, and worth a house. */
function physBuildPlaque(g) {
  physAdd(g, physBoxG(0.26, 0.028, 0.15), PALETTE.monChipW, 0, 0.014, 0);
  physAdd(g, physBoxG(0.27, 0.010, 0.16), PALETTE.monGold, 0, 0.029, 0);
  physAdd(g, physBoxG(0.10, 0.012, 0.062), PALETTE.monChipR, 0, 0.035, 0);
  physAdd(g, physBoxG(0.052, 0.014, 0.030), PALETTE.monGoldDk, 0, 0.040, 0);
}
/** Somebody left it over the back of a lounger. It is a little long in the leg. */
function physBuildDinnerjacket(g) {
  physAdd(g, physBoxG(0.34, 0.10, 0.26), PALETTE.monTux, 0, 0.05, 0);
  physAdd(g, physBoxG(0.12, 0.055, 0.24), PALETTE.monShirt, 0, 0.105, 0.01);
  physAdd(g, physBoxG(0.36, 0.045, 0.10), PALETTE.monTux, 0, 0.115, -0.09, 0.22, 0, 0);
  physAdd(g, physBoxG(0.09, 0.035, 0.09), PALETTE.monTux, -0.14, 0.115, 0.06, 0, 0.4, 0);
  physAdd(g, physBoxG(0.09, 0.035, 0.09), PALETTE.monTux, 0.14, 0.115, 0.06, 0, -0.4, 0);
  physAdd(g, physBoxG(0.055, 0.020, 0.030), PALETTE.monTux, 0, 0.14, 0.09);
}
function physBuildCoffeesack(g) {
  physAdd(g, physCylG(0.3, 0.34, 0.5), PALETTE.potatoSack, 0, 0.25, 0);
  const top = physAdd(g, physSphG(0.3), PALETTE.potatoSack, 0, 0.5, 0);
  top.scale.set(1, 0.55, 1);
  physAdd(g, physCylG(0.13, 0.2, 0.15), PALETTE.potatoSack, 0, 0.66, 0);
  physAdd(g, physCylG(0.155, 0.155, 0.055), PALETTE.wood, 0, 0.62, 0);
  physAdd(g, physBoxG(0.24, 0.16, 0.02), PALETTE.coffeeLeaf, 0, 0.33, 0.3);
  physAdd(g, physSphG(0.07), PALETTE.coffeeCherry, 0, 0.33, 0.32);
}
// ---- FIVE MORE THINGS THAT GO EVERYWHERE (B9, item 4d) --------------------
//
// Same shape as the three that already existed: a flat decal of whatever was
// inside, plus the wreck of the container lying beside it, so the thing on the
// ground still reads as the thing it used to be. Each one replaces the prop's
// geometry in place (physGetSpillGeo) and the body is frozen flat, so they
// cost one geometry each and nothing per frame.
function physBuildChipsSpill(g) {
  physAdd(g, physConeG(0.16, 0.36), PALETTE.cloth6, -0.22, 0.05, 0.04, 0, 0.4, Math.PI * 0.5);
  physAdd(g, physCylG(0.34, 0.3, 0.02), PALETTE.cloth1, 0.1, 0.01, 0.02);
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9;
    physAdd(g, physBoxG(0.05, 0.04, 0.2), i % 2 ? PALETTE.petalYellow : PALETTE.bread,
      0.1 + Math.cos(a) * 0.24, 0.02, 0.02 + Math.sin(a) * 0.2, 0, a * 1.7, 0);
  }
}
function physBuildHandbagSpill(g) {
  // Open, on its side, with the contents in a fan. The clasp is what makes it
  // read as a handbag rather than a heap of cloth.
  physAdd(g, physBoxG(0.34, 0.1, 0.24), PALETTE.cloth5, -0.16, 0.05, 0, 0, 0.3, 0);
  physAdd(g, physBoxG(0.3, 0.03, 0.2), PALETTE.cloth7, -0.1, 0.1, 0.02, 0, 0.3, 0.35);
  physAdd(g, physBoxG(0.07, 0.03, 0.05), PALETTE.petalYellow, -0.02, 0.11, 0.05);
  physAdd(g, physBoxG(0.12, 0.02, 0.09), PALETTE.cloth1, 0.16, 0.01, 0.1, 0, 0.6, 0);
  physAdd(g, physBoxG(0.09, 0.02, 0.07), PALETTE.cloth6, 0.3, 0.01, -0.06, 0, -0.4, 0);
  physAdd(g, physCylG(0.035, 0.035, 0.02), PALETTE.metal, 0.22, 0.01, -0.18);
  physAdd(g, physCylG(0.035, 0.035, 0.02), PALETTE.metal, 0.36, 0.01, 0.12);
}
function physBuildFlowersSpill(g) {
  physAdd(g, physCylG(0.05, 0.06, 0.22, 6), PALETTE.hanLeafDk, -0.2, 0.03, 0, 0, 0, Math.PI * 0.5);
  for (let i = 0; i < 9; i++) {
    const a = i * 0.8;
    physAdd(g, physSphG(0.07), i % 2 ? PALETTE.hanFlow1 : PALETTE.hanFlow4,
      0.08 + Math.cos(a) * 0.26, 0.03, Math.sin(a) * 0.22).scale.set(1, 0.4, 1);
  }
  physAdd(g, physBoxG(0.22, 0.02, 0.1), PALETTE.hanLeaf, 0.02, 0.01, 0.2, 0, 0.9, 0);
  physAdd(g, physBoxG(0.2, 0.02, 0.09), PALETTE.hanLeaf, 0.24, 0.01, -0.16, 0, -0.5, 0);
}
function physBuildPlantainSpill(g) {
  for (let i = 0; i < 4; i++) {
    const a = -0.7 + i * 0.5;
    physAdd(g, physCylG(0.05, 0.06, 0.3), PALETTE.plantain,
      Math.cos(a) * 0.2, 0.04, Math.sin(a) * 0.18, Math.PI * 0.5, a * 1.6, 0);
  }
  physAdd(g, physCylG(0.26, 0.22, 0.02), PALETTE.maiz, 0.02, 0.01, 0.02);
  physAdd(g, physCylG(0.05, 0.055, 0.14), PALETTE.coffeeLeaf, -0.26, 0.03, -0.14,
          Math.PI * 0.5, 0.6, 0);
}
function physBuildMaizSpill(g) {
  physAdd(g, physCylG(0.09, 0.08, 0.38), PALETTE.maiz, -0.08, 0.05, 0.02, Math.PI * 0.5, 0.3, 0);
  physAdd(g, physConeG(0.085, 0.13), PALETTE.maiz, 0.2, 0.05, 0.12, -Math.PI * 0.5, 0, 0);
  for (let i = 0; i < 8; i++) {
    const a = i * 0.86;
    physAdd(g, physBoxG(0.05, 0.03, 0.05), i % 3 ? PALETTE.maiz : PALETTE.empanada,
      0.06 + Math.cos(a) * 0.28, 0.015, Math.sin(a) * 0.24, 0, a, 0);
  }
  physAdd(g, physBoxG(0.13, 0.02, 0.28), PALETTE.coffeeLeaf, -0.26, 0.01, -0.12, 0, 0.5, 0);
}
function physBuildSackBurst(g) {
  physAdd(g, physCylG(0.34, 0.4, 0.26), PALETTE.potatoSack, -0.05, 0.13, 0, 0.2, 0, 0.55);
  physAdd(g, physCylG(0.15, 0.2, 0.1), PALETTE.potatoSack, 0.3, 0.06, 0.1, 0, 0, 1.35);
  physAdd(g, physCylG(0.5, 0.44, 0.03), PALETTE.coffeeLiquid, 0.3, 0.015, 0.12);
  physAdd(g, physCylG(0.26, 0.22, 0.03), PALETTE.coffeeLiquid, -0.24, 0.015, -0.3);
  for (let i = 0; i < 6; i++) {
    const a = i * 1.05;
    physAdd(g, physSphG(0.055), PALETTE.coffeeLiquid,
      0.3 + Math.cos(a) * 0.34, 0.04, 0.12 + Math.sin(a) * 0.3);
  }
}
function physBuildCuencobowl(g) {
  physAdd(g, physCylG(0.11, 0.14, 0.055), PALETTE.churchTrim, 0, 0.027, 0);
  physAdd(g, physCylG(0.3, 0.16, 0.2), PALETTE.churchWhite, 0, 0.15, 0);
  physAdd(g, physCylG(0.31, 0.31, 0.05), PALETTE.awning1, 0, 0.215, 0);
  physAdd(g, physCylG(0.265, 0.265, 0.035), PALETTE.awning3, 0, 0.14, 0);
  physAdd(g, physCylG(0.27, 0.2, 0.04), PALETTE.awning2, 0, 0.235, 0);
}
function physBuildSombrero(g) {
  physAdd(g, physCylG(0.52, 0.5, 0.05), PALETTE.khaki, 0, 0.035, 0);
  physAdd(g, physCylG(0.46, 0.46, 0.04), PALETTE.potatoSack, 0, 0.08, 0);
  physAdd(g, physCylG(0.2, 0.245, 0.22), PALETTE.potatoSack, 0, 0.2, 0);
  physAdd(g, physCylG(0.22, 0.25, 0.065), PALETTE.ruana1, 0, 0.14, 0);
  physAdd(g, physCylG(0.19, 0.2, 0.035), PALETTE.khaki, 0, 0.32, 0);
}

// ---- type table -----------------------------------------------------------
// hy = half height of the collision box; geometry origin is moved there so the
// mesh's origin and the body's centre agree, and the visual base rests on y=0.
const physTYPES = {
  hat:       { name: 'sun hat',      mass: 0.35, hy: 0.14, shape: ['box', 0.34, 0.14, 0.34], hold: [0, 0.04, 0.06],  spin: 1.5, build: physBuildHat },
  coffee:    { name: 'flat white',   mass: 0.5,  hy: 0.17, shape: ['box', 0.12, 0.17, 0.12], hold: [0, 0.02, 0.07],  spin: 1.0, build: physBuildCoffee, spill: physBuildCoffeeSpill },
  sandwich:  { name: 'sandwich',     mass: 0.45, hy: 0.13, shape: ['box', 0.18, 0.13, 0.16], hold: [0, 0.0, 0.06],   spin: 1.2, edible: true, grazeSfx: 'rustle', build: physBuildSandwich },
  ball:      { name: 'beach ball',   mass: 0.22, hy: 0.38, shape: ['sph', 0.38],             hold: [0, 0.06, 0.2],   spin: 2.0, bouncy: true, build: physBuildBall },
  bin:       { name: 'rubbish bin',  mass: 9.0,  hy: 0.56, shape: ['box', 0.4, 0.56, 0.4],   hold: [0, 0.12, 0.42],  spin: 0.4, grabbable: false, receive: true, vessel: { r: 0.62 }, build: physBuildBin },
  deckchair: { name: 'deck chair',   mass: 2.6,  hy: 0.45, shape: ['box', 0.36, 0.45, 0.36], hold: [0, 0.1, 0.34],   spin: 0.7, receive: true, build: physBuildDeckchair },
  flower:    { name: 'prize rose',   mass: 4.5,  hy: 0.4,  shape: ['box', 0.19, 0.4, 0.19],  hold: [0, 0.06, 0.16],  spin: 1.0, planted: true, edible: true, grazeSfx: 'rustle', build: physBuildFlower },
  esky:      { name: 'esky',         mass: 4.2,  hy: 0.26, shape: ['box', 0.37, 0.26, 0.24], hold: [0, 0.08, 0.3],   spin: 0.6, receive: true, vessel: { r: 0.55 }, build: physBuildEsky },
  thong:     { name: 'thong',        mass: 0.12, hy: 0.05, shape: ['box', 0.16, 0.05, 0.07], hold: [0, 0.0, 0.06],   spin: 2.2, build: physBuildThong },
  frisbee:   { name: 'frisbee',      mass: 0.18, hy: 0.05, shape: ['box', 0.3, 0.05, 0.3],   hold: [0, 0.0, 0.1],    spin: 2.6, build: physBuildFrisbee },
  basket:    { name: 'picnic basket',mass: 1.2,  hy: 0.2,  shape: ['box', 0.32, 0.2, 0.32],  hold: [0, 0.06, 0.22],  spin: 0.9, receive: true, vessel: { r: 0.52 }, build: physBuildBasket },
  cone:      { name: 'traffic cone', mass: 4.5,  hy: 0.4,  shape: ['box', 0.28, 0.4, 0.28],  hold: [0, 0.08, 0.24],  spin: 1.1, receive: true, build: physBuildCone },
  handbag:   { name: 'handbag',      mass: 1.0,  hy: 0.2,  shape: ['box', 0.18, 0.2, 0.1],   hold: [0, 0.04, 0.16],  spin: 1.2, build: physBuildHandbag, spill: physBuildHandbagSpill, spillSfx: 'rustle' },
  icecream:  { name: 'ice cream',    mass: 0.3,  hy: 0.3,  shape: ['box', 0.15, 0.3, 0.15],  hold: [0, 0.04, 0.1],   spin: 1.4, edible: true, grazeSfx: 'pop', build: physBuildIcecream, spill: physBuildIcecreamSpill },
  sign:      { name: 'sign',         mass: 3.2,  hy: 0.8,  shape: ['box', 0.46, 0.8, 0.1],   hold: [0, 0.14, 0.5],   spin: 0.5, receive: true, build: physBuildSign },
  towel:     { name: 'beach towel',  mass: 0.5,  hy: 0.12, shape: ['box', 0.46, 0.12, 0.3],  hold: [0, 0.02, 0.14],  spin: 1.0, build: physBuildTowel },
  // B15. Chapter-neutral: systems.js puts one near the spawn from tier 3 and
  // nothing scatters it, so it appears in no chapter's own table.
  poster:    { name: 'wanted poster', mass: 2.2,  hy: 0.7,  shape: ['box', 0.32, 0.7, 0.09],  hold: [0, 0.16, 0.46],  spin: 0.5, receive: true, build: physBuildPoster },

  // THE YUZU (L8, F1). Chapter-neutral, like poster above. `worth` is read
  // only by the currency listener (systems.js) — nothing in props.js itself
  // cares what a prop is worth. `rolling`/`pairId` are set at spawn time
  // (F4, wave 1), not here; the mesh and the pickup are all this pass builds.
  // deliberately NOT edible: that flag runs physGrazeStep (the bite-by-bite
  // held-food mechanic) and the flock's food-seeking — a coin pickup is
  // instant, on capy:grab, not nibbled over three seconds of standing still.
  yuzu:      { name: 'a yuzu',        mass: 0.10, hy: 0.10, shape: ['sph', 0.10],             hold: [0, 0.02, 0.08],  spin: 1.4, build: physBuildYuzu, worth: 1 },
  yuzugold:  { name: 'a golden yuzu', mass: 0.12, hy: 0.12, shape: ['sph', 0.12],             hold: [0, 0.02, 0.09],  spin: 1.4, build: physBuildYuzuGold, worth: 5 },
  yuzubath:  { name: 'the yuzu bath', mass: 40.0, hy: 0.42, shape: ['box', 1.2, 0.42, 1.2],   hold: [0, 0, 0],        spin: 0,   grabbable: false, receive: true, build: physBuildYuzuBath, worth: 25 },
  // THE GENERIC FOOD ROLL (L8, F4) — see physBuildOrange. `edible: true`
  // like the eleven chapter foods, on purpose: a sysDrops-spawned instance is
  // removed on `capy:grab` before physGrazeStep's 0.9 s settle can ever fire
  // a first bite (see the food listener, systems.js), and a chapter that DID
  // hand-place one of these on a table — none do today — would still get the
  // ordinary bite-by-bite verb, which is the right fallback either way.
  orange:    { name: 'an orange',     mass: 0.16, hy: 0.085, shape: ['sph', 0.085],           hold: [0, 0.02, 0.08],  spin: 1.3, edible: true, grazeSfx: 'rustle', build: physBuildOrange },

  // ---- Circular Quay (chapter 1) ----
  // Buoyancy is not authored here. Each type's material density lives in
  // physRHO and physFloatFrac turns it into a draft — see the note there.
  // `shape` and `hy` are re-derived from the baked geometry at bake time
  // (physFitDef), so the numbers below are only a starting guess.
  // `splash` scales the entry sfx / foam / shake on top of the prop's mass.
  chips:      { name: 'hot chips',      mass: 0.3,  hy: 0.22, shape: ['box', 0.17, 0.22, 0.17], hold: [0, 0.02, 0.09], spin: 1.5, edible: true, grazeSfx: 'rustle', build: physBuildChips, spill: physBuildChipsSpill, spillSfx: 'rustle' },
  camera:     { name: 'tourist camera', mass: 1.5,  hy: 0.13, shape: ['box', 0.16, 0.13, 0.11], hold: [0, 0.03, 0.13], spin: 1.0, splash: 1.8, fragile: true, shard: 2, build: physBuildCamera },
  sunglasses: { name: 'sunglasses',     mass: 0.1,  hy: 0.09, shape: ['box', 0.17, 0.09, 0.09], hold: [0, 0.0, 0.07],  spin: 2.4, fragile: true, shard: 2, build: physBuildSunglasses },
  ticket:     { name: 'ferry ticket',   mass: 0.008, hy: 0.09, shape: ['box', 0.17, 0.09, 0.09], hold: [0, 0.0, 0.06],  spin: 2.8, build: physBuildTicket },
  menu:       { name: 'menu board',     mass: 2.6,  hy: 0.5,  shape: ['box', 0.33, 0.5, 0.2],   hold: [0, 0.12, 0.38], spin: 0.6, receive: true, build: physBuildMenu },
  winebottle: { name: 'wine bottle',    mass: 0.9,  hy: 0.3,  shape: ['box', 0.095, 0.3, 0.095],hold: [0, 0.04, 0.11], spin: 1.1, fragile: true, shard: 2, build: physBuildWinebottle },

  // ---- Pasto market (chapter 2) ----
  // `fragile` shatters into pooled shards past physSHATTER_MIN. Pasto has no
  // water, but these props travel now — the market's baskets and bowls turn up
  // in Cappadocia and Marrakech — so they carry a density like everything else.
  empanada:   { name: 'empanada',       mass: 0.28, hy: 0.11, shape: ['box', 0.3, 0.11, 0.19],  hold: [0, 0.01, 0.07], spin: 1.5, edible: true, grazeSfx: 'rustle', build: physBuildEmpanada },
  arepa:      { name: 'arepa',          mass: 0.42, hy: 0.09, shape: ['box', 0.25, 0.09, 0.25], hold: [0, 0.01, 0.08], spin: 1.3, edible: true, grazeSfx: 'rustle', build: physBuildArepa },
  dango:      { name: 'hanami dango',   mass: 0.16, hy: 0.07, shape: ['box', 0.08, 0.07, 0.24], hold: [0, 0.01, 0.09], spin: 1.7, edible: true, grazeSfx: 'pop',    build: physBuildDango },
  maiz:       { name: 'cob of maize',   mass: 0.36, hy: 0.1,  shape: ['box', 0.12, 0.1, 0.28],  hold: [0, 0.01, 0.09], spin: 1.6, edible: true, grazeSfx: 'tick', build: physBuildMaiz, spill: physBuildMaizSpill, spillSfx: 'tick' },
  // See physBuildSnack. Nothing SCATTERS one of these: it exists only because
  // somebody handed it to you, which is what makes it the first gift in the
  // game rather than the eleventh thing on the pavement.
  snack:      { name: 'somebody’s snack', mass: 0.22, hy: 0.09, shape: ['box', 0.16, 0.09, 0.13], hold: [0, 0.01, 0.08], spin: 1.4, edible: true, grazeSfx: 'rustle', build: physBuildSnack },
  plantain:   { name: 'plantains',      mass: 0.9,  hy: 0.11, shape: ['box', 0.2, 0.11, 0.22],  hold: [0, 0.02, 0.12], spin: 1.1, edible: true, grazeSfx: 'rustle', build: physBuildPlantain, spill: physBuildPlantainSpill, spillSfx: 'rustle' },
  ruana:      { name: 'ruana',          mass: 1.3,  hy: 0.13, shape: ['box', 0.34, 0.13, 0.27], hold: [0, 0.05, 0.32], spin: 0.45, receive: true, build: physBuildRuana },
  coffeesack: { name: 'sack of coffee', mass: 18,  hy: 0.34, shape: ['box', 0.3, 0.34, 0.3],   hold: [0, 0.1, 0.42],  spin: 0.35, receive: true, build: physBuildCoffeesack, spill: physBuildSackBurst, spillSfx: 'rustle' },
  cuencobowl: { name: 'painted bowl',   mass: 0.8,  hy: 0.13, shape: ['box', 0.29, 0.13, 0.29], hold: [0, 0.02, 0.12], spin: 1.2, fragile: true, build: physBuildCuencobowl },
  // ---- Antarctica (chapter 17) ----
  mug:        { name: 'enamel mug',     mass: 0.42, hy: 0.16, shape: ['box', 0.2, 0.16, 0.17], hold: [0, 0.02, 0.09], spin: 1.3, fragile: true, build: physBuildMug },
  sombrero:   { name: 'Nariño hat',     mass: 0.4,  hy: 0.16, shape: ['box', 0.46, 0.16, 0.46], hold: [0, 0.04, 0.1],  spin: 1.7, build: physBuildSombrero },

  // ---- Monte Carlo (chapter 18) ----
  // The plaque is the only prop in the game with an ECONOMY behind it: it is
  // carried to the wheel and consumed there for what the pocket says. Light,
  // flat, and it slides — which is most of the joke, because a plaque nudged
  // across a marble floor goes a very long way.
  plaque:     { name: 'a plaque',       mass: 0.06, hy: 0.03, shape: ['box', 0.26, 0.03, 0.15], hold: [0, 0.0, 0.06],  spin: 2.4, build: physBuildPlaque },
  dinnerjacket: { name: 'dinner jacket',mass: 1.1,  hy: 0.13, shape: ['box', 0.36, 0.13, 0.28], hold: [0, 0.05, 0.30], spin: 0.5, receive: true, build: physBuildDinnerjacket },

  // ---- Hanoi (chapter 19) ----
  // A bowl of pho is the largest edible thing in the game and it is meant to
  // be: the task is to get a whole FACE in it.
  phobowl:    { name: 'bowl of pho',    mass: 0.9,  hy: 0.14, shape: ['box', 0.30, 0.14, 0.30], hold: [0, 0.02, 0.11], spin: 1.0, edible: true, grazeSfx: 'splash', fragile: true, build: physBuildPhobowl },
  // ...and a bunch of lotus off the back of somebody's bicycle.
  flowers:    { name: 'bunch of lotus', mass: 0.35, hy: 0.20, shape: ['box', 0.24, 0.20, 0.24], hold: [0, 0.04, 0.14], spin: 1.4, build: physBuildFlowers, spill: physBuildFlowersSpill, spillSfx: 'rustle' },
};

// ===========================================================================
// THE KEEPSAKES — a souvenir you can pick up (v22)
// ===========================================================================
//
// Version eighteen gave the journey a spine: one souvenir per place, drawn as
// a little flat-shaded picture on a shelf in the journal (sysKEEPS in
// systems.js). It is the one thing in this game that crosses a border, and for
// four versions it has crossed it as an ICON. You could look at the hat you
// took off a tourist in Sydney. You could not pick it up.
//
// So each of the seventeen is also a real object now: a prop with a body, a
// mass and a mouth, built out of the same shapes and the SAME PALETTE KEYS as
// the picture on the shelf, so the thing in the journal and the thing in the
// grass are recognisably one object.
//
// TWO THINGS MAKE A KEEPSAKE DIFFERENT FROM EVERY OTHER PROP IN THE GAME:
//
//   1. IT HAS NO BIOME. Every other prop is tagged with the chapter it was
//      born into, and physOnBiomeEnter confiscates a held prop at the border
//      for a good reason — its body leaves the world with its home biome, so a
//      prop released abroad would be dynamic, unsimulated and invisible. A
//      keepsake is added through physSceneAddLoose / physWorldAddLoose (the
//      hatch the particle pools and weather.js already use) and carries
//      `biome: ''`, which three of the four gates in this file already read as
//      "everywhere". It is the only object in the game that genuinely travels.
//   2. IT IS ALWAYS SOLO. An InstancedMesh is created under the live capture
//      tag and is therefore owned by whichever chapter happened to be up when
//      the first one spawned — which is precisely the bug the per-biome
//      instance key was invented to fix. A keepsake draws itself.
//
// The cost of the second one is seventeen draw calls if a player collects all
// seventeen and carries them about, against a budget of 220 and a worst case
// of 122. It is affordable and it is the price of the feature.
//
// The shape language is deliberately tiny — a box or a cylinder, a size, a
// place, a colour and up to three rotations — because seventeen hand-written
// builder functions to make seventeen objects out of three boxes each is how
// this table goes stale. Every colour is the key its own icon already uses.
//
//   ['b', w, h, d,      x, y, z, colour, rx, ry, rz]
//   ['c', rTop, rBot, h, x, y, z, colour, rx, ry, rz]
//   ['s', r, 0, 0,       x, y, z, colour]
//
// Authored with the base on y = 0, like every other builder here; physFitDef
// re-derives `hy` and the collision box from the baked geometry, so the shape
// below each row is a starting guess and not a measurement.
const physKEEPS = {
  /* the wide-brim sun hat, off a tourist who is still looking for it */
  sydney: { name: 'a stolen sun hat', mass: 0.16, parts: [
    ['c', 0.20, 0.20, 0.018, 0, 0.012, 0, 'cloth3'],
    ['c', 0.098, 0.112, 0.10, 0, 0.070, 0, 'cloth3'],
    ['c', 0.116, 0.116, 0.024, 0, 0.036, 0, 'petalRed'] ] },
  /* a primary off the bird that carried you to the crater rim */
  pasto: { name: 'a condor primary', mass: 0.05, parts: [
    ['b', 0.062, 0.010, 0.30, 0, 0.016, 0.02, 'condorWing'],
    ['b', 0.014, 0.014, 0.36, 0, 0.014, 0, 'condorBody'],
    ['b', 0.034, 0.011, 0.07, 0, 0.018, 0.175, 'condorRuff'] ] },
  /* nobody ever punched it. you were not exactly a paying passenger */
  quay: { name: 'an unpunched ferry ticket', mass: 0.02, parts: [
    ['b', 0.20, 0.006, 0.115, 0, 0.004, 0, 'sail'],
    ['b', 0.20, 0.008, 0.028, 0, 0.008, -0.042, 'hullGreen'],
    ['c', 0.016, 0.016, 0.010, -0.072, 0.008, 0.020, 'wharfIron'],
    ['b', 0.088, 0.008, 0.010, 0.020, 0.008, 0.006, 'stoneDark'],
    ['b', 0.062, 0.008, 0.010, 0.007, 0.008, 0.034, 'stoneDark'] ] },
  /* a chasen. eighty tines cut from one piece of bamboo, and you chewed it */
  kyoto: { name: 'a chewed tea whisk', mass: 0.04, parts: [
    ['c', 0.026, 0.028, 0.10, 0, 0.050, 0, 'bambooStem'],
    ['c', 0.034, 0.034, 0.016, 0, 0.104, 0, 'bambooLeaf'],
    ['b', 0.008, 0.10, 0.008, -0.022, 0.164, 0, 'bambooPale', 0, 0, 0.22],
    ['b', 0.008, 0.11, 0.008, -0.008, 0.170, 0.014, 'bambooPale', -0.14, 0, 0.07],
    ['b', 0.008, 0.11, 0.008, 0.009, 0.170, -0.012, 'bambooPale', 0.14, 0, -0.07],
    ['b', 0.008, 0.10, 0.008, 0.022, 0.164, 0, 'bambooPale', 0, 0, -0.22] ] },
  /* a length of cane. it is where the whole city's sugar comes from */
  cali: { name: 'a stick of cane', mass: 0.11, parts: [
    ['c', 0.022, 0.024, 0.34, 0, 0.170, 0, 'caliCane'],
    ['c', 0.027, 0.027, 0.012, 0, 0.075, 0, 'caliCaneStem'],
    ['c', 0.027, 0.027, 0.012, 0, 0.170, 0, 'caliCaneStem'],
    ['c', 0.027, 0.027, 0.012, 0, 0.262, 0, 'caliCaneStem'],
    ['b', 0.11, 0.005, 0.035, 0.062, 0.300, 0.014, 'caliGrass', 0, 0.4, -0.3] ] },
  /* one azulejo. there are two thousand of them and he wanted them all kept */
  rio: { name: 'one of Selarón’s tiles', mass: 0.22, parts: [
    ['b', 0.17, 0.020, 0.17, 0, 0.010, 0, 'rioTileBlue'],
    ['b', 0.115, 0.022, 0.115, 0, 0.021, 0, 'rioTileWhite'],
    ['b', 0.062, 0.024, 0.062, 0, 0.024, 0, 'rioTileYellow', 0, 0.785, 0],
    ['c', 0.021, 0.021, 0.026, 0, 0.026, 0, 'rioTileGreen'] ] },
  /* it will not last the flight and that is rather the point of it */
  iceland: { name: 'a piece of the glacier', mass: 0.30, parts: [
    ['b', 0.17, 0.075, 0.14, 0, 0.038, 0, 'iceGlacierBl'],
    ['b', 0.115, 0.055, 0.10, -0.018, 0.098, -0.014, 'iceGlacier', 0.10, 0.5, 0.06],
    ['b', 0.075, 0.040, 0.070, 0.048, 0.088, 0.030, 'iceGlacierDp', -0.14, 0.9, 0.10] ] },
  /* an orange off the cart, with the mint still in it */
  sahara: { name: 'an orange, with mint', mass: 0.18, parts: [
    ['s', 0.072, 0, 0, 0, 0.072, 0, 'sahOrange'],
    ['c', 0.020, 0.020, 0.008, -0.030, 0.126, -0.028, 'sahSandLit'],
    ['b', 0.012, 0.048, 0.012, 0.006, 0.158, 0, 'sahPalmTrunk'],
    ['b', 0.052, 0.006, 0.022, 0.036, 0.176, 0.006, 'sahMint', 0, 0.3, -0.4] ] },
  /* still trying to leave. it has been trying to leave the whole way */
  drift: { name: 'a seed that never landed', mass: 0.01, parts: [
    ['c', 0.005, 0.006, 0.17, 0, 0.085, 0, 'driSeed'],
    ['s', 0.019, 0, 0, 0, 0.180, 0, 'driSeed'],
    ['b', 0.006, 0.006, 0.10, -0.030, 0.212, 0.006, 'driPaper', 0.5, 0.4, 0],
    ['b', 0.006, 0.006, 0.10, 0.028, 0.214, -0.010, 'driPaper', -0.5, -0.5, 0],
    ['b', 0.006, 0.006, 0.10, 0.004, 0.222, 0.032, 'driPaper', 0.55, 1.5, 0],
    ['b', 0.006, 0.006, 0.10, -0.008, 0.216, -0.032, 'driPaper', -0.55, 2.4, 0] ] },
  /* off one of the hundred and forty that went up off the Piazzetta */
  venice: { name: 'a pigeon’s feather', mass: 0.01, parts: [
    ['b', 0.040, 0.007, 0.20, 0, 0.012, 0.012, 'venPigeon'],
    ['b', 0.010, 0.010, 0.24, 0, 0.010, 0, 'venPigeonDk'],
    ['b', 0.022, 0.008, 0.045, 0, 0.013, 0.115, 'venStone'] ] },
  /* a grass. they build forty storeys out of it and lash every joint by hand */
  kowloon: { name: 'a length of scaffold', mass: 0.26, parts: [
    ['c', 0.027, 0.029, 0.36, 0, 0.180, 0, 'hkBamboo'],
    ['c', 0.032, 0.032, 0.014, 0, 0.084, 0, 'hkBambooDk'],
    ['c', 0.032, 0.032, 0.014, 0, 0.276, 0, 'hkBambooDk'],
    ['c', 0.035, 0.035, 0.032, 0, 0.150, 0, 'hkLash'],
    ['c', 0.034, 0.034, 0.016, 0, 0.198, 0, 'hkLash'] ] },
  /* it was already open when you got there. that is the story you are keeping */
  palawan: { name: 'a shell, with a pearl in it', mass: 0.20, parts: [
    ['c', 0.115, 0.098, 0.028, 0, 0.014, 0, 'palClamLip'],
    ['c', 0.086, 0.096, 0.016, 0, 0.034, 0, 'palClamLip'],
    ['s', 0.042, 0, 0, 0, 0.062, 0, 'palPearl'],
    ['c', 0.014, 0.014, 0.008, -0.020, 0.098, -0.018, 'foam'] ] },
  /* a hand-width of envelope, off the one you chewed the tether of */
  goreme: { name: 'a scrap of envelope', mass: 0.06, parts: [
    ['b', 0.085, 0.010, 0.19, -0.045, 0.012, 0, 'gorEnvA', 0, 0, 0.10],
    ['b', 0.085, 0.010, 0.19, 0.045, 0.016, 0.004, 'gorEnvC', 0, 0, -0.10],
    ['b', 0.16, 0.010, 0.045, 0, 0.026, -0.082, 'gorEnvE', 0.35, 0, 0] ] },
  /* council planted them in 1953 and you brought one down */
  manly: { name: 'a Norfolk pine cone', mass: 0.14, parts: [
    ['c', 0.052, 0.068, 0.070, 0, 0.038, 0, 'manPine'],
    ['c', 0.068, 0.052, 0.075, 0, 0.110, 0, 'manPine'],
    ['c', 0.072, 0.072, 0.014, 0, 0.062, 0, 'manPineLt'],
    ['c', 0.062, 0.062, 0.012, 0, 0.112, 0, 'manPineLt'],
    ['b', 0.016, 0.030, 0.016, 0, 0.160, 0, 'manTrunk'] ] },
  /* the flood is made of these. so, mostly, is the chapter */
  pantanal: { name: 'a water hyacinth', mass: 0.09, parts: [
    ['b', 0.10, 0.010, 0.13, -0.052, 0.010, 0, 'panHyacinth', 0, -0.4, 0.16],
    ['b', 0.10, 0.010, 0.13, 0.052, 0.010, 0.008, 'panHyacinth', 0, 0.4, -0.16],
    ['c', 0.010, 0.012, 0.09, 0, 0.056, 0, 'panGrassDk'],
    ['c', 0.046, 0.030, 0.036, 0, 0.118, 0, 'panHyaFlower'],
    ['c', 0.015, 0.015, 0.012, 0, 0.140, 0, 'panLilyRim'] ] },
  /* one drip at a time, turning over, for about the age of the species */
  cave: { name: 'a cave pearl', mass: 0.24, parts: [
    ['c', 0.098, 0.108, 0.024, 0, 0.012, 0, 'cavRockDk'],
    ['c', 0.072, 0.086, 0.018, 0, 0.032, 0, 'cavRock'],
    ['s', 0.050, 0, 0, 0, 0.070, 0, 'cavPearl'],
    ['c', 0.016, 0.016, 0.008, -0.024, 0.104, -0.020, 'cavCalciteLt'] ] },
  /* the paint is what everybody photographs. this is a bit of the paint */
  antarctic: { name: 'a board off the hut', mass: 0.19, parts: [
    ['b', 0.15, 0.018, 0.20, 0, 0.009, 0, 'antHutRed'],
    ['b', 0.16, 0.010, 0.030, 0, 0.022, -0.078, 'foam'],
    ['b', 0.030, 0.012, 0.088, 0.046, 0.024, 0.030, 'antHutRed'],
    ['b', 0.052, 0.012, 0.030, 0.033, 0.024, -0.014, 'antHutRed'],
    ['c', 0.014, 0.014, 0.012, -0.048, 0.024, 0.038, 'antIce'] ] },
  /* they are made of nacre, they are worth a house, and nobody counts them */
  monaco: { name: 'a mother-of-pearl plaque', mass: 0.07, parts: [
    ['b', 0.13, 0.014, 0.075, 0, 0.007, 0, 'monChipW'],
    ['b', 0.135, 0.005, 0.080, 0, 0.015, 0, 'monGold'],
    ['b', 0.050, 0.006, 0.031, 0, 0.019, 0, 'monChipR'],
    ['b', 0.026, 0.007, 0.015, 0, 0.022, 0, 'monGoldDk'],
    ['c', 0.010, 0.010, 0.006, 0.048, 0.020, 0.026, 'monBrass'] ] },
  /* four thousand dong a glass, twenty centimetres off the pavement, and the
     back left leg has gone at some point and been sat on anyway */
  hanoi: { name: 'a cracked plastic stool', mass: 0.10, parts: [
    ['b', 0.15, 0.018, 0.15, 0, 0.095, 0, 'hanStoolA'],
    ['b', 0.016, 0.095, 0.016, 0.058, 0.048, 0.058, 'hanStoolA'],
    ['b', 0.016, 0.095, 0.016, -0.058, 0.048, 0.058, 'hanStoolA'],
    ['b', 0.016, 0.095, 0.016, 0.058, 0.048, -0.058, 'hanStoolA'],
    ['b', 0.016, 0.080, 0.016, -0.058, 0.040, -0.058, 'hanStoolB', 0, 0, 0.18],
    ['b', 0.13, 0.014, 0.014, 0, 0.050, 0.062, 'hanStoolA'] ] },
};

/** The one builder the seventeen share. See the note on physKEEPS. */
function physBuildKeep(g, parts) {
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const col = PALETTE[p[7]];
    const geo = p[0] === 'b' ? physBoxG(p[1], p[2], p[3])
              : p[0] === 's' ? physSphG(p[1])
                             : physCylG(p[1], p[2], p[3]);
    physAdd(g, geo, col === undefined ? PALETTE.stone : col,
            p[4], p[5], p[6], p[8] || 0, p[9] || 0, p[10] || 0);
  }
}

// One prop type per keepsake, generated rather than written out: the table
// above IS the seventeen definitions and a second hand-maintained list of the
// same seventeen names is a list that goes stale. `keep-<place>` because the
// type string is also the geometry cache key and the instance group key, and
// neither may collide with a real prop type.
for (const physKeepK in physKEEPS) {
  const K = physKEEPS[physKeepK];
  physTYPES['keep-' + physKeepK] = {
    name: K.name, mass: K.mass, hy: 0.10,
    shape: ['box', 0.12, 0.10, 0.12],
    hold: [0, 0.01, 0.075], spin: 1.6,
    keep: physKeepK,
    build: (function (parts) { return function (g) { physBuildKeep(g, parts); }; })(K.parts),
  };
}

/** Displaced volume of a type's collision shape, in m³. Cached on the def. */
function physVolume(def) {
  if (def.volume) return def.volume;
  const s = def.shape;
  const v = s[0] === 'sph' ? 4.18879 * s[1] * s[1] * s[1] : 8 * s[1] * s[2] * s[3];
  def.volume = v > 1e-4 ? v : 1e-4;
  return def.volume;
}

// ---- WHAT THE THING IS MADE OF --------------------------------------------
// Mean density of the real object in kg/m³, air pockets and all: a sealed
// wheelie bin is mostly air, a camera is glass and magnesium, a beach ball is
// a skin around nothing. This is the ONE physical fact each prop needs to
// behave in water, and it replaces the old `float:` dial, which was a hand-set
// submerged fraction with no reasoning behind it and no way to be wrong.
//
// Everything at or above physFLUID_RHO sinks, because that is what denser than
// water means. Before this table only the tourist's camera could sink: a full
// wine bottle, a glazed bowl, a potted plant and a pair of sunglasses all
// bobbed, because their `float` was simply never set and the default was 0.55.
//
// The masses in physTYPES stay as they are — they are tuned for how a prop
// feels in the mouth and against a shoulder-charge, and the collision boxes are
// deliberately larger than life so a prop reads at a distance. Which means
// mass/volume is NOT the density of the depicted object, and the solver must
// not pretend it is. physFloatFrac turns the number below into a draft, and
// physMakeProp's back-solve makes the lift come out at the prop's own weight —
// so the equilibrium waterline is honest even though the displacement box is not.
const physFLUID_RHO = 1000;      // kg/m³, fresh water; the sea is 1025 and it does not matter here
const physRHO = {
  ball:       12,    // a skin around air
  flowers:    260,   // stems, air and seven lotus heads
  phobowl:    980,   // a litre of broth in a ceramic bowl. It goes straight down.
  dinnerjacket: 250,  // dry wool, loosely folded
  plaque:     1250,  // nacre and resin. It sinks, and it is worth a house.
  hat:        70,    // straw, open crown
  sombrero:   90,
  bin:        90,    // sealed HDPE, empty
  esky:      110,
  thong:     160,    // EVA foam
  basket:    180,    // open wicker
  towel:     220,    // dry cotton terry
  ruana:     300,    // dry wool
  maiz:      320,    // cob in the husk
  sandwich:  350,
  icecream:  380,    // aerated, on a wafer
  chips:     480,
  deckchair: 480,    // timber and canvas
  sign:      560,
  empanada:  620,
  cuencobowl:620,    // glazed, hollow, sitting upright — it floats until it swamps
  coffeesack:680,    // jute over green beans, with air between them
  menu:      700,
  ticket:    700,    // paper card
  cone:      720,    // PVC cone on a rubber base
  handbag:   880,
  arepa:     900,
  dango:     980,    // three rice-flour rounds on a bamboo skewer; it sinks
  // ...and this one FLOATS, which is the trap ROADMAP-FUN names for it. Eight
  // of the ten chapters it exists for have water in them, and a gift that goes
  // straight to the bottom of the lagoon the moment it is thrown to a swimming
  // capybara is a gift that reads as a bug. Bread and air, in paper.
  snack:     420,
  frisbee:   930,    // polyethylene, and it floats by a whisker — as it does
  coffee:    930,    // a full cup floats brim-deep, then fills
  plantain:  970,
  // ---- and everything from here down goes to the bottom ----
  sunglasses:1150,   // acetate and glass
  winebottle:1180,   // full, corked
  flower:    1450,   // terracotta and wet soil
  camera:    1500,   // glass and magnesium
  mug:       1600,   // enamel over pressed steel — it goes straight down
};

for (const k in physRHO) { if (physTYPES[k]) physTYPES[k].rho = physRHO[k]; }

// ---- WHAT THE THING SOUNDS LIKE -------------------------------------------
// Thirty-eight prop types and every single one of them went 'thud'. A straw
// hat, an enamel mug, a wine bottle, a glazed bowl, a jute sack of green
// coffee, a beach ball and a wheelie bin were, acoustically, the same object at
// slightly different volumes — and knocking things over is not A verb in this
// game, it is THE verb. The one channel that could have told you what you had
// just hit was reporting the same syllable a hundred and forty times an hour.
//
// This is the same shape as physRHO above and for the same reason: one physical
// fact per material, applied by a table rather than by a switch at the call
// site. `sfx` names an existing voice, `pitch` and `gain` shape it, and both
// are multiplied ON TOP of the speed-derived figures systems.js already
// computes — so a hard hit is still louder and lower than a soft one, it is
// just now also made of something.
const physVOICE = {
  soft:    { key: 'soft',    sfx: 'thud',   pitch: 0.80, gain: 0.55 },  // cloth, foam, fruit, bread
  straw:   { key: 'straw',   sfx: 'rustle', pitch: 0.95, gain: 0.80 },  // woven: hats, baskets, jute
  paper:   { key: 'paper',   sfx: 'rustle', pitch: 1.60, gain: 0.35 },  // a ticket, a menu card
  timber:  { key: 'timber',  sfx: 'thud',   pitch: 1.20, gain: 0.85 },  // a deck chair, a sign
  plastic: { key: 'plastic', sfx: 'pop',    pitch: 0.65, gain: 0.85 },  // a cone, a frisbee, a thong
  hollow:  { key: 'hollow',  sfx: 'thud',   pitch: 1.70, gain: 1.00 },  // a sealed bin, an esky: a drum
  ceramic: { key: 'ceramic', sfx: 'clink',  pitch: 1.00, gain: 0.90 },
  glass:   { key: 'glass',   sfx: 'clink',  pitch: 1.30, gain: 0.85 },
  metal:   { key: 'metal',   sfx: 'clink',  pitch: 0.70, gain: 1.00 },
};
const physMAT = {
  hat: 'straw', sombrero: 'straw', basket: 'straw', coffeesack: 'straw', ruana: 'soft',
  towel: 'soft', thong: 'plastic', ball: 'plastic', frisbee: 'plastic', cone: 'plastic',
  bin: 'hollow', esky: 'hollow',
  deckchair: 'timber', sign: 'timber', menu: 'timber', flower: 'ceramic',
  sandwich: 'soft', icecream: 'soft', chips: 'soft', empanada: 'soft', arepa: 'soft',
  maiz: 'soft', plantain: 'soft', handbag: 'soft', dango: 'soft',
  ticket: 'paper',
  coffee: 'paper',            // a takeaway cup, and it is the joke that it is
  cuencobowl: 'ceramic', mug: 'metal', winebottle: 'glass', sunglasses: 'glass',
  camera: 'metal',
};
/**
 * The voice for a type. A type with no row falls back on its DENSITY, which is
 * the one physical fact every prop already has — so a thirty-ninth prop added
 * to physTYPES tomorrow gets a plausible material rather than silently
 * rejoining the thuds. There is no list here that can go stale.
 */
// ---- AND WHAT IT LOOKS LIKE WHEN IT LANDS ---------------------------------
// A rigid body in a low-poly comedy is the one place squash-and-stretch is
// almost free and almost always missing. Thirty-eight prop types hit the
// paving at nine metres a second and every one of them stayed a perfect,
// unmoved box. It is render only — mesh.scale, which the instance writer now
// reads all three components of — and it is a spring, so it recovers rather
// than steps.
//
// The amount is scaled by the material's OWN give: a straw hat and a beach
// ball deform, an enamel mug does not, and that is exactly the physRHO/physMAT
// distinction again rather than a new dial.
// MEASURED, AND THE FIRST NUMBERS WERE WRONG. At k = 210 / c = 29 the spring's
// time constant is 69 ms — four frames at 60 Hz — so the discrete integrator
// clipped the peak before it arrived: a towel dropped from six metres squashed
// by 0.035 where 0.20 was intended, which is a third of a pixel on screen. At
// k = 90 the constant is 105 ms, the peak survives the stepping, and the whole
// gesture reads over about a quarter of a second, which is how long a bin
// actually takes to stop wobbling.
const physSQ_K     = 90;     // spring, rad^2/s^2
const physSQ_C     = 19;     // ...critically damped: c ~= 2*sqrt(k)
const physSQ_KICK  = 46;    // 1/s — turns a squash fraction into a spring velocity
const physSQ_POP_LAM = 14;   // the grab-pop's recovery, unchanged from where it used to live
const physSQ_MAX   = 0.30;   // hard cap on the flatten, as a fraction
const physSQ_SPEED = 22;     // m/s of impact that would reach the cap
const physSQ_GIVE  = { soft: 1.0, straw: 0.8, paper: 1.0, plastic: 0.55,
                       hollow: 0.4, timber: 0.22, ceramic: 0.10, glass: 0.08, metal: 0.06 };

/** Kick a prop's squash spring. `speed` is the impact along the normal. */
// ===========================================================================
// THE HIT FLASH (P7)
//
// A prop hitting something got a squash, a thud and a camera tap, and the
// squash is 8% of a scale on a box six metres away. The one thing that reads
// at that distance is VALUE, and nothing about an impact changed the value of
// anything.
//
// It is a MATERIAL SWAP, not an emissive write, and that is forced: `mat()`
// caches one material per colour, so every crate in the chapter shares one,
// and writing emissive on it would flash all of them. One shared flash
// material, swapped in and swapped back — the prop loses its own colour for
// sixty milliseconds, which at sixty milliseconds is exactly what a flash is.
//
// SIXTY MILLISECONDS IS THREE FRAMES AT SIXTY HERTZ and two at thirty, which
// is the floor: one frame is a dropped-frame artefact rather than a flash.
// The clock is wall time, not frames, so it is the same length everywhere.
const physFLASH_MS = 60;
const physFLASH_MIN = 3.2;      // m/s — a bump that is worth marking
let physFlashMat = null;
const physFlashing = [];        // props mid-flash; almost always 0 or 1 long
function physFlashMaterial() {
  if (!physFlashMat) {
    // Near-white rather than white, and emissive rather than merely bright:
    // a Lambert at full white still takes the sun's angle, so a crate hit on
    // its shaded side would flash darker than one hit in the light.
    physFlashMat = new THREE.MeshLambertMaterial({
      color: PALETTE.sail, emissive: PALETTE.sail, emissiveIntensity: 0.85,
      flatShading: true,
    });
  }
  return physFlashMat;
}
function physFlash(prop, speed) {
  if (!prop || !prop.mesh || speed < physFLASH_MIN) return;
  const m = prop.mesh;
  // An InstancedMesh shares one material across every instance of it, so a
  // swap there flashes the whole flock. Skip them: they are the scenery
  // props, and the ones the player throws are not instanced.
  if (m.isInstancedMesh || Array.isArray(m.material)) return;
  if (prop.flashT > 0) { prop.flashT = physFLASH_MS; return; }
  prop.flashWas = m.material;
  prop.flashT = physFLASH_MS;
  m.material = physFlashMaterial();
  physFlashing.push(prop);
}
/** Wall-clock, so a flash is the same length at 30 fps and at 144. */
function physFlashStep(dtMs) {
  for (let i = physFlashing.length - 1; i >= 0; i--) {
    const p = physFlashing[i];
    p.flashT -= dtMs;
    if (p.flashT > 0) continue;
    p.flashT = 0;
    // ...and put back what was THERE, not what the type says it should be:
    // a prop may have been wetted, stained or shaded since it was built.
    if (p.mesh && p.flashWas) p.mesh.material = p.flashWas;
    p.flashWas = null;
    physFlashing.splice(i, 1);
  }
}

function physSquashHit(prop, speed) {
  const def = physTYPES[prop.type];
  if (!def) return;
  const v = physVoiceOf(def, prop.type);
  const give = (v && physSQ_GIVE[v.key]) || 0.35;
  const a = clamp(speed / physSQ_SPEED, 0, 1) * physSQ_MAX * give;
  if (a < 0.012) return;
  // Add to the velocity, never to the position: two hits in quick succession
  // then read as one harder hit rather than as a scale that steps.
  prop.sqV = (prop.sqV || 0) - a * physSQ_KICK;
}

/**
 * Advance one prop's squash. Flatten on the prop's own Y and bulge on X and Z
 * to keep the volume roughly honest, which is the whole reason the eye reads it
 * as a solid thing hitting something rather than as a sprite being scaled.
 */
function physSquashStep(prop, dt) {
  let s = prop.sq || 0, v = prop.sqV || 0;
  let pop = prop.pop === undefined ? 1 : prop.pop;
  if (s === 0 && v === 0 && pop === 1) return false;
  if (s !== 0 || v !== 0) {
    v += (-physSQ_K * s - physSQ_C * v) * dt;
    s += v * dt;
    if (s < -physSQ_MAX) { s = -physSQ_MAX; if (v < 0) v = 0; }
    if (s > physSQ_MAX * 0.5) { s = physSQ_MAX * 0.5; if (v > 0) v = 0; }
    if (Math.abs(s) < 0.003 && Math.abs(v) < 0.03) { s = 0; v = 0; }
    prop.sq = s; prop.sqV = v;
  }
  // ---- THE POP AND THE SQUASH ARE ONE WRITE, NOT TWO --------------------
  // A grabbed prop is popped to 1.18 and eased back to 1, and that easing used
  // to live in its own block immediately after this one — reading scale.x and
  // writing all three components UNIFORMLY. Which meant it ran a frame after
  // the squash had written a non-uniform scale, read the flattened x, and
  // rewrote the whole thing as a uniform pulse: measured, a bin that should
  // have squashed to (0.955, 1.089, 0.955) was drawn at (1.018, 1.018, 1.018)
  // — the squash turned into the prop briefly getting bigger. There is exactly
  // one writer of prop.mesh.scale in the free path now, and it is this line.
  if (pop !== 1) {
    pop = damp(pop, 1, physSQ_POP_LAM, dt);
    if (Math.abs(pop - 1) < 0.004) pop = 1;
    prop.pop = pop;
  }
  const bulge = (1 - s * 0.5) * pop;
  prop.mesh.scale.set(bulge, (1 + s) * pop, bulge);
  return true;
}

/** Put a prop back to a perfect box, now. Used before a settled prop's last sync. */
function physSquashClear(prop) {
  if (!prop.sq && !prop.sqV && (prop.pop === undefined || prop.pop === 1)) return;
  prop.sq = 0; prop.sqV = 0; prop.pop = 1;
  prop.mesh.scale.set(1, 1, 1);
}

function physStampVoice(prop) {
  const def = physTYPES[prop.type];
  const v = def ? physVoiceOf(def, prop.type) : null;
  physImpactPayload.voice = v ? v.sfx : 'thud';
  physImpactPayload.vpitch = v ? v.pitch : 1;
  physImpactPayload.vgain = v ? v.gain : 1;
  // One payload object is shared by four emit sites, so a flag set at one of
  // them is still set at the next three. Cleared here because every site
  // stamps a voice, and physSpill sets it back to true after this call.
  physImpactPayload.spill = false;
}
function physVoiceOf(def, type) {
  if (def.voice) return def.voice;
  let v = physVOICE[physMAT[type]];
  if (!v) {
    const rho = def.rho || 600;
    v = rho < 200 ? physVOICE.soft
      : rho < 520 ? physVOICE.straw
      : rho < 1000 ? physVOICE.timber
      : physVOICE.ceramic;
  }
  def.voice = v;
  return v;
}

/**
 * Submerged fraction a type ACTUALLY settles at, from its material density.
 * The water mesh is opaque, so a prop that is meant to float has to keep
 * physBUOY_PROUD metres of itself above the surface or it simply vanishes;
 * equilibrium leaves 2*hy*(1 - floatFrac) proud, hence the cap. A value over 1
 * is passed through untouched — that is a prop denser than water, and it sinks.
 */
function physFloatFrac(def) {
  if (def.floatFrac) return def.floatFrac;
  const rho = def.rho || (def.float ? def.float * physFLUID_RHO : physFLOAT_DEFAULT * physFLUID_RHO);
  const f = rho / physFLUID_RHO;
  let v = f;
  if (f <= 1) {
    const cap = 1 - physBUOY_PROUD / (2 * def.hy);
    v = clamp(f, 0.05, cap > 0.05 ? cap : 0.05);
  }
  def.floatFrac = v;
  return v;
}

const physFLOWER_PETALS = [PALETTE.petalRed, PALETTE.petalPink, PALETTE.petalPurple];

function physGetGeo(type, variant) {
  const key = variant ? type + '#' + variant : type;
  let g = physGeoCache.get(key);
  if (g) return g;
  const def = physTYPES[type];
  const root = new THREE.Group();
  if (type === 'flower') def.build(root, physFLOWER_PETALS[(variant || 0) % physFLOWER_PETALS.length]);
  else def.build(root);
  g = physFlatten(root, def.hy, def);
  physGeoCache.set(key, g);
  return g;
}
function physGetSpillGeo(type) {
  const def = physTYPES[type];
  if (!def || !def.spill) return null;
  const key = type + '@spill';
  let g = physGeoCache.get(key);
  if (g) return g;
  const root = new THREE.Group();
  def.spill(root);
  g = physFlatten(root, def.hy);
  physGeoCache.set(key, g);
  return g;
}

// ===========================================================================
// 3. PROPS
// ===========================================================================
export function createProps(game) {
  physGame = game;
  // ---- A PROP IS WET TOO ---------------------------------------------------
  // The weather pass puts a mirror on the road and left everything standing on
  // it bone dry. `wetOnly` is the wet half of grain() with none of the
  // world-space noise (which is scaled for a road and reads as dirt on a
  // half-metre object) and none of the sparkle (which is only ever for a sea).
  // The term is gated on which way a face points, so the top of a bin takes the
  // rain and its sides do not, for free and with no per-mesh flag.
  // This is ONE material for every instanced prop in the game, so all thirty-one
  // types in all seventeen chapters cost exactly one extra shader compile. It is
  // keyed off shine() — wetness above the chapter's own baseline — so a chapter
  // authored wet is not re-graded, and a dry frame pays one uniform read.
  physPropMat = grain(mat(physNEUTRAL, { vertexColors: true }), { wetOnly: true });

  // The pools are built BEFORE anything can fire one, and deliberately outside
  // any biome — see physSceneAddLoose. physInitPuff/physInitShards used to live
  // in physOnBiomeEnter's `pasto` branch, which is both a capture and a chapter
  // nobody has visited yet on frame 1.
  physInitParticles();
  physInitPuff();
  physInitShards();
  physInitRubbish();
  physScatter();

  game.events.on('capy:dig', physOnDig);
  // A hard landing throws up whatever it lands on. capybara.js only fires this
  // past 5.5 m/s of descent, so a walk off a kerb costs nothing.
  game.events.on('capy:land', function (e) {
    // D4: the event now fires on EVERY landing so the lens can answer it, and
    // the old `fall > 5.5` gate came with it on the payload. A walk off a kerb
    // still costs nothing.
    if (e && e.dust === false) return;
    const p = e && e.position;
    // ...and how MUCH of it is how hard it was. Six particles for every
    // landing meant a step off a crate and a forty-metre arrival threw the
    // same cloud, which is the same flatness the landing ring fixes above
    // the ground. `fall` is on the payload; older senders may not carry it.
    const v = (e && e.fall) || 6;
    if (p) physDust3(p.x, p.y - 0.30, p.z, Math.round(clamp(4 + v * 0.7, 4, 16)));
  });
  // ...and a run kicks up a scuff behind every other stride. One particle, so a
  // sustained sprint costs a couple of matrix writes a second and nothing else.
  game.events.on('capy:step', function (e) {
    const p = e && e.position;
    if (p) physDust3(p.x, p.y - 0.28, p.z, 1);
  });
  // Chapter 2. Nothing Andean exists until the biome is first entered, and the
  // capture tag is already 'pasto' by the time this event fires, so everything
  // built inside belongs to Pasto rather than to Sydney.
  game.events.on('biome:enter', physOnBiomeEnter);
  // The signature verb drew a ring on the ground and shook the camera and could
  // not move a tin mug. See physOnWheek.
  game.events.on('capy:wheek', physOnWheek);

  game.physics = {
    grab: physGrab,
    release: physRelease,
    nearestGrabbable: physNearestGrabbable,
    spawnProp: physSpawnProp,
    spawnKeep: physSpawnKeep,
    stageKeep: physStageKeep,
    keepOut: physKeepOut,
    flash: physFlash,          // the coda flashes each keepsake as its note sounds (L4, F4)
    removeProp: physRemoveProp,
    update: physUpdate,
    // extras (handy for npc.js / systems.js — additive, nothing depends on them)
    dropOwned: physDropOwned,
    // Put a prop back where it lives, dead still and asleep, with all three of
    // cannon's position fields written. npc.js calls it when somebody catches up
    // with a thing you took off them: it is the one function in this file that
    // already treats homeX/Y/Z as authoritative, so "they put it back" and "the
    // world put it back" are the same code path and cannot drift apart.
    rescue: physRescue,
    // The prop TYPE table, read-only in practice. qa asks it which props are
    // edible; guessing that from the type name is how an audit reports a
    // chapter has no food in it because the food is called `pylsa`.
    typeOf: function (t) { return physTYPES[t] || null; },
    // item 5: the one thing you brought with you. See physTravelThrough.
    travelAudit: physTravelAudit,
    // ---- the thrown hit (the lift pass) ----
    // The window on physPersonHit's four gates. Read-only, and a harness hook
    // rather than a verb — there is deliberately no `forceHit` beside it,
    // because a hit that did not come out of a real launch impulse is exactly
    // the thing the rule exists to refuse.
    hitAudit: physHitAudit,
    // ---- the getaway (M7) ----
    // The verb, for the theft rows this file does not own. Arming is safe from
    // anywhere and is deliberately the ONLY surface: there is no `forceGetaway`
    // and no disarm, because the whole safety argument is that nothing outside
    // physGetawayStep may ever take a row back off the list.
    armTheft: physArmTheft,
    getawayAudit: physGetawayAudit,
    // ...and the verb itself. systems.js is the only caller: see biomeGo,
    // and the note there on why the decision cannot be taken on this side.
    travelThrough: physTravelThrough,
    spill: physSpill,
    // ---- B9: a thing inside a thing (item 4a) ----
    // capybara.js asks `vesselNear` on the frame the action key goes down, to
    // decide whether the press is a throw or the start of a put-down, and
    // `putIn` when the hold completes. Nothing else in the game calls either.
    vesselNear: physVesselNear,
    putIn: physPutIn,
    // ---- B10: where a throw lands (item 4b) ----
    // capybara.js owns the launch vector; this file owns the drag and the
    // gravity. One caller, on the frames a charge is being held.
    predictLanding: physPredictLanding,
    dust: physDust3,
    // ---- THINGS THAT HANG (D7) ----
    // Published on `game` as well (below), because a chapter calls it at build
    // time and game.physics is the long way round for one verb — the same
    // argument addCrowdBodies made.
    hang: physHang,
    hangRemove: physHangRemove,
    hangAudit: physHangAudit,
    foam: physFoamRing,
    // A CROWD YOU CANNOT WALK THROUGH. See the block above physAddCrowdBodies
    // for the two shapes it takes and the four things that are easy to get
    // wrong. Published on `game` as well (main.js), because a chapter calls it
    // at build time and `game.physics` is the long way round for one verb.
    addCrowdBodies: physAddCrowdBodies,
    // ---- Pasto (chapter 2) ----
    collapseStall: physCollapseStallByRef,
    shatter: physShatter,
    puff: physPuff3,
    scatterShards: physThrowShards,
    // ---- THINGS THAT TURN UP (L8, F4) ----
    // A validated random ground point, biome by biome — see the doc comment
    // above physDropSpot. sysDrops (systems.js) is the only caller.
    dropSpot: physDropSpot,
    dropSpotNear: physDropSpotNear,
  };

  return { update: physUpdate };
}

// ---- instanced draw pool --------------------------------------------------
// One InstancedMesh per baked geometry. A prop only falls back to its own
// standalone Mesh while it is in the capybara's mouth, in an NPC's hand, or
// spilled (its geometry swaps). Everything else is one draw call per type.
function physScatterCount(type) {
  let n = 0;
  for (let i = 0; i < physSCATTER.length; i++) if (physSCATTER[i][1] === type) n += physSCATTER[i][2];
  for (let i = 0; i < physQUAY_SCATTER.length; i++) if (physQUAY_SCATTER[i][0] === type) n += physQUAY_SCATTER[i][1];
  for (const k in physBIOME_SCATTER) {
    const rows = physBIOME_SCATTER[k].props;
    for (let i = 0; i < rows.length; i++) if (rows[i][0] === type) n += rows[i][1];
  }
  return n;
}

/**
 * One InstancedMesh per (baked geometry x BIOME).
 *
 * The biome half is not an optimisation, it is correctness. main.js claims
 * whatever is added to the scene while a capture tag is live, so the first
 * prop of a type decides which biome owns the shared draw call for ever. Key
 * this on the geometry alone and a rubbish bin scattered in Venice joins
 * Sydney's bin mesh — which Venice has set invisible — so the body is there,
 * solid and grabbable, and nothing is drawn. Splitting on the biome gives each
 * chapter its own mesh, built under its own tag, shown and hidden with it.
 */
function physInstGroupFor(type, key, geo, receive) {
  let g = physInstByKey.get(key);
  if (g) return g;
  const cap = physScatterCount(type) + 12;
  const imesh = new THREE.InstancedMesh(geo, physPropMat, cap);
  imesh.castShadow = true;
  imesh.receiveShadow = !!receive;
  imesh.frustumCulled = false;
  imesh.count = 0;
  imesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  physGame.scene.add(imesh);
  g = { mesh: imesh, cap, used: 0, dirty: false };
  physInstByKey.set(key, g);
  physInstGroups.push(g);
  return g;
}

/**
 * After ANY direct write to body.position / body.quaternion (teleport, respawn,
 * kinematic placement) the render-time transform must be dragged along with it,
 * or the interpolator lerps from a stale origin and the prop smears across the
 * map for a frame.
 */
function physSyncBodyTransform(b) {
  b.previousPosition.copy(b.position);
  b.interpolatedPosition.copy(b.position);
  b.previousQuaternion.copy(b.quaternion);
  b.interpolatedQuaternion.copy(b.quaternion);
}

// ===========================================================================
// A CROWD IS MADE OF PEOPLE, AND YOU MAY NOT WALK THROUGH ONE (v36)
// ===========================================================================
//
// Nineteen chapters draw 3,761 people-shaped instances between them and, until
// the crowd audit went looking, ALMOST NONE OF THEM WERE THERE. `qa/CROWDS.md`
// measured it with a chest-height ray through each sampled instance: Rio 3%
// solid, Kowloon 3%, the Quay 3%, Manly 5%, Monte Carlo 6%, Hanoi 8%, Venice
// and Cali 0%. Three chapters were fixed by hand and the other six were left,
// which is the state this replaces.
//
// The three fixes were the same twenty lines written three times — rio.js:2496,
// kowloon.js:2562 and sahara.js:1787 each build `CANNON.Box(0.26, 0.85, 0.24)`
// on `game.mats.npc` from scratch — so this is that, once, with the two shapes
// it has to take and the four things that are easy to get wrong.
//
//   game.addCrowdBodies({ n, at(i, out), moving, y })  ->  a handle
//
// `at(i, out)` writes the i-th person's FOOT position into `out` ({x,y,z}) and
// returns false for an instance that is not a person (a spare slot, a hidden
// one). `moving` chooses the shape:
//
//   STATIC CROWD (`moving` false, the default) — ONE body, N shapes, offset
//   into place. Correct whenever nothing moves after placement, and it is one
//   broadphase entry for three hundred people. This is Rio's pattern.
//
//   WALKING CROWD (`moving` true) — one body EACH, because a compound body
//   cannot move one of its shapes. Call `handle.step(at)` from the chapter's
//   own update and every box follows its walker. This is Kowloon's pattern.
//
// FOUR THINGS THAT ARE EASY TO GET WRONG, ALL OF THEM PAID FOR ALREADY:
//
//  1. THE BOX IS npc.js's, to the centimetre, on `game.mats.npc` — or a person
//     drawn by a chapter feels different from a person drawn by the locals rig
//     and the same shove gives two different answers.
//  2. THE SHAPE IS OFFSET BY ITS OWN HALF-HEIGHT. `at()` returns where the
//     feet are; a box centred there is buried to the waist and trips the
//     animal instead of stopping it.
//  3. A MOVED BODY CARRIES ALL THREE OF CANNON'S POSITION FIELDS **AND SETS
//     `aabbNeedsUpdate`**. The three position fields are the render-time
//     transform: without them the box is solid where the walker was a frame
//     ago. The flag is the BROADPHASE: cannon only recomputes a body's AABB
//     when it is set, and `body.position.set()` does not set it — so a static
//     body moved by hand keeps the bounding box it was BUILT with, for ever,
//     and both the contact test and `world.raycastClosest` go on using it.
//     Measured on the first cut of this pass: every box was in the right
//     place, `qa/b6-crowds.js` still read Venice at 44% and the Quay at 40%,
//     and the bodies were provably there. kowloon.js:2659 has always set it;
//     the helper that was meant to replace that code did not.
//  4. IT IS NOT A WALL. These bodies are deliberately not registered with any
//     chapter's static/solid list: a crowd is something you push through the
//     edge of, not something the navigation grid should route around.
//
// The cost is measured and it is nothing: Marrakech went 67 -> 239 bodies for
// 0.1 ms of median tick, against the 0.3 ms the card allows.
const physCROWD_HX = 0.26, physCROWD_HY = 0.85, physCROWD_HZ = 0.24;
const physCrowdV = { x: 0, y: 0, z: 0 };

function physAddCrowdBodies(o) {
  const game = physGame;
  if (!game || !game.world || !o || !(o.n > 0) || typeof o.at !== 'function') return null;
  const mat = (game.mats && game.mats.npc) || undefined;
  const half = new CANNON.Vec3(physCROWD_HX, physCROWD_HY, physCROWD_HZ);
  const lift = typeof o.y === 'number' ? o.y : physCROWD_HY;
  const bodies = [];

  if (o.moving) {
    for (let i = 0; i < o.n; i++) {
      physCrowdV.x = physCrowdV.y = physCrowdV.z = 0;
      if (o.at(i, physCrowdV) === false) { bodies.push(null); continue; }
      const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: mat });
      b.addShape(new CANNON.Box(half));
      b.position.set(physCrowdV.x, physCrowdV.y + lift, physCrowdV.z);
      // A walker's box is written every frame, so it must never be allowed to
      // fall asleep — a sleeping static body stops being re-broadphased and the
      // person becomes a ghost again without anything on screen saying so.
      b.allowSleep = false;
      // ...and who it is (L6, E1): the camera's crowd sweep reads the index
      // to fade this one walker out of the lens through `o.meshes` (the
      // chapter's instanced parts, instance i = person i) when the chapter
      // passes them, and biases the boom round the person when it does not.
      b.userData = { crowd: o, idx: i };
      physSyncBodyTransform(b);
      game.world.addBody(b);
      bodies.push(b);
    }
  } else {
    const b = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC, material: mat });
    let put = 0;
    for (let i = 0; i < o.n; i++) {
      physCrowdV.x = physCrowdV.y = physCrowdV.z = 0;
      if (o.at(i, physCrowdV) === false) continue;
      b.addShape(new CANNON.Box(half),
                 new CANNON.Vec3(physCrowdV.x, physCrowdV.y + lift, physCrowdV.z));
      put++;
    }
    if (!put) return null;
    b.allowSleep = true;
    b.userData = { crowd: o, idx: -1 };     // a standing crowd is one body: no index (L6, E1)
    physSyncBodyTransform(b);
    game.world.addBody(b);
    bodies.push(b);
  }

  return {
    bodies: bodies,
    moving: !!o.moving,
    /**
     * Walking crowds only. Re-read every person and carry its box with it.
     *
     * `at` RETURNING FALSE HERE MEANS "NOT SOLID RIGHT NOW", and it PARKS the
     * box under the world rather than skipping it. Leaving it where it was is
     * the whole failure this exists to prevent: a person who has stepped onto
     * a plank, gone into a doorway or been despawned would otherwise leave an
     * invisible body standing in the square, which is worse than the ghost it
     * replaced because now you cannot see what you are walking into.
     */
    step: function (at) {
      if (!this.moving) return;
      const fn = typeof at === 'function' ? at : o.at;
      for (let i = 0; i < bodies.length; i++) {
        const b = bodies[i];
        if (!b) continue;
        physCrowdV.x = physCrowdV.y = physCrowdV.z = 0;
        if (fn(i, physCrowdV) === false) {
          if (b.position.y > -800) {
            b.position.set(0, -900, 0);
            physSyncBodyTransform(b);
            b.aabbNeedsUpdate = true;
          }
          continue;
        }
        b.position.set(physCrowdV.x, physCrowdV.y + lift, physCrowdV.z);
        physSyncBodyTransform(b);
        b.aabbNeedsUpdate = true;      // see 3. — the box, not just the picture
      }
    },
  };
}

/**
 * Render transform of a prop. `exact` reads the solver transform and is ONLY for
 * a body that has just been placed or has just gone to sleep — every per-frame
 * sync reads the interpolated fields, which is the transform at display time.
 * Reading body.position every frame pins the whole scatter to a 60Hz ladder.
 */
function physWriteInstance(prop, exact) {
  const g = prop.instGroup;
  if (!g) return;
  const b = prop.body;
  const bp = exact ? b.position : b.interpolatedPosition;
  const bq = exact ? b.quaternion : b.interpolatedQuaternion;
  // All THREE components, not scale.x three times: the squash (physSQUASH) is
  // non-uniform by construction, and a uniform read would have drawn it as the
  // prop simply getting smaller and coming back.
  const ms = prop.mesh.scale;
  physM4.compose(
    physV1.set(bp.x, bp.y, bp.z),
    physQ1.set(bq.x, bq.y, bq.z, bq.w),
    physV2.set(ms.x, ms.y, ms.z)
  );
  g.mesh.setMatrixAt(prop.instIdx, physM4);
  g.dirty = true;
}

/** Same rule for the standalone mesh a prop falls back to. */
function physSyncMesh(prop, exact) {
  const b = prop.body;
  const bp = exact ? b.position : b.interpolatedPosition;
  const bq = exact ? b.quaternion : b.interpolatedQuaternion;
  prop.mesh.position.set(bp.x, bp.y, bp.z);
  prop.mesh.quaternion.set(bq.x, bq.y, bq.z, bq.w);
}

function physZeroInstance(prop) {
  const g = prop.instGroup;
  if (!g) return;
  physM4.compose(physV3.set(0, -900, 0), physQ2.identity(), physV2.set(0, 0, 0));
  g.mesh.setMatrixAt(prop.instIdx, physM4);
  // hide immediately — this can fire mid-frame, after physUpdate has flushed
  g.mesh.instanceMatrix.needsUpdate = true;
  g.dirty = false;
}

/** solo = drawn by its own Mesh (mouth / NPC hand / spilled decal). */
function physSetSolo(prop, solo) {
  if (prop.solo === solo) return;
  prop.solo = solo;
  prop.mesh.visible = solo || !prop.instGroup;
  if (solo) physZeroInstance(prop);
  else physWriteInstance(prop);
}

function physFlushInstances() {
  for (let i = 0; i < physInstGroups.length; i++) {
    const g = physInstGroups[i];
    if (!g.dirty) continue;
    g.mesh.instanceMatrix.needsUpdate = true;
    g.dirty = false;
  }
}

/** Restores the dry-land damping profile for this prop. */
function physDryOut(prop) {
  const b = prop.body;
  b.linearDamping = prop.dampL;
  b.angularDamping = prop.dampA;
  b.allowSleep = true;
  prop.sunk = false;
}

/**
 * A prop has left the world. Put it back exactly where it was scattered, dead
 * still, and let it SETTLE there — never leave a body under the map awake.
 *
 * ---- AND IT MUST NOT BE SLEPT IN MID-AIR --------------------------------
 *
 * `homeY` is a SURFACE and the placement is `homeY + originY + 0.05`, which is
 * exact for a prop scattered on open ground and wrong for every prop whose
 * home is on a STRUCTURE — a deck, a causeway, a jetty, a plaza floor — where
 * the terrain function answers for the ground underneath rather than for the
 * thing you are standing on. The old code then called `b.sleep()` on the same
 * frame, and a sleeping body is skipped in the integrator: whatever the error
 * was, it was frozen there for ever. Measured across the seventeen, a relocated
 * keepsake hovered by up to 3.34 m.
 *
 * Correcting `homeY` at the source (see physStageKeep) took the worst case to
 * about a metre; the rest is unknowable from outside, because only the solver
 * knows what is actually under a point. So: lift it a little, and let it FALL
 * the last bit. `settled` stays false until the body sleeps on its own, which
 * is what it means, and the sleep is left to cannon rather than forced — the
 * body still has `allowSleep` on from physDryOut, so a prop that lands on
 * something drops off within a second and nothing is left awake under the map.
 */
function physRescue(prop) {
  const b = prop.body;
  b.position.set(prop.homeX, prop.homeY + prop.originY + 0.35, prop.homeZ);
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.force.set(0, 0, 0);
  b.torque.set(0, 0, 0);
  physQ1.setFromAxisAngle(physUp, rand(0, Math.PI * 2));
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  physSyncBodyTransform(b);
  prop.inWater = false;
  prop.spillArmed = false;
  physDryOut(prop);
  b.wakeUp();
  prop.settled = false;
  physSyncMesh(prop, true);
  if (!prop.solo) physWriteInstance(prop, true);
}

/**
 * Which biome is live right now. Everything a module adds at runtime is tagged
 * with this by main.js, so a prop's tag is simply the biome it was born into.
 */
function physLiveBiome() {
  const bm = physGame && physGame.biome;
  return bm && bm.current ? bm.current : 'sydney';
}

/** True while the Andes are the attached biome. Every water path is behind this. */
function physPastoLive() {
  const bm = physGame && physGame.biome;
  return !!(bm && bm.isActive && bm.isActive('pasto'));
}

function physMakeProp(type, x, z, variant, yaw, restY, loose) {
  const def = physTYPES[type];
  if (!def) return null;
  const geoKey = variant ? type + '#' + variant : type;
  // A LOOSE PROP BELONGS TO NO CHAPTER — see the note on physKEEPS. The empty
  // tag is what three of the four biome gates in this file already read as
  // "everywhere", and the raw adds below are the same hatch weather.js and the
  // particle pools use to survive a hemisphere change.
  const biomeTag = loose ? '' : physLiveBiome();
  const grpKey = geoKey + '@' + biomeTag;
  const geo = physGetGeo(type, variant);
  const mesh = new THREE.Mesh(geo, physPropMat);
  mesh.castShadow = true;
  mesh.receiveShadow = !!def.receive;
  mesh.matrixAutoUpdate = true;
  mesh.visible = false;
  if (loose) physSceneAddLoose(mesh); else physGame.scene.add(mesh);

  const light = def.mass < 0.6;
  const body = new CANNON.Body({
    mass: def.mass,
    material: def.bouncy && physBallMat
      ? physBallMat
      : (light && physLightMat ? physLightMat : (physGame.mats ? physGame.mats.prop : undefined)),
    linearDamping: light ? 0.02 : 0.06,
    angularDamping: light ? 0.04 : 0.12,
  });
  body.collisionFilterGroup = physGRP_DYN;
  const s = def.shape;
  if (s[0] === 'sph') body.addShape(new CANNON.Sphere(s[1]));
  else body.addShape(new CANNON.Box(new CANNON.Vec3(s[1], s[2], s[3])));
  // Rest ON whatever is under (x, z) — the podium deck is 1.2m up, and spawning
  // at ground height there buries the body inside the podium collider.
  // `restY` overrides that for a prop laid on a raised surface someone else owns
  // — a market stall table, whose top pasto.js reports and props.js cannot guess.
  const surfY = typeof restY === 'number' && restY === restY ? restY : physSurfaceY(x, z);
  body.position.set(x, surfY + def.hy + 0.015, z);
  physQ1.setFromAxisAngle(physUp, yaw === undefined ? rand(0, Math.PI * 2) : yaw);
  body.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  // placed by hand, so the render-time transform starts there too (a fresh body
  // interpolates from the origin otherwise, and flies in from (0,0,0))
  physSyncBodyTransform(body);
  body.allowSleep = true;
  body.sleepSpeedLimit = 0.16;
  body.sleepTimeLimit = 0.5;
  if (loose) physWorldAddLoose(body); else physGame.world.addBody(body);

  const prop = {
    id: physNextId++,
    type,
    name: def.name,
    mesh, body,
    grabbable: def.grabbable === false ? false : (def.planted ? false : true),
    mass: def.mass,
    holdOffset: new THREE.Vector3(def.hold[0], def.hold[1], def.hold[2]),
    holdQuat: new THREE.Quaternion(),
    owner: null,
    held: false,
    spilled: false,
    // internals
    originY: def.hy,
    planted: !!def.planted,
    frozen: false,
    settled: false,            // body asleep AND its final transform already drawn
    tipped: false,
    removed: false,
    inWater: false,
    sunk: false,
    hidden: false,             // parked out of the world (shattered / eaten), will restock
    hiddenUntil: 0,
    eaten: 0, grazeT: 0,       // bites taken, and the clock between them. See THE GRAZE.
    stall: null,               // the market stall this prop was laid out on
    craterIn: false,           // currently inside Galeras' bowl
    craterIdle: 0,             // s since it last made progress toward the vent
    craterY: 0,                // lowest y reached on this trip down
    craterTries: 0,            // shoves already given on the way to the vent
    fragile: !!def.fragile,
    // buoyancy: rho is the fluid density that makes THIS prop sit at `float`
    // submerged, so F = rho * g * (vol * submergedFraction) is genuine
    // Archimedes and the designed waterline falls straight out of it.
    biome: biomeTag,
    // Which place's souvenir this is, or '' for the four hundred props that
    // are not one. See physKEEPS.
    keep: def.keep || '',
    // ---- ...AND WHETHER YOU BROUGHT IT WITH YOU (item 5) ----------------
    // Declared here rather than left to appear on first write, which is the
    // shape that gave `talkCd` to seventeen chapters with nothing anywhere to
    // decrement it. Set only by physTravelThrough; read by npc.js, which must
    // not let anybody own it or read its pickup as a robbery.
    travelled: false,
    travelFrom: "",              // ...and the chapter it was carried out of
    vol: physVolume(def),
    floatFrac: physFloatFrac(def),
    rho: def.mass / (physVolume(def) * physFloatFrac(def)),
    // ½·ρ·Cd·A, so drag is one multiply per frame. Area is the mean face of the
    // collision shape — honest enough that a beach ball floats down and a full
    // esky drops like the nine kilos it is.
    aeroK: 0.5 * physAERO_RHO * (s[0] === 'sph'
      ? physAERO_CD_SPH * Math.PI * s[1] * s[1]
      : physAERO_CD_BOX * (4 * (s[1] * s[2] + s[2] * s[3] + s[1] * s[3]) / 3)),
    splash: def.splash || 1,
    spillArmed: false,
    // ---- B9: a thing inside a thing. `contents` is what this prop is
    // carrying; `inVessel` is what is carrying this prop. One each way.
    contents: null,
    inVessel: null,
    vesselOff: null,
    wasStolen: false,
    stolenFrom: null,
    lastImpact: -1,
    homeX: x, homeY: surfY, homeZ: z,
    // causation ledger — no task ticks unless the capybara earned it
    disturbed: false,          // has anything external ever moved this prop?
    lastCapyTouch: -1e9,       // last contact with the capy (or its cargo)
    releaseTime: -1e9,         // last time the capy let go of / threw it
    // ...and the narrower mark: the last time the capybara THREW it, meaning
    // physRelease was handed a launch impulse. Separate from releaseTime
    // because a set-down, an npc fumble and a collapsing stall all stamp that
    // one and none of them is a thing the player aimed. See physPersonHit.
    thrownT: -1e9,
    spin: def.spin,
    gustT: Math.random() * physGUST_KICK_T,   // the puff clock. See physGustKick.
    dampL: light ? 0.02 : 0.06,
    dampA: light ? 0.04 : 0.12,
    lastWX: x, lastWY: surfY + def.hy, lastWZ: z,
    instGroup: null,
    instIdx: -1,
    solo: true,
    onCollide: null,
  };
  prop.holdQuat.setFromEuler(physEuler.set(0.2, 0, 0));
  mesh.position.set(body.position.x, body.position.y, body.position.z);
  mesh.quaternion.set(body.quaternion.x, body.quaternion.y, body.quaternion.z, body.quaternion.w);

  // A LOOSE PROP IS ALWAYS SOLO. An InstancedMesh is created under whatever
  // capture tag is live, so it is owned by that chapter and goes invisible with
  // it — which is exactly the bug the per-biome instance key was invented to
  // fix, and it cannot be fixed for an object whose whole point is that it has
  // no chapter. It draws itself, for one draw call.
  if (loose) {
    mesh.visible = true;
  } else {
    const grp = physInstGroupFor(type, grpKey, geo, def.receive);
    if (grp.used < grp.cap) {
      prop.instGroup = grp;
      prop.instIdx = grp.used++;
      grp.mesh.count = grp.used;
      prop.solo = false;
      physWriteInstance(prop);
    } else {
      mesh.visible = true;   // pool overflow — fall back to a standalone draw
    }
  }

  if (prop.planted) {
    body.type = CANNON.Body.STATIC;
    body.updateMassProperties();
    prop.frozen = true;
    body.sleep();
  }

  prop.onCollide = (e) => physOnCollide(prop, e);
  body.addEventListener('collide', prop.onCollide);
  physBodyToProp.set(body.id, prop);

  physGame.props.push(prop);
  if (type === 'bin') physBins.push(prop);
  return prop;
}

function physSpawnProp(type, x, z, restY, yaw) {
  return physMakeProp(type, x, z, type === 'flower' ? randInt(0, 2) : 0, yaw, restY);
}

/**
 * PUT A CHAPTER'S SOUVENIR ON THE GROUND, AS AN OBJECT. See physKEEPS.
 *
 * Idempotent per place — a chapter can only be finished once, but the save
 * restores a finished chapter and systems.js is entitled to ask again, and two
 * copies of the same souvenir is a bug you can pick up. `restY` is passed
 * through so a ceremony that happens on a deck does not bury it in the deck.
 */
function physSpawnKeep(place, x, z, restY) {
  if (!place || !physKEEPS[place]) return null;
  const have = physKeepOut(place);
  if (have) return have;
  return physMakeProp('keep-' + place, x, z, 0, undefined, restY, true);
}

/**
 * SET A SOUVENIR DOWN SOMEWHERE ON PURPOSE, AND LEAVE IT THERE.
 *
 * physSpawnKeep is idempotent, which is what makes it safe to call on every
 * restore — and it is exactly what stops a caller ARRANGING the seventeen: ask
 * for one that already exists and you get the one lying wherever the last
 * border crossing fanned it, not a new one where you asked. The finale needs
 * them laid out, so this is the mover: spawn if absent, otherwise pick the
 * existing one up and put it down at the point given.
 *
 * Three things beyond the position, all of which were bugs when they were left
 * out somewhere else in this file:
 *  - `homeX/Y/Z` moves too, or physRescue drags a keepsake that goes over an
 *    edge back to the chapter it was first put down in.
 *  - velocity, angular velocity, force and torque are all cleared. A body
 *    teleported with its momentum intact carries the fall it was already in.
 *  - it is put to SLEEP. Seventeen loose props are seventeen awake dynamic
 *    bodies otherwise, and an arrangement that is nudging itself apart on the
 *    frame you first see it is not an arrangement.
 * A held keepsake is left alone: the animal's mouth outranks the display.
 */
function physStageKeep(place, x, z, restY) {
  const p = physSpawnKeep(place, x, z, restY);
  if (!p || p.held) return p;
  // `homeY` is a SURFACE, not a body centre — physRescue adds originY back on
  // (see physRescue), and physMakeProp stores `homeY: surfY` for the same
  // reason. Setting it to the body's own y here would raise the prop by its own
  // half-height on every rescue, one half-height per rescue, for ever.
  const surfY = (typeof restY === 'number' && restY === restY) ? restY : physSurfaceY(x, z);
  p.body.position.set(x, surfY + p.originY + 0.015, z);
  p.body.velocity.set(0, 0, 0);
  p.body.angularVelocity.set(0, 0, 0);
  p.body.force.set(0, 0, 0);
  p.body.torque.set(0, 0, 0);
  p.homeX = x; p.homeY = surfY; p.homeZ = z;
  physSyncBodyTransform(p.body);
  physSyncMesh(p, true);
  if (p.body.sleep) p.body.sleep();
  return p;
}

/** The live keepsake for a place, wherever it has got to. Null if none. */
function physKeepOut(place) {
  const arr = physGame.props;
  for (let i = 0; i < arr.length; i++) {
    if (!arr[i].removed && arr[i].keep === place) return arr[i];
  }
  return null;
}

function physRemoveProp(prop) {
  if (!prop || prop.removed) return;
  // ...and if it is mid-flash, take it off that list and give it its material
  // back first. A prop removed on the frame it was hit would otherwise sit in
  // physFlashing for ever, and the list is walked every frame.
  if (prop.flashT > 0) { prop.flashT = 0.0001; physFlashStep(1); }
  const arr = physGame.props;
  const i = arr.indexOf(prop);
  if (i >= 0) arr.splice(i, 1);
  prop.removed = true;
  prop.grabbable = false;
  if (prop.held) {
    prop.held = false;
    if (physGame.capy && physGame.capy.heldProp === prop) physGame.capy.heldProp = null;
  }
  if (prop.owner && prop.owner.heldProp === prop) prop.owner.heldProp = null;
  prop.owner = null;
  const bi = physBins.indexOf(prop);
  if (bi >= 0) physBins.splice(bi, 1);
  physZeroInstance(prop);
  prop.instGroup = null;
  if (prop.mesh.parent) prop.mesh.parent.remove(prop.mesh);
  prop.mesh.visible = false;
  if (prop.onCollide) prop.body.removeEventListener('collide', prop.onCollide);
  physBodyToProp.delete(prop.body.id);
  physGame.world.removeBody(prop.body);
  // ...and out of its chapter's set, or the next arrival puts the body back.
  // See THE OPPOSITE OF CLAIM in main.js — the errand cup that leaked once a
  // visit.
  if (physGame.biome && typeof physGame.biome.disown === 'function') {
    physGame.biome.disown(prop.body);
    physGame.biome.disown(prop.mesh);
  }
  physDestroyPayload.prop = prop;
  physGame.events.emit('prop:destroy', physDestroyPayload);
}

// ---- scatter --------------------------------------------------------------
// Counts are held down by CONTRACT.md's 130-body budget, not by taste: every
// row here is one live CANNON.Body. Duplicates past the second add nothing the
// player can tell apart, so the second copy is the first thing to go.
const physSCATTER = [
  ['promenade', 'hat', 2], ['promenade', 'coffee', 2], ['promenade', 'icecream', 1],
  ['promenade', 'towel', 1], ['promenade', 'deckchair', 1], ['promenade', 'thong', 1],
  ['promenade', 'esky', 1], ['promenade', 'ball', 1], ['promenade', 'frisbee', 1],
  ['promenade', 'handbag', 1], ['promenade', 'bin', 1],
  ['picnic', 'sandwich', 1], ['picnic', 'basket', 1], ['picnic', 'esky', 1],
  ['picnic', 'towel', 1], ['picnic', 'ball', 1],
  ['picnic', 'hat', 1],
  ['operaStage', 'cone', 2], ['operaStage', 'bin', 2], ['operaStage', 'sign', 1],
  ['operaStage', 'coffee', 1], ['operaStage', 'hat', 1],
  ['gardens', 'flower', 1], ['gardens', 'sign', 1], ['gardens', 'bin', 1],
  ['gardens', 'basket', 1], ['gardens', 'handbag', 1],
  ['flowerbed', 'flower', 2],
];

const physFALLBACK_ZONES = {
  promenade:  { x0: -58, z0: -6, x1: -18, z1: 26 },
  picnic:     { x0: 23,  z0: 19, x1: 37,  z1: 33 },
  operaStage: { x0: -11, z0: 8,  x1: 11,  z1: 17 },
  gardens:    { x0: 18,  z0: 8,  x1: 58,  z1: 54 },
  flowerbed:  { x0: 25,  z0: 11, x1: 35,  z1: 19 },
};

function physZoneRect(name) {
  const env = physGame.env;
  if (env && env.zones && env.zones[name]) {
    const r = env.zones[name];
    if (typeof r.x0 === 'number' && typeof r.x1 === 'number') return r;
  }
  return physFALLBACK_ZONES[name] || physFALLBACK_ZONES.picnic;
}

function physRectIn(r, x, z, m) {
  return x > r.x0 - m && x < r.x1 + m && z > r.z0 - m && z < r.z1 + m;
}

/**
 * Height of the surface a prop dropped at (x, z) would come to rest on.
 * Prefers a real query from environment.js if one ever appears; otherwise the
 * only raised deck in the world is the Opera House podium.
 */
function physSurfaceY(x, z) {
  // No biome is flat by decree. This used to know two worlds — Sydney's env and
  // Pasto's volcano — and answered with Sydney's flat harbour apron for the
  // eleven chapters written since, so a prop rescued in Rio or spawned in Uji
  // was measured against ground that only exists in Sydney. Ask the LIVE biome,
  // exactly the way capybara.js does.
  if (physGame.biome && !physGame.biome.isActive('sydney')) {
    const h = physTerrainAt(x, z);
    if (h === h) return h;
    return 0;
  }
  const env = physGame.env;
  if (env) {
    if (typeof env.surfaceY === 'function') return env.surfaceY(x, z);
    if (typeof env.groundY === 'function') return env.groundY(x, z);
  }
  // THE RED IS A BLOCK NOW (L6, E4): 0.3 m over the deck at x ±6.5, z 0..2.9
  // (environment.js envSTAGE_Y), so a prop placed on the old carpet rect at
  // deck height landed inside it and was popped up by the solver.
  if (physRectIn(physSTAGE_RECT, x, z, 0)) return physSTAGE_Y;
  if (physRectIn(physDECK_FULL, x, z, 0)) return physPODIUM_Y;
  return 0;
}

/** Deck points clear of the shell bases and safely inboard of every edge. */
function physDeckClear(x, z, radius) {
  if (!physRectIn(physDECK_SAFE, x, z, -radius)) return false;
  for (let i = 0; i < physDECK_BLOCK.length; i++) {
    if (physRectIn(physDECK_BLOCK[i], x, z, radius)) return false;
  }
  return true;
}

/** Collision radius a prop of this type needs kept clear around it. */
function physPropRadius(type) {
  const def = physTYPES[type];
  if (!def) return 0.5;
  if (!def.fitted) physGetGeo(type, 0);     // the fit lives in the bake
  const s = def.shape;
  return s[0] === 'sph' ? s[1] : Math.max(s[1], s[3]);
}

/**
 * Every candidate spawn point is tested here — including env.navBlocked, for
 * EVERY prop. The podium deck reports as nav-blocked (it is raised, not
 * impassable); that one verdict is forgiven for forecourt props, which are
 * meant to stand on it and are spawned at deck height. Nothing else is.
 */
function physSpotOk(x, z, radius, deckZone) {
  // ---- ASK THE LIVE BIOME, NOT SYDNEY --------------------------------------
  // This used to read physGame.env — Sydney's environment — for isOverWater AND
  // navBlocked whatever biome was attached, and reject anything outside
  // Sydney's own box (z -8.6..68, x +-68). It cost nothing while Sydney and
  // Pasto were the only two biomes that scattered; the moment any other chapter
  // does, that box rejects every candidate point in the world and the whole
  // scatter silently produces nothing. Same fix as physSurfaceY.
  const sydney = !physGame.biome || physGame.biome.isActive('sydney');
  const api = physBiomeApi();
  if (!(x === x) || !(z === z)) return false;
  if (sydney) {
    if (z < -8.6 || z > 68 || x < -68 || x > 68) return false;
  } else if (x < -500 || x > 500 || z < -700 || z > 500) {
    return false;                                          // sanity only; the zone rect does the work
  }
  if (api && api.isOverWater && api.isOverWater(x, z)) return false;
  if (sydney) {
    if (physRectIn(physSTAIR, x, z, radius)) return false; // the Opera House stair
    const onDeck = physRectIn(physDECK_FULL, x, z, radius);
    if (onDeck && !deckZone) return false;                 // never bury a prop in the podium
    if (api && api.navBlocked && api.navBlocked(x, z, radius)) {
      if (!(onDeck && physDeckClear(x, z, radius))) return false;
    }
    return true;
  }
  if (api && api.navBlocked && api.navBlocked(x, z, radius)) return false;
  return true;
}

function physFindSpot(zone, radius) {
  const env = physGame.env;
  const rect = physZoneRect(zone);
  const deckZone = !!physDECK_ZONES[zone];
  const gap = radius + 0.8;
  for (let attempt = 0; attempt < 64; attempt++) {
    let x = NaN;
    let z = NaN;
    if (env && env.randomPointIn && attempt < 44) {
      const p = env.randomPointIn(zone);
      if (p && typeof p.x === 'number' && typeof p.z === 'number') { x = p.x; z = p.z; }
    }
    if (!(x === x)) {
      x = rand(Math.min(rect.x0, rect.x1), Math.max(rect.x0, rect.x1));
      z = rand(Math.min(rect.z0, rect.z1), Math.max(rect.z0, rect.z1));
    }
    if (!physSpotOk(x, z, radius, deckZone)) continue;
    // crowding is a nicety, not a correctness rule — relax it on the last tries
    if (attempt < 56 && physCrowded(x, z, gap)) continue;
    physSpot.x = x; physSpot.z = z; physSpot.ok = true;
    return physSpot;
  }
  // No legal point. A missing bin is infinitely better than a bin inside a wall.
  physSpot.ok = false;
  return physSpot;
}

function physCrowded(x, z, minDist) {
  const arr = physGame.props;
  const live = physLiveBiome();
  const d2 = minDist * minDist;
  for (let i = 0; i < arr.length; i++) {
    // Biomes share one coordinate space, so a prop parked in Sydney sits at the
    // same (x, z) as a legal spot in Venice. Only what is actually in the world
    // beside us can crowd us.
    if (arr[i].biome !== live) continue;
    const b = arr[i].body.position;
    const dx = b.x - x;
    const dz = b.z - z;
    if (dx * dx + dz * dz < d2) return true;
  }
  return false;
}

// ---- Circular Quay band ---------------------------------------------------
// SYDNEY's boardwalk, not the chapter-3 'quay' biome. The names collide and the
// coordinates look like a mis-tag, but 'seagull-chips', 'cafe-table' and
// 'dog-loose' are all CHAPTER ONE tasks played out on this band, and they read
// these very props. It is scattered at boot, under Sydney's tag, on purpose.
// Placed from an explicit rect rather than env.randomPointIn: environment.js may
// not publish a zone for it at all.
// CONTRACT world layout: boardwalk / dining terrace x [-46,-14], z [-10,10]
// (clipped to z > -8.5, the far side of that is open harbour).
const physQUAY = { x0: -45.4, z0: -8.2, x1: -14.8, z1: 9.4 };
const physQUAY_SCATTER = [
  ['chips', 2], ['camera', 1], ['sunglasses', 1],
  ['ticket', 1], ['menu', 1], ['winebottle', 1],
];

// ---- the other fifteen chapters -------------------------------------------
// Every chapter from Circular Quay on shipped with ZERO dynamic bodies. Nothing
// was broken: physScatter() simply runs once at boot, physScatterPasto() runs on
// the first entry into Pasto, and no third call was ever written — so fifteen
// worlds full of tables, stalls, crates and counters had nothing in them a
// capybara could pick up, shove or knock over.
//
// Placement is deliberately NOT a hand-authored rect per world. Fifteen rects
// is fifteen chances to bury a bin in a wall the day someone moves a building;
// instead each chapter names a centre and an annulus, and physSpotOk does the
// rest against that biome's OWN navBlocked / isOverWater / terrainHeight. A
// point that fails is skipped, and a missing bin is always better than a bin
// inside a façade.
//
// Types are drawn from what already exists — no new geometry — and chosen so
// nothing reads as imported from the wrong hemisphere: no beach balls in
// Reykjavik, no eskies in the Sơn Đoòng.
const physBIOME_SCATTER = {
  // SIX GRABBABLE PROPS OVER EIGHTY THOUSAND SQUARE METRES — the lowest
  // absolute count in the game, on the apron of the busiest ferry terminal in
  // the southern hemisphere. Four more, and they are all the same four things:
  // what a person waiting for a boat is carrying and puts down. The chips are
  // not decoration — quayBuildApronGulls has a flock standing on this paving
  // and quayBurstChips is already written; a dropped packet is what it is for.
  quay:      { x: 4, z: 26, r0: 4, r1: 20,
               props: [['bin', 1], ['cone', 2], ['sign', 1], ['esky', 1], ['basket', 1],
                       ['coffee', 1], ['camera', 1], ['handbag', 1], ['chips', 1]],
    // Second cluster: the five-person knot inboard of the apron, measured at
    // (-20, 17). The apron's own list again, minus the chips: one packet, one
    // flock, and two would halve what the first one is for.
    also: { x: -20, z: 17, r0: 4, r1: 16, props: [['bin', 1], ['cone', 2], ['sign', 1], ['esky', 1], ['basket', 1], ['coffee', 1], ['handbag', 1]] },
  },
  kyoto:     { x: 0, z: 34, r0: 5, r1: 26, props: [['basket', 2], ['dango', 2], ['hat', 1], ['coffee', 1], ['bin', 1], ['cone', 1], ['sign', 1], ['handbag', 1]],
    // Second cluster: UJI. The chapter's whole southern half — the mill, the
    // tea house, 'matcha-raid' and 'whisk-spin' — had not one loose object on
    // it, and its two locals are measured at (14, 176) and (33, 198).
    also: { x: 16, z: 178, r0: 3, r1: 16, props: [['basket', 2], ['dango', 2], ['cuencobowl', 2], ['mug', 2], ['hat', 1]] },
  },
  cali:      { x: 0, z: 24, r0: 5, r1: 26, props: [['empanada', 2], ['arepa', 1], ['plantain', 1], ['sombrero', 1], ['basket', 1], ['bin', 1], ['cone', 2], ['sign', 1]],
    // Second cluster: THE ARRIVAL. Cali measured 0 props within 20 m of the
    // spawn and 4 within 40 — the emptiest place this game ever puts you down
    // — and there is a local standing four metres from it at (-20, -19).
    also: { x: -20, z: -19, r0: 4, r1: 17, props: [['empanada', 1], ['arepa', 1], ['plantain', 1], ['basket', 2], ['bin', 1], ['cone', 1], ['sign', 1]] },
  },
  // ...AND ONE OF THEM IS FOOD. Rio had 0 edible props of 10, so batch 1's
  // produce reaction — graze someone's lunch, earn a line and a shoo — could
  // not fire in a chapter whose whole beach is people eating. The esky goes:
  // it is the one thing on the list a person does not carry down and put down.
  rio:       { x: 0, z: 0,  r0: 5, r1: 26, props: [['ball', 1], ['towel', 2], ['thong', 1], ['icecream', 1], ['frisbee', 1], ['sunglasses', 1], ['bin', 1], ['cone', 2]],
    // Second cluster: the far end of the beach at (-34, -4), where the chapter
    // stands a walker and nothing else.
    also: { x: -34, z: -4, r0: 4, r1: 18, props: [['ball', 1], ['towel', 1], ['thong', 1], ['icecream', 1], ['sunglasses', 1], ['frisbee', 1], ['bin', 1], ['cone', 1]] },
  },
  iceland:   { x: 0, z: 99, r0: 5, r1: 24, props: [['coffee', 2], ['camera', 1], ['handbag', 1], ['basket', 1], ['bin', 2], ['cone', 1], ['sign', 2]],
    // Second cluster: out of town, on the local measured at (24, 132).
    also: { x: 24, z: 132, r0: 4, r1: 16, props: [['coffee', 1], ['camera', 1], ['basket', 1], ['bin', 1], ['sign', 1], ['handbag', 1], ['mug', 2]] },
  },
  // Was `sombrero, plantain, maiz` — a Nariño hat, a bunch of plantains and a
  // cob of maize, scattered across Jemaa el-Fnaa. The Pasto market's props
  // travel and that is deliberate, but three of them are the wrong CONTINENT
  // and the square is the most identifiable place in the chapter.
  sahara:    { x: 0, z: 8,  r0: 5, r1: 24, props: [['basket', 3], ['cuencobowl', 3], ['hat', 1], ['mug', 1], ['camera', 1], ['handbag', 1], ['cone', 1]],
    // Second cluster: east of the square, on the local measured at (-6, -50).
    also: { x: -6, z: -50, r0: 4, r1: 18, props: [['basket', 2], ['cuencobowl', 2], ['mug', 2], ['hat', 1], ['handbag', 1]] },
  },
  // The Shelf is high, thin and windy, so nothing here is light enough to blow
  // about — but the list that enforced that was TWO WHEELIE BINS, TWO ROAD
  // SIGNS, TWO TRAFFIC CONES, AN ESKY AND A MENU BOARD, scattered over the
  // meadow of an abandoned floating island under one moon. Measured off the
  // rendered frame of the spawn: orange cones and a green council bin, ten
  // metres from a lamp somebody left burning two hundred years ago. The Drift's
  // whole premise is that the ground came off and took a household with it, and
  // that household is drawn all over the chapter (a hearth, a jetty, a drying
  // rack, three offering bowls) — so its loose props are the same household's.
  // ...AND THEY BELONGED TO NOBODY, WHICH IS THE ONE OUTRIGHT MISCHIEF
  // FAILURE IN THE GAME. Ownership is by where a prop LIVES, inside npcOWN_R =
  // 11 m of its home. This annulus is centred at (2, 42) and the only walker on
  // the Shelf is the jetty traveller at (26.4, 32.8) — measured, nearest
  // home-to-walker 13.7 m, mean 26.8, and **0 of 9 props owned, 0 owners, 0 of
  // 3 chains**. The Drift's witness chain is deliberately absent (one voice per
  // island and forty metres of sky between them) and stays absent, so ownership
  // is the only chain it can have.
  //
  // Re-centred on the traveller: 51% of valid spots now land inside 11 m,
  // against 5%. The croft and lamp at (-13, 33) were the other candidate and
  // give 0% — the west end of the Shelf has no walker on it at all.
  //
  // The esky goes for the hat: 7 of the 9 props were too heavy for the
  // chapter's own gale (measured, cuencobowl 0.8 kg drifts 4 cm in 40 s; the
  // esky never moves), and this is the chapter the wind comedy lives in.
  drift:     { x: 17, z: 33, r0: 2, r1: 7, props: [['basket', 3], ['cuencobowl', 1], ['mug', 2], ['winebottle', 1], ['hat', 1], ['thong', 1]] },
  venice:    { x: -4, z: 13, r0: 4, r1: 22, props: [['winebottle', 2], ['menu', 1], ['coffee', 1], ['camera', 1], ['handbag', 1], ['bin', 1], ['cone', 1], ['sign', 1], ['basket', 1]],
    // Second cluster: the three-person knot south of the campo at (-14, -17).
    also: { x: -14, z: -17, r0: 4, r1: 18, props: [['winebottle', 1], ['menu', 1], ['coffee', 1], ['camera', 1], ['basket', 2], ['bin', 1], ['cone', 1]] },
  },
  kowloon:   { x: 0, z: 34, r0: 4, r1: 22, props: [['chips', 2], ['coffee', 1], ['sign', 2], ['cone', 2], ['bin', 2], ['basket', 1], ['camera', 1]],
    // Second cluster: down the street at (9, 3), where two more people are.
    also: { x: 9, z: 3, r0: 4, r1: 18, props: [['chips', 1], ['coffee', 1], ['sign', 1], ['cone', 2], ['bin', 1], ['basket', 2], ['camera', 1]] },
  },
  // ...and no TRAFFIC CONE. There is no road within forty kilometres of that
  // beach and there is not a wheeled vehicle in the chapter — same argument as
  // the sombrero on Jemaa el-Fnaa and the wheelie bins on the Drift. The rest of
  // the beach household stays: props are allowed to travel, they are just not
  // allowed to be from a different KIND of place.
  palawan:   { x: 0, z: 46, r0: 5, r1: 24, props: [['ball', 1], ['towel', 2], ['thong', 2], ['esky', 1], ['basket', 2], ['frisbee', 1], ['sunglasses', 1], ['cuencobowl', 1]],
    // Second cluster: the two people down the sand at (6, 21).
    also: { x: 6, z: 21, r0: 4, r1: 16, props: [['ball', 1], ['towel', 1], ['thong', 1], ['basket', 2], ['frisbee', 1], ['cuencobowl', 2]] },
  },
  // Was 'sombrero' — a Nariño hat scattered across a square in Anatolia, which
  // is the same mistake Jemaa el-Fnaa had and which was fixed there for the same
  // reason: the Pasto market's props are allowed to travel, but not onto the one
  // piece of ground in the chapter the player is put down on. A Cappadocian
  // square at ten past five has tea glasses, clay from Avanos and baskets on it.
  goreme:    { x: 0, z: 34, r0: 5, r1: 26, props: [['basket', 2], ['cuencobowl', 3], ['mug', 2], ['hat', 1], ['cone', 1], ['sign', 1], ['bin', 1]],
    // Second cluster: the local measured south of the square at (6, 4).
    also: { x: 6, z: 4, r0: 4, r1: 18, props: [['basket', 2], ['cuencobowl', 2], ['mug', 2], ['hat', 1], ['sign', 1]] },
  },
  manly:     { x: 0, z: 46, r0: 5, r1: 26, props: [['ball', 1], ['towel', 2], ['thong', 2], ['esky', 1], ['frisbee', 1], ['hat', 1], ['sunglasses', 1], ['deckchair', 1], ['bin', 1]],
    // Second cluster: the two people at the north end, measured (39, 36).
    also: { x: 39, z: 36, r0: 4, r1: 16, props: [['ball', 1], ['towel', 2], ['thong', 1], ['esky', 1], ['frisbee', 1], ['sunglasses', 1], ['bin', 1]] },
  },
  // ---- THE DRIFT’S FAILURE, TWICE MORE, AND FOUND THE SAME WAY --------
  //
  // Ownership is by where a prop LIVES: npcOWN_R = 11 m from its home. Both of
  // these annuli were centred on the SPAWN, which in a chapter whose people
  // are somewhere else is a guarantee that nothing is owned by anybody.
  //
  // PANTANAL, measured: 0 of 9 props owned, 0 owners. Nearest walker to each
  // prop home 24.4 / 29.4 / 31.4 / 33.4 / 38.0 / 48.3 / 48.8 / 50.2 / 53.8 m.
  // The only walkers in the chapter are the fazenda three, and the fazenda is
  // where a basket of maize, an esky and a bin belong anyway — a spawn on open
  // campo is not a household.
  //
  // SON DOONG, measured: 8 movable props all landed at z in [45, 82], the
  // nearest local is at (12, 33), and the closest prop-to-person distance was
  // 15.0 m — over the radius, so 0 owned. The people down here are the SURVEY
  // CAMPS, which is also the only place in a cave where anybody’s belongings
  // would be: a bin, a sign, a camera and an esky are expedition kit, and they
  // are meant to be somebody’s.
  pantanal:  { x: 30, z: 77, r0: 3, r1: 13, props: [['basket', 2], ['esky', 1], ['maiz', 2], ['plantain', 1], ['hat', 1], ['cone', 1], ['bin', 1]],
    // Second cluster: the local at (43, 13), sixty-five metres from the
    // fazenda — the southern half of the campo had nothing loose on it at all.
    also: { x: 43, z: 13, r0: 4, r1: 16, props: [['basket', 2], ['maiz', 2], ['plantain', 1], ['hat', 1], ['esky', 1], ['bin', 1]] },
  },
  cave:      { x: 20, z: -41, r0: 3, r1: 13, props: [['bin', 1], ['sign', 2], ['cone', 2], ['basket', 1], ['camera', 1], ['esky', 1]],
    // Second cluster: THE ARRIVAL, and it is the worst case in the game. Son
    // Doong's eight props are all at the survey camp and the camp is 109 m
    // from where the chapter puts you down: measured, ZERO props within eighty
    // metres of the spawn. There is a local at (12, 33), thirty-one metres from
    // it and seventy-four from the camp.
    also: { x: 12, z: 33, r0: 3, r1: 14, props: [['bin', 1], ['sign', 1], ['cone', 2], ['basket', 1], ['camera', 1], ['esky', 1]] },
  },
  antarctic: { x: 0, z: 52, r0: 5, r1: 24, props: [['esky', 1], ['bin', 1], ['sign', 2], ['cone', 2], ['camera', 1], ['coffee', 1], ['basket', 1]],
    // Second cluster: the local out on the ice at (16, 83).
    also: { x: 16, z: 83, r0: 4, r1: 16, props: [['esky', 1], ['bin', 1], ['sign', 1], ['cone', 2], ['camera', 1], ['coffee', 1], ['basket', 1]] },
  },
  // The quay under the Rocher, which is where the chapter puts you down and
  // the one place in Monaco anybody leaves anything lying about. Centred on
  // the FISHERMAN and not on the spawn: ownership is by where a prop lives
  // (npcOWN_R = 11 m from its home) and an annulus round an empty quay is a
  // guarantee that nothing belongs to anybody. See THE DRIFT'S FAILURE above.
  monaco: { x: -58, z: -30, r0: 4, r1: 15, props: [['bin', 1], ['sign', 1], ['cone', 2], ['esky', 1], ['basket', 1], ['winebottle', 2], ['camera', 1], ['sunglasses', 1]],
    // Second cluster: THE ARRIVAL. The fisherman's quay is 84 m from where the
    // chapter puts you down, and there was exactly one prop within twenty
    // metres of the spawn. A local stands seven metres from it at (8, -73).
    also: { x: 8, z: -73, r0: 4, r1: 16, props: [['bin', 1], ['sign', 1], ['cone', 2], ['esky', 1], ['basket', 1], ['winebottle', 1], ['camera', 1], ['sunglasses', 1]] },
  },
  // The bia hoi corner, because that is where anybody in this chapter would
  // put anything down. Centred on the corner and NOT on the spawn: the spawn
  // is a lake walk with nobody's belongings on it, and an annulus round an
  // empty walk is a guarantee that nothing is owned by anybody.
  hanoi: { x: 62, z: 18, r0: 4, r1: 15, props: [['basket', 2], ['bin', 1], ['esky', 1], ['cone', 1], ['sign', 1], ['phobowl', 2], ['flowers', 2], ['camera', 1]],
    // Second cluster: the local at (-8, -7), between the lake walk you arrive
    // on and the bia hoi corner — seventy-four metres from the corner, and the
    // whole of the walk in had nothing on it.
    // ---- AND A THIRD, WHERE THE PLAYER ACTUALLY LANDS (B5) --------------
    // MEASURED: Hanoi is the only chapter in the game with NOTHING loose
    // within sixteen metres of its spawn and nobody within twenty-six — in a
    // city whose own arrival line is "seven million people and six million of
    // them are on a moped". The two clusters above are 88 m and 154 m from
    // HANOI_SPAWN (-60, -78); its locals are ninety-odd metres away; and the
    // two hundred and forty bikes are an instanced crowd, so not one of them
    // can witness anything. The incident chain — the one repeatable reward in
    // the game — was dead for the whole walk in.
    //
    // The lake wall is where people sit, so this is what they leave on it. The
    // flower bicycle's own row is at the far end of the chapter; these are the
    // things that make the FIRST thing you knock over count.
    also: [
      { x: -8, z: -7, r0: 4, r1: 16, props: [['basket', 2], ['bin', 1], ['cone', 1], ['sign', 1], ['phobowl', 2], ['flowers', 1], ['coffee', 1]] },
      // The chapter's own list, and nothing invented: `stool` is not a
      // physTYPE — the ninety-six on the bia hoi terrace are hanoi.js's own
      // and belong to `the-stools`, which is a set piece and not scatter.
      { x: -58, z: -74, r0: 3, r1: 13, props: [['phobowl', 2], ['basket', 2], ['flowers', 2], ['bin', 1], ['coffee', 1], ['cone', 1], ['sign', 1]] },
    ],
  },
};
const physBiomeScattered = {};   // biome name -> true, so re-entry never doubles up

/** One annulus. Split out of physScatterBiome so a chapter can have two. */
function physScatterRing(def) {
  let placed = 0;
  for (let i = 0; i < def.props.length; i++) {
    const type = def.props[i][0];
    const radius = physPropRadius(type);
    for (let n = 0; n < def.props[i][1]; n++) {
      for (let a = 0; a < 64; a++) {
        const ang = rand(0, Math.PI * 2);
        const rad = Math.sqrt(rand(def.r0 * def.r0, def.r1 * def.r1));   // uniform over the ring
        const x = def.x + Math.cos(ang) * rad;
        const z = def.z + Math.sin(ang) * rad;
        if (!physSpotOk(x, z, radius, false)) continue;
        if (a < 56 && physCrowded(x, z, radius + 1.1)) continue;
        if (physMakeProp(type, x, z, 0, undefined)) placed++;
        break;
      }
    }
  }
  return placed;
}

/**
 * Scatter one chapter's lists. Every candidate is put through physSpotOk, which
 * asks the LIVE biome, so water, buildings and anything else that biome calls
 * blocked are all refused for free — a missing bin is always better than a bin
 * inside a façade, which is also why a badly chosen centre costs coverage and
 * never correctness.
 *
 * ---- ONE CLUSTER WAS NOT A SANDBOX (v51) ---------------------------------
 * MEASURED, all nineteen chapters, live props by `p.biome`: Sydney 49, Pasto
 * 24, Monaco 20, Hanoi 16 — and 8 to 11 in the other fifteen, every one of them
 * inside a single annulus 13 to 26 m across. So outside that one cluster there
 * was NOTHING LOOSE IN THE WORLD, and a player who walked two streets ran out
 * of things to touch. Forty-five seconds of active free play measured ZERO prop
 * impacts in Kyoto, Cali, Rio, the Drift, the cave and the Pantanal.
 *
 * It shows worst at the arrival, which is the worst place for it to show:
 * props within 20 m of the spawn were 0 in Cali, the Pantanal, Sơn Đoòng and
 * Hanoi, and 1 in Kyoto and Monaco. Sydney's is 9. The first minute of six
 * chapters was a room with nothing in it.
 *
 * So a row may name a SECOND annulus, `also`, and sixteen do. Three rules, and
 * the first two are the ones the first annulus was already held to:
 *
 *  1. IT IS CENTRED ON A PERSON. Ownership is by where a prop LIVES — within
 *     npcOWN_R (11 m) of its home — so an annulus on empty ground is a
 *     guarantee that nothing belongs to anybody and the ownership chase cannot
 *     fire. Every centre below is a position measured off that chapter's own
 *     `game.locals`, not a coordinate somebody liked the look of.
 *  2. NOTHING IS FROM THE WRONG KIND OF PLACE. Same list as the chapter's own
 *     first annulus, or a subset of it. No new geometry, no new types.
 *  3. IT GOES WHERE THE FIRST ONE IS NOT. Every second centre is at least
 *     twenty-five metres from the first, and where a chapter had nobody's
 *     belongings at the arrival, that is where it goes.
 *
 * THE DRIFT IS THE ONE THAT DOES NOT GET ONE, and deliberately: its nine props
 * are one household's, its islands are forty metres of sky apart at different
 * altitudes, and the long note on its row above is an argument for exactly one
 * cluster. Sydney and Pasto do not need one.
 */
function physScatterBiome(name) {
  const def = physBIOME_SCATTER[name];
  if (!def || physBiomeScattered[name]) return;
  physBiomeScattered[name] = true;
  let placed = physScatterRing(def);
  // `also` may be one annulus or a list of them (B5). It was one because one
  // was enough for the fourteen chapters that wanted a second cluster; Hanoi
  // wants a third, because its two are 88 m and 154 m from the spawn and the
  // place you actually land has nothing loose in it at all.
  if (Array.isArray(def.also)) {
    for (let i = 0; i < def.also.length; i++) placed += physScatterRing(def.also[i]);
  } else if (def.also) placed += physScatterRing(def.also);
  // Placed resting on their own surface, so there is nothing to solve.
  const arr = physGame.props;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.biome !== name || p.body.type !== CANNON.Body.DYNAMIC) continue;
    p.body.velocity.set(0, 0, 0);
    p.body.angularVelocity.set(0, 0, 0);
    p.body.force.set(0, 0, 0);
    p.body.torque.set(0, 0, 0);
    p.body.sleep();
  }
  return placed;
}

// ===========================================================================
// THINGS THAT TURN UP (L8, F4) — a random, VALIDATED ground point for a drop.
// ===========================================================================
//
// The same machinery physScatterRing already trusts in all seventeen chapters
// that carry a `physBIOME_SCATTER` row: an annulus (or one of a chapter's two,
// picked at random so drops spread across both clusters the way the scatter
// itself does), physSpotOk for water/nav-blocked, physCrowded for the nicety.
// No new placement algorithm — the roadmap's own instruction, followed.
//
// SYDNEY (chapter 1) AND PASTO (chapter 2) HAVE NO ROW HERE. Sydney's own
// arrival scatter is a fixed rect (physScatterQuay, chapter 3's `quay` is the
// one with a `physBIOME_SCATTER` entry — see "Quay is two places"); Pasto's is
// a stall menu (physScatterPasto), not a ring. Both already publish named
// zones through `env.randomPointIn` — physFindSpot already knows how to use
// one — so those two chapters route through a zone instead of an annulus this
// feature would otherwise have to invent from nothing.
const physDropZONE_FALLBACK = {
  sydney: ['promenade', 'picnic', 'gardens', 'operaStage'],
  pasto: ['plaza', 'market', 'street'],
};
function physDropSpot(biome, radius) {
  const zones = physDropZONE_FALLBACK[biome];
  if (zones) {
    const zone = zones[randInt(0, zones.length - 1)];
    const spot = physFindSpot(zone, radius);
    return spot.ok ? { x: spot.x, z: spot.z } : null;
  }
  const def = physBIOME_SCATTER[biome];
  if (!def) return null;
  let ring = def;
  if (def.also) {
    const list = Array.isArray(def.also) ? def.also.concat([def]) : [def, def.also];
    ring = list[randInt(0, list.length - 1)];
  }
  for (let a = 0; a < 40; a++) {
    const ang = rand(0, Math.PI * 2);
    const rad = Math.sqrt(rand(ring.r0 * ring.r0, ring.r1 * ring.r1));
    const x = ring.x + Math.cos(ang) * rad, z = ring.z + Math.sin(ang) * rad;
    if (!physSpotOk(x, z, radius, false)) continue;
    if (a < 32 && physCrowded(x, z, radius + 0.8)) continue;
    return { x: x, z: z };
  }
  return null;
}

/**
 * A second point 4-8 m from (x0, z0), same validation — the twin's pair
 * (F4.2). There is no ring to draw it from — the twin's second fruit is
 * defined relative to the first, not to the chapter's own centre — so this
 * is a small local search rather than a call back into physDropSpot.
 */
function physDropSpotNear(x0, z0, minD, maxD, radius) {
  for (let a = 0; a < 40; a++) {
    const ang = rand(0, Math.PI * 2);
    const rad = rand(minD, maxD);
    const x = x0 + Math.cos(ang) * rad, z = z0 + Math.sin(ang) * rad;
    if (!physSpotOk(x, z, radius, false)) continue;
    if (a < 32 && physCrowded(x, z, radius + 0.8)) continue;
    return { x: x, z: z };
  }
  return null;
}

let physQuayScattered = false;
function physScatterQuay() {
  if (physQuayScattered) return;
  physQuayScattered = true;
  for (let i = 0; i < physQUAY_SCATTER.length; i++) {
    const type = physQUAY_SCATTER[i][0];
    const radius = physPropRadius(type);
    for (let n = 0; n < physQUAY_SCATTER[i][1]; n++) {
      for (let a = 0; a < 48; a++) {
        const x = rand(physQUAY.x0, physQUAY.x1);
        const z = rand(physQUAY.z0, physQUAY.z1);
        if (!physSpotOk(x, z, radius, false)) continue;
        if (a < 40 && physCrowded(x, z, radius + 0.9)) continue;
        physMakeProp(type, x, z, 0, undefined);
        break;
      }
    }
  }
}

/**
 * WHERE A THROWN PROP ACTUALLY LANDS (B10, item 4b).
 *
 * capybara.js draws a mark on the ground at full charge and the first cut put
 * it at the vacuum-ballistic range, which for a sun hat leaving at 11.0 m/s
 * across and 9.7 up under g = 24 is 9.30 m. **The hat lands at 3.05 m.** Air
 * drag takes two thirds of the throw, and it is quadratic, so the error grows
 * with the charge — the mark would have been most wrong exactly where a player
 * was looking hardest at it.
 *
 * So the predictor is here, in the file that owns the drag law and the
 * gravity, rather than as a copy of `physAERO_AMAX` and the aero terms in
 * capybara.js. Same rule as `sayNear` and `peopleNear`: a question about a
 * module's physics is answered by that module.
 *
 * Forward Euler at a fixed 40 Hz for at most two seconds of flight. It is the
 * same integration the solver does, at a third of the rate, and it costs about
 * eighty multiplies on the frames a charge is being held.
 */
function physPredictLanding(prop, vx, vy, vz, x, y, z, groundY) {
  const g = physGame.world ? -physGame.world.gravity.y : 24;
  const m = (prop && prop.mass > 0) ? prop.mass : 0.5;
  const k = (prop && prop.aeroK > 0) ? prop.aeroK : 0;
  const h = 1 / 40;
  let px = x, py = y, pz = z;
  for (let i = 0; i < 80; i++) {
    // The air is not moving in this prediction. A gust is a surprise, and a
    // mark that jittered with the wind would be unreadable — the wind is what
    // makes the throw funny rather than what makes it aimable.
    const sp2 = vx * vx + vy * vy + vz * vz;
    if (k > 0 && sp2 > 0.36) {
      const sp = Math.sqrt(sp2);
      let f = k * sp;
      const fCap = (physAERO_AMAX * m) / sp;
      if (f > fCap) f = fCap;
      const a = (f / m) * h;
      vx -= a * vx; vy -= a * vy; vz -= a * vz;
    }
    vy -= g * h;
    px += vx * h; py += vy * h; pz += vz * h;
    if (py <= groundY) break;
  }
  return { x: px, y: py, z: pz };
}

function physScatter() {
  for (let i = 0; i < physSCATTER.length; i++) {
    const row = physSCATTER[i];
    const zone = row[0];
    const type = row[1];
    const radius = physPropRadius(type);
    for (let n = 0; n < row[2]; n++) {
      const spot = physFindSpot(zone, radius);
      if (!spot.ok) continue;          // skip rather than place it badly
      physMakeProp(type, spot.x, spot.z, type === 'flower' ? randInt(0, 2) : 0, undefined);
    }
  }
  physScatterQuay();
  // Everything above was placed resting on its own surface, so there is nothing
  // to solve: settle the whole scatter immediately. Cannon wakes any of them the
  // instant something touches it, and until then they cost the solver nothing.
  const arr = physGame.props;
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i].body;
    if (b.type !== CANNON.Body.DYNAMIC) continue;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.force.set(0, 0, 0);
    b.torque.set(0, 0, 0);
    b.sleep();
  }
}

// ===========================================================================
// 4. GRAB / RELEASE
// ===========================================================================
function physGrab(prop) {
  if (!prop || prop.removed || prop.held || !prop.grabbable) return false;
  // TAKING IT BACK OUT (B9). Done here rather than at the call site because
  // there are four of those and every one of them would have to know about
  // vessels; the ride ends the moment the thing is in the mouth, which is the
  // same rule the owner-retrieval and the theft both take.
  if (prop.inVessel) physVesselEject(prop.inVessel, 'taken');
  const capy = physGame.capy;
  const anchor = capy && capy.mouthAnchor;
  if (!anchor) return false;
  // A prop in the mouth is driven by physUpdateHeld, which damps the scale back
  // to 1 on its own and knows nothing about the squash spring. Cleared here so
  // the spring cannot carry a stale value across the pickup and re-apply it the
  // moment the thing is dropped.
  physSquashClear(prop);
  if (capy.heldProp && capy.heldProp !== prop) physRelease(null);

  const b = prop.body;
  b.type = CANNON.Body.KINEMATIC;
  b.updateMassProperties();
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.force.set(0, 0, 0);
  b.torque.set(0, 0, 0);
  // Stay solid against other props (so a carried sign can flatten a bin) but
  // pass straight through ground, walls and people so nothing ever jams.
  b.collisionResponse = true;
  b.collisionFilterMask = physGRP_DYN;
  b.allowSleep = false;
  b.wakeUp();

  prop.mesh.getWorldPosition(physV1);
  prop.mesh.getWorldQuaternion(physQ1);
  anchor.updateWorldMatrix(true, false);
  anchor.add(prop.mesh);
  prop.mesh.position.copy(physV1);
  anchor.worldToLocal(prop.mesh.position);
  anchor.getWorldQuaternion(physQ2);
  physQ2.invert();
  prop.mesh.quaternion.copy(physQ2).multiply(physQ1);
  prop.pop = 1.18;
  prop.mesh.scale.setScalar(1.18);

  // NOTE: prop.owner is deliberately LEFT SET here. capybara.js is the contract
  // owner of 'capy:grab' and emits it immediately after this call; npc.js's
  // subscriber needs an intact owner to start the chase. It clears it itself.
  // ---- ...AND A HAT YOU KNOCKED OFF FIRST IS STILL A HAT YOU STOLE --------
  //
  // `prop.owner` alone is not the question. `physBarge` — which fires whenever
  // the capybara touches a carried prop above 3.2 m/s, i.e. the moment you run
  // into anybody — takes the thing out of their hands, records `stolenFrom`,
  // and CLEARS `owner`. So the whole knock-it-off-and-pick-it-up route arrived
  // here with `prev === null`: `wasStolen` was never set, the 'capy:grab'
  // payload carried no victim so npc.js's listener fell straight out without
  // ticking 'steal-hat', and because 'hat-harbour' gates on `wasStolen` that
  // hat could never be carried into the harbour for the checklist either — for
  // the rest of the session, silently. Measured walking up to a tourist: the
  // animal ends up holding the hat, and neither line ticks.
  //
  // The rule is the one `earnedSpill` already uses for 'coffee-spill' twelve
  // lines further down — owner OR stolenFrom, behind the causation window — so
  // a prop somebody ELSE knocked over, or one that has been lying on the lawn
  // since the last chapter, is still not yours. npc.js clears `stolenFrom` the
  // moment the victim gets it back, so a retrieved hat is clean again.
  const prev = prop.owner ||
    (prop.stolenFrom && physCausedByCapy(prop, physCAUSE_SNATCH) ? prop.stolenFrom : null);
  prop.held = true;
  prop.frozen = false;
  prop.inWater = false;
  physDryOut(prop);
  b.allowSleep = false;
  if (prev) {
    prop.stolenFrom = prev;
    if (prop.type === 'hat') prop.wasStolen = true;
  }
  capy.heldProp = prop;
  // Fired here for the same reason as 'capy:drop' above. prop.owner is deliberately
  // still set, and `from` carries the victim, so npc.js can start the outrage chase
  // and tick 'steal-hat' whichever field it reads.
  physGrabPayload.prop = prop;
  physGrabPayload.from = prev || null;
  // ---- ...AND WHETHER ITS FEET WERE ON THE GROUND (THE SNATCH) -----------
  // MEASURED FIRST, because the feature this feeds was proposed on the premise
  // that it was impossible: `qa/nr-verbs.js` hops the animal, presses the key
  // at 0.88 m off the ground, and gets the prop. There is no `grounded` gate
  // anywhere on the grab and there never was — taking something out of the air
  // has always worked, and nothing in nineteen chapters has ever noticed.
  //
  // One field on a payload that is already allocated once and rewritten in
  // place. capybara.js owns the animal's state and props.js owns the event, so
  // this is read rather than passed in: adding an argument to physGrab would
  // touch six call sites for a fact the callee can see for itself.
  physGrabPayload.air = !!(capy && capy.grounded === false);
  physGame.events.emit('capy:grab', physGrabPayload);
  physStampTouch(prop);
  prop.lastWX = b.position.x;
  prop.lastWY = b.position.y;
  prop.lastWZ = b.position.z;
  physSetSolo(prop, true);
  // WHEN it went in the mouth. The getaway is the only reader; it is stamped on
  // every grab and never cleared, because `held` is what says whether the clock
  // means anything and a stale stamp on a prop lying in a canal is harmless.
  prop.grabTime = physGame.state ? physGame.state.time : 0;
  // ---- ARMED, NOT TICKED (M7). See THE GETAWAY. ------------------------
  // These three were the whole of this file's theft ticking and they fired on
  // the frame the prop was taken. They now stand for a row until the animal is
  // clear of where the thing lived — and re-arm on every grab, so nothing here
  // can be lost.
  //
  // `empanada` is NOT here, and was: `physTask('steal-empanada')` fired on any
  // grab of one, which quietly defeated the deferral npc.js's F4 built for that
  // exact row — "the joke is being seen doing it". Two owners, one row, and the
  // looser of the two won every time. Pasto owns that row; this file owns the
  // getaway it now goes through.
  if (prop.type === 'sandwich') physArmTheft('picnic-thief', prop);
  else if (prop.type === 'ruana') physArmTheft('ruana-thief', prop);
  return true;
}

function physRelease(impulse) {
  const capy = physGame.capy;
  const prop = capy && capy.heldProp;
  if (!prop) return;
  const m = prop.mesh;
  const b = prop.body;

  m.getWorldPosition(physV1);
  m.getWorldQuaternion(physQ1);
  physGame.scene.add(m);
  m.position.copy(physV1);
  m.quaternion.copy(physQ1);
  m.scale.setScalar(1);

  b.position.set(physV1.x, physV1.y + 0.02, physV1.z);
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  physSyncBodyTransform(b);
  b.type = CANNON.Body.DYNAMIC;
  b.updateMassProperties();
  b.collisionResponse = true;
  b.collisionFilterMask = -1;
  physDryOut(prop);
  b.wakeUp();

  const cv = capy.velocity;
  b.velocity.set(
    (cv ? cv.x : 0) * 1.05,
    Math.max(cv ? cv.y : 0, 0) * 0.35 + 0.7,
    (cv ? cv.z : 0) * 1.05
  );
  if (impulse) {
    physCV1.set(impulse.x, impulse.y, impulse.z);
    b.applyImpulse(physCV1);
  }
  const sp = prop.spin;
  b.angularVelocity.set(rand(-6, 6) * sp, rand(-5, 5) * sp, rand(-6, 6) * sp);

  prop.held = false;
  prop.owner = null;          // safety net if npc.js never saw the theft
  prop.inWater = false;
  physStampTouch(prop);
  prop.releaseTime = physGame.state.time;   // the capybara owns what happens next
  // ...and this one only if there was a launch vector. physPutIn calls this
  // function with null to get the held-state transition for free, and a prop
  // lowered into a basket has not been thrown at anybody.
  if (impulse) {
    prop.thrownT = physGame.state.time; physThrowN++;
    // ...and from where (L4, E4): THE LONG SHOT is a throw that lands in
    // water more than ten metres from here, and nothing kept the origin.
    prop.throwX = b.position.x; prop.throwZ = b.position.z;
  }
  capy.heldProp = null;
  physSetSolo(prop, false);
  // Only a real throw arms a spill — setting a cup down gently leaves it intact.
  if (impulse && physTYPES[prop.type].spill && !prop.spilled) prop.spillArmed = true;
  // Emitted HERE, not in capybara.js: both modules deferred to the other and the
  // event was never fired at all, leaving npc.js and systems.js listening forever.
  physDropPayload.prop = prop;
  physGame.events.emit('capy:drop', physDropPayload);
}

// ===========================================================================
// A THING INSIDE A THING (B9, item 4a)
// ===========================================================================
//
// The colliders in this file are SOLID BOXES — a bin is a 0.4 × 0.56 × 0.4
// block, not a shell — so "drop it in and let the solver hold it there" puts
// the sandwich on the bin's lid and nothing else. A vessel's contents are
// therefore carried rather than contained: one prop per vessel, its body
// kinematic and out of the collision set, its transform written from the
// vessel's every frame. That is the same one level of frame the roadmap asks
// for, and it is what makes "a prop placed in another travels with it" free —
// pick the basket up and the thing in it comes too, because it was never
// resting on anything.
//
// It leaves on any of five things, which is the whole of the contract:
// the vessel is picked up by somebody, tipped past physPUT_TIP, hidden,
// destroyed or spilled; or the contents are taken back out.

/** The nearest thing you could put something IN, or null. */
function physVesselNear(pos, r, exclude) {
  const arr = physGame.props;
  const live = physLiveBiome();
  let best = null, bd = (r || physPUT_R) * (r || physPUT_R);
  for (let i = 0; i < arr.length; i++) {
    const q = arr[i];
    if (!q || q === exclude || q.removed || q.hidden || q.held || q.spilled) continue;
    if (q.biome && q.biome !== live) continue;
    const def = physTYPES[q.type];
    if (!def || !def.vessel) continue;
    if (q.contents) continue;                 // one at a time
    const b = q.body;
    const dx = b.position.x - pos.x, dz = b.position.z - pos.z;
    const d2 = dx * dx + dz * dz;
    if (d2 >= bd) continue;
    // NEVER SNAP TO A CONTAINER THE ANIMAL IS STANDING IN — the trap item 4
    // names. The test is the vessel's own FOOTPRINT and not a height, and the
    // reason is measured: the first cut refused the put-down when the animal's
    // position was above the vessel's mouth, which is true of a Venetian bin
    // standing on a quay (mouth 1.35, animal 1.54) because `capy.position` is
    // the body's CENTRE, about 0.4 m above its feet. It read as a feature that
    // works in one chapter of three. Inside the footprint you are on it or in
    // it; outside it you are beside it, whatever the heights are doing.
    const half = Math.max(0.30, Math.max(def.shape[1] || 0, def.shape[3] || 0) * 1.05);
    if (d2 < half * half) continue;
    bd = d2; best = q;
  }
  return best;
}

/** Set the held prop down INTO `vessel`. Returns false if it could not. */
function physPutIn(vessel) {
  const capy = physGame.capy;
  const prop = capy && capy.heldProp;
  if (!prop || !vessel || vessel === prop || vessel.contents) return false;
  const def = physTYPES[vessel.type];
  if (!def || !def.vessel) return false;
  // physRelease owns every other part of the held-state transition — the
  // reparent, the `capy:drop` emit, the sfx, clearing `owner`. Calling it with
  // no impulse gives a set-down (which is also why a cup put down gently does
  // not arm its spill), and the ride is attached immediately afterwards, in
  // the same frame, so nothing ever sees the prop loose on the ground.
  physRelease(null);
  physVesselTake(vessel, prop);
  physSfxOpts.volume = 0.5;
  physStampVoice(prop);
  physSfxOpts.at = null;
  physGame.sfx('thud', physSfxOpts);
  return true;
}

function physVesselTake(vessel, prop) {
  const b = prop.body;
  vessel.contents = prop;
  prop.inVessel = vessel;
  // The offset is in the VESSEL'S frame, so the contents lean with it rather
  // than hovering upright over a tipping bin.
  prop.vesselOff = {
    y: vessel.originY + physPUT_UP + prop.originY,
  };
  b.type = CANNON.Body.KINEMATIC;
  b.updateMassProperties();
  b.collisionResponse = false;
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.wakeUp();
  prop.grabbable = physTYPES[prop.type].grabbable !== false;
  physVesselSync(prop);
}

/** Hand the contents back to the simulation. `why` is for the caller's sake. */
function physVesselEject(vessel, why) {
  const prop = vessel && vessel.contents;
  if (!prop) return null;
  vessel.contents = null;
  prop.inVessel = null;
  prop.vesselOff = null;
  const b = prop.body;
  b.type = CANNON.Body.DYNAMIC;
  b.updateMassProperties();
  b.collisionResponse = true;
  b.collisionFilterMask = -1;
  // Inherit the vessel's motion, or a bin kicked down a hill leaves its
  // contents standing in the air where the bin used to be. A vessel that has
  // been removed outright still has a body; one day something will call this
  // without one, and 0.4 up is the same set-down every other path uses.
  const vb = vessel.body;
  if (vb) b.velocity.set(vb.velocity.x, Math.max(vb.velocity.y, 0.4), vb.velocity.z);
  else b.velocity.set(0, 0.4, 0);
  b.angularVelocity.set(rand(-3, 3), rand(-3, 3), rand(-3, 3));
  physStampTouch(prop);
  prop.releaseTime = physGame.state ? physGame.state.time : 0;
  b.wakeUp();
  // A thing coming back out of a bin is a thing that was thrown, for the
  // purposes of the one flag that decides whether a cup gives up its coffee.
  if (why === 'tip' && physTYPES[prop.type].spill && !prop.spilled) prop.spillArmed = true;
  return prop;
}

function physVesselSync(prop) {
  const v = prop.inVessel;
  if (!v) return;
  const vb = v.body;
  const b = prop.body;
  physQ1.set(vb.quaternion.x, vb.quaternion.y, vb.quaternion.z, vb.quaternion.w);
  physV1.set(0, prop.vesselOff.y, 0).applyQuaternion(physQ1);
  b.position.set(vb.position.x + physV1.x, vb.position.y + physV1.y, vb.position.z + physV1.z);
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  physSyncBodyTransform(b);
  prop.mesh.position.set(b.position.x, b.position.y, b.position.z);
  prop.mesh.quaternion.copy(physQ1);
}

function physUpdateInVessel(prop, dt) {
  const v = prop.inVessel;
  if (!v || v.removed || v.hidden || v.spilled) { physVesselEject(v || { contents: prop }, 'gone'); return; }
  if (v.held || v.owner) {
    // Somebody has picked the vessel up. The contents keep riding — that is
    // the joke — but physUpdateHeld drives the vessel's MESH and leaves the
    // body behind, so the ride is taken off the mesh's world transform here.
    v.mesh.getWorldPosition(physV2);
    v.mesh.getWorldQuaternion(physQ2);
    physQ1.copy(physQ2);
    physV1.set(0, prop.vesselOff.y, 0).applyQuaternion(physQ1);
    const b = prop.body;
    b.position.set(physV2.x + physV1.x, physV2.y + physV1.y, physV2.z + physV1.z);
    b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
    physSyncBodyTransform(b);
    prop.mesh.position.set(b.position.x, b.position.y, b.position.z);
    prop.mesh.quaternion.copy(physQ1);
    return;
  }
  // TIPPED. `physUp` rotated by the vessel's quaternion, against straight up.
  physQ1.set(v.body.quaternion.x, v.body.quaternion.y, v.body.quaternion.z, v.body.quaternion.w);
  physV1.set(0, 1, 0).applyQuaternion(physQ1);
  if (physV1.y < Math.cos(physPUT_TIP)) { physVesselEject(v, 'tip'); return; }
  physVesselSync(prop);
}

/** Lets npc.js hand a carried prop back to the simulation. */
function physDropOwned(prop, vx, vy, vz) {
  if (!prop || prop.held || prop.spilled || prop.removed) return;
  const m = prop.mesh;
  const b = prop.body;
  m.getWorldPosition(physV1);
  m.getWorldQuaternion(physQ1);
  physGame.scene.add(m);
  m.position.copy(physV1);
  m.quaternion.copy(physQ1);
  m.scale.setScalar(1);
  b.position.set(physV1.x, physV1.y, physV1.z);
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  physSyncBodyTransform(b);
  b.type = CANNON.Body.DYNAMIC;
  b.updateMassProperties();
  b.collisionResponse = true;
  b.collisionFilterMask = -1;
  prop.inWater = false;
  physDryOut(prop);
  b.wakeUp();
  b.velocity.set(vx || 0, vy || 0.5, vz || 0);
  b.angularVelocity.set(rand(-4, 4), rand(-4, 4), rand(-4, 4));
  prop.owner = null;
  prop.frozen = false;
  prop.grabbable = physTYPES[prop.type].grabbable !== false && !prop.planted && !prop.spilled;
  physSetSolo(prop, false);
  if (physTYPES[prop.type].spill && !prop.spilled) prop.spillArmed = true;
}

function physNearestGrabbable(pos, radius) {
  if (!pos) return null;
  const arr = physGame.props;
  const r = radius === undefined ? 2 : radius;
  let best = null;
  let bestD = r * r;
  const live = physLiveBiome();
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.removed || p.held || !p.grabbable) continue;
    // Detached biomes' props keep their frozen positions in the one shared
    // coordinate space — without this filter an invisible Sydney sandwich is
    // grabbable from the middle of Cali (and ticks picnic-thief there).
    if (p.biome && p.biome !== live) continue;
    let x;
    let y;
    let z;
    if (p.owner) {
      p.mesh.getWorldPosition(physV2);
      x = physV2.x; y = physV2.y; z = physV2.z;
    } else {
      x = p.body.position.x; y = p.body.position.y; z = p.body.position.z;
    }
    const dx = x - pos.x;
    const dy = (y - pos.y) * 0.6;
    const dz = z - pos.z;
    const d = dx * dx + dy * dy + dz * dz;
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// ===========================================================================
// 5. REACTIONS
// ===========================================================================
// ---- causation ------------------------------------------------------------
/** Marks a prop as "the capybara did this to it, just now". */
function physStampTouch(prop) {
  if (!prop) return;
  prop.disturbed = true;
  prop.lastCapyTouch = physGame.state ? physGame.state.time : 0;
}

/** True if `body` is the capybara, its cargo, or something it just threw. */
function physIsCapyAgent(body) {
  if (!body) return false;
  const capy = physGame.capy;
  if (capy && body === capy.body) return true;
  const other = physBodyToProp.get(body.id);
  if (!other) return false;
  if (other.held) return true;
  if (!physGame.state) return false;
  return (physGame.state.time - other.releaseTime) < physCAUSE_TIP;
}

/**
 * ---- CAUSATION TRAVELS ONE HOP, AND ITS CLOCK DOES NOT RESTART (v53) ------
 *
 * Knocking a bin into a crate is the oldest joke in this genre and the crate
 * was not, by this file's reckoning, anything to do with you: `disturbed` was
 * stamped only where the CAPYBARA touched, so a knock-on was an act of god.
 *
 * It shows up as an almost unreachable incident chain. Measured over 75 s of
 * driven play in Sydney: nineteen impacts over sysINC_HIT, and **two** of them
 * on a prop with `disturbed` set — so the chain, which needs three witnessed
 * things inside twelve seconds, essentially could not start, and the only
 * repeatable reward in the game fires once or twice in eight hours.
 *
 * THE CLOCK IS THE WHOLE SAFETY ARGUMENT. The struck prop inherits the
 * striker's `lastCapyTouch` rather than taking the current time, so causation
 * DECAYS from the moment the animal actually did something and cannot be
 * renewed by propagation. A daisy-chain across six crates is still measured
 * against the one shove that started it, and once physCAUSE_TIP has passed
 * nothing further propagates — which is what stops `physCausedByCapy`, the
 * gate every completeTask in this file goes through, from becoming looser than
 * it reads. A prop that topples on its own an hour later still earns nothing.
 */
function physCarriesCause(body) {
  if (!body || !physGame.state) return null;
  const other = physBodyToProp.get(body.id);
  if (!other || !other.disturbed) return null;
  const t = physGame.state.time;
  if (t - other.lastCapyTouch >= physCAUSE_TIP && t - other.releaseTime >= physCAUSE_TIP) return null;
  return other;
}

/**
 * The single gate every completeTask call in this file goes through. A prop
 * that tips, spills or drifts into the harbour on its own earns nothing.
 */
function physCausedByCapy(prop, win) {
  if (!physGame.state || physGame.state.time < physTASK_GRACE) return false;
  if (!prop.disturbed) return false;
  if (prop.held) return true;
  const t = physGame.state.time;
  return (t - prop.lastCapyTouch) < win || (t - prop.releaseTime) < win;
}

function physOnCollide(prop, e) {
  // Stamp causation BEFORE any speed gate: a slow shove that eventually topples
  // a bin is still the capybara's doing, and must be credited as such.
  if (physIsCapyAgent(e.body)) physStampTouch(prop);
  else {
    // ...and one hop further, on the striker's clock. See physCarriesCause.
    const src = physCarriesCause(e.body);
    if (src) {
      prop.disturbed = true;
      const inherited = Math.max(src.lastCapyTouch, src.releaseTime);
      if (inherited > prop.lastCapyTouch) prop.lastCapyTouch = inherited;
    }
  }
  if (prop.held || prop.frozen || prop.hidden) return;
  const c = e.contact;
  if (!c) return;
  const speed = Math.abs(c.getImpactVelocityAlongNormal());
  if (speed < physIMPACT_MIN) return;
  const t = physGame.state.time;
  if (t - prop.lastImpact < 0.12) return;
  prop.lastImpact = t;

  physImpactPayload.prop = prop;
  physImpactPayload.speed = speed;
  physStampVoice(prop);
  physSquashHit(prop, speed);
  physFlash(prop, speed);
  physImpactPayload.position.set(prop.body.position.x, prop.body.position.y, prop.body.position.z);
  // Presentation (thud + shake) belongs to systems.js's 'prop:impact' handler —
  // firing it here too double-shakes and flanges the sample.
  physGame.events.emit('prop:impact', physImpactPayload);
  // AFTER the emit and not before it: systems.js's own 'prop:impact' handler is
  // what opens the incident (sysINC_HIT is 2.6 m/s and `disturbed` is stamped at
  // the top of this function), so by the time the startle fires the chain has
  // already counted the bang. Reversing these two would make the person jump
  // before the thing that startled them was reported.
  physPersonHit(prop, e, speed);
  if (speed > 5) {
    physDust3(prop.body.position.x, prop.body.position.y - prop.originY * 0.5, prop.body.position.z, 3);
  }

  // Bin chicken: a low capybara shoulder-barge mostly slides a 9kg bin. Convert
  // the hit into an off-centre impulse so it actually goes over.
  if (prop.type === 'bin' && !prop.tipped && speed > 3.5 &&
      physGame.capy && e.body === physGame.capy.body && c.ni) {
    const push = speed * 1.4;
    // c.ni points bi->bj and which body is bi is arbitrary: resolve the sign
    // so the impulse always sends the bin away from the capybara.
    const away = (c.bi === prop.body) ? -1 : 1;
    physCV1.set(c.ni.x * away * push, 0.3 * push, c.ni.z * away * push);
    prop.body.wakeUp();
    prop.body.applyImpulse(physCV1, physCV2);
  } else if (!prop.tipped && speed > physBARGE_MIN &&
             physGame.capy && e.body === physGame.capy.body && c.ni) {
    // ---- ...AND SO IS EVERYTHING ELSE ON THE STREET ---------------------
    //
    // THE BARGE. The branch above has been the only thing in this game that
    // knew the difference between walking into something and RUNNING into it,
    // and it knew it about one prop type out of thirty-eight. Every other prop
    // was moved by the solver alone, which — with a frictionless capy contact
    // and a low, wide animal — mostly means it slides a hand's width and stops.
    //
    // This is that idea generalised, and the one thing it must not do is turn
    // the street into a bowling alley. So:
    //
    //   the impulse is SCALED BY THE PROP'S OWN MASS, which makes it a change
    //   in VELOCITY rather than a change in momentum: a straw hat and a market
    //   crate get the same metres per second out of the same barge, and neither
    //   of them gets launched;
    //
    //   the velocity it grants is capped at physBARGE_DV, which is under half a
    //   walk. It is a shove, not a punt;
    //
    //   it only fires above physBARGE_MIN, which is above the closing speed a
    //   walk produces — a considered approach still just pushes;
    //
    //   and it goes through physCV2, the same off-centre lever the bin uses, so
    //   a tall prop tips and a low one skids, which is what those shapes do.
    //
    // A stall you have to RUN AT is a different verb from a stall you walk into
    // and push, and this is the whole of it.
    const m = prop.body.mass > 0 ? prop.body.mass : 1;
    const dv = clamp((speed - physBARGE_MIN) * physBARGE_K, 0, physBARGE_DV) * m;
    const away = (c.bi === prop.body) ? -1 : 1;
    physCV1.set(c.ni.x * away * dv, physBARGE_UP * dv, c.ni.z * away * dv);
    prop.body.wakeUp();
    prop.body.applyImpulse(physCV1, physCV2);
  }

  // Ceramic does not negotiate. A set-down is ~2 m/s; physSHATTER_MIN is the
  // impact speed of a drop from roughly head height at this gravity.
  if (prop.fragile && speed > physSHATTER_MIN) { physShatter(prop); return; }

  if (!prop.spilled && speed > physSPILL_MIN && physTYPES[prop.type].spill) physSpill(prop);
}

/**
 * ---- ...AND IF IT HITS SOMEBODY, THAT IS A DIFFERENT EVENT ----------------
 *
 * One rule, in the one place every prop collision in the game already passes
 * through. See the block above physHIT_WINDOW for why each gate is there.
 *
 * WHAT IT DOES NOT DO, and this is the whole of the safety argument:
 *
 *   it invents no state. `startlePeople` is npc.js's own published sweep (main
 *   .js:1903), and until now systems.js's herd loop was its only caller. It
 *   reaches `locals` in all nineteen chapters and `humans`/`paHumans` in the
 *   two that have a walking cast, and everything downstream of it — the flinch
 *   spring, the line, the witness chain, the `npc:startled` that systems.js
 *   turns into a gasp and chaos — is code that has been running for versions.
 *
 *   it does not open a channel of its own. The incident was already opened by
 *   the `prop:impact` emit four lines above the call site, which is where it
 *   belongs: systems.js gates that on `disturbed` and on sysINC_HIT (2.6 m/s),
 *   both of which a thrown prop clears by construction, and `incSeen` already
 *   dedupes on the prop's id — so throwing the same orange at the same market
 *   twice in a row cannot ratchet the chain. Nothing new is counted here.
 *
 *   and it cannot cost the player a task. Three layers, deliberately:
 *
 *     npc.js's `startle` returns immediately for anybody with `carryT >= 0`,
 *     and routes anybody holding a drink to 'fluster' or 'lookAt' rather than
 *     'flee' — the cast has protected its carriers since v19;
 *
 *     `localsReact` never MOVES a local at all. It is a flinch spring and a
 *     line, so in the seventeen chapters whose only people are fixed locals the
 *     reaction is by construction non-destructive — nobody can run away with
 *     anything because nobody runs;
 *
 *     and on top of both, the two states in which a person is actually
 *     executing a task-shaped errand — `carryT`, the delivery walk, and `own`,
 *     the retrieval errand F4 pins the stolen prop to — take the lens kick and
 *     the line and NOT the sweep. That costs the bystanders their jump in a
 *     case that is rare, and it is the right way round: a startle that fires
 *     and should not have is a bug you find in an hour, and a task that became
 *     unwinnable is one you find in a bug report six weeks later.
 */
function physPersonHit(prop, e, speed) {
  if (speed < physHIT_MIN) return;
  const b = e.body;
  const ud = b && b.userData;
  const who = ud && (ud.npc || ud.local);
  if (!who) return;
  // In a mouth, in a hand or in a basket: KINEMATIC and, in the last two
  // cases, out of the collision set entirely. Not a thing in flight.
  if (prop.body.type !== CANNON.Body.DYNAMIC) return;
  const t = physGame.state ? physGame.state.time : 0;
  if (t - prop.thrownT >= physHIT_WINDOW) return;
  // SPENT HERE, before the cooldown is read and not after it. A prop that hit
  // somebody is a prop whose throw is over, whether or not this one paid out —
  // otherwise a refused hit leaves the mark armed and the ricochet off the
  // shoulder into the person behind pays out instead, half a second later.
  prop.thrownT = -1e9;
  if (t - physHitT < physHIT_COOL) { physHitBlocked++; return; }
  physHitT = t;
  physHitN++;

  const px = b.position.x, pz = b.position.z;
  // The lens knows it connected. Scaled by how hard, capped well under the
  // punch a bin going over already gets — this is a mango, not a collision.
  if (typeof physGame.punch === 'function') {
    physGame.punch(Math.min(physHIT_PUNCH + (speed - physHIT_MIN) * physHIT_PUNCH_K,
                            physHIT_PUNCH_MAX));
  }
  // The third layer of the carrier guard. See the note above.
  const busy = (who.carryT >= 0) || !!who.own;
  if (!busy && typeof physGame.startlePeople === 'function') {
    physGame.startlePeople(px, pz, 1, physHIT_R);
  }
  // ...and somebody says so. `saySomebodyNear` returns false rather than
  // throwing when every mouth in range is cooling down, which after a startle
  // is most of them — so this is a line SOMETIMES, by design, and the index
  // only advances when one was actually said.
  if (typeof physGame.sayNear === 'function') {
    let said = false;
    try { said = physGame.sayNear(px, pz, physHIT_R, physHIT_LINES[physHitLine]); }
    catch (err) { said = false; }
    if (said) physHitLine = (physHitLine + 1) % physHIT_LINES.length;
  }
  // ---- ...AND IT COUNTS AS SOMETHING YOU DID (M8) ------------------------
  //
  // The charged throw is a whole verb — a mass-proportional launch on a 43.7
  // degree arc, built two passes ago — and the last pass gave it a hit rule
  // with a punch, a startle and a spoken line. Between them they fed NOTHING:
  // no task in 232 needs a throw, `prop.thrownT` is read at exactly one place
  // and that place is four lines above this one, and the incident chain — the
  // only repeatable reward in the game — had five kinds and none of them was
  // this. So the most deliberate thing a player can do went on a cooldown and
  // then vanished.
  //
  // One event. systems.js owns the chain and this file must not reach into it;
  // `prop:impact`, `prop:water` and `prop:destroy` are the three existing doors
  // and this is the fourth, in the same shape. The gate is entirely upstream:
  // everything above this line has already established that a thrown thing,
  // still flying, hit a person hard enough, at most once every physHIT_COOL.
  if (physGame.events && typeof physGame.events.emit === 'function') {
    physHitEv.position = b.position;
    physHitEv.prop = prop;
    physHitEv.speed = speed;
    physGame.events.emit('prop:hitperson', physHitEv);
  }
}
// A shared payload, like every other emitter in this file: `prop:impact` fires
// on cascades and nothing here may allocate inside a collision callback.
const physHitEv = { position: null, prop: null, speed: 0 };

/**
 * The harness window on the rule above. Same shape and the same reason as
 * travelAudit and hangAudit: a gate that refuses is invisible from outside, and
 * "the throw never armed" and "the throw armed and missed" are the same zero.
 */
function physHitAudit(reset) {
  const r = { hits: physHitN, blocked: physHitBlocked, throws: physThrowN,
              last: +physHitT.toFixed(2), min: physHIT_MIN, cool: physHIT_COOL };
  if (reset) { physHitN = 0; physHitBlocked = 0; physThrowN = 0; }
  return r;
}

function physSpill(prop) {
  if (!prop || prop.spilled) return;
  const def = physTYPES[prop.type];
  if (!def || !def.spill) return;
  prop.spilled = true;
  prop.spillArmed = false;
  prop.grabbable = false;
  physSetSolo(prop, true);

  const g = physGetSpillGeo(prop.type);
  if (g) prop.mesh.geometry = g;

  const b = prop.body;
  if (prop.held && physGame.capy) {
    physGame.capy.heldProp = null;
    prop.held = false;
    prop.mesh.getWorldPosition(physV1);
    physGame.scene.add(prop.mesh);
    b.position.set(physV1.x, physV1.y, physV1.z);
  }
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  physQ1.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  physEuler.setFromQuaternion(physQ1, 'YXZ');
  physQ1.setFromAxisAngle(physUp, physEuler.y);
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  b.position.y = physSurfaceY(b.position.x, b.position.z) + prop.originY;
  physSyncBodyTransform(b);
  b.type = CANNON.Body.STATIC;
  b.updateMassProperties();
  b.collisionResponse = false;
  b.sleep();
  prop.frozen = true;
  prop.settled = true;

  prop.mesh.position.set(b.position.x, b.position.y, b.position.z);
  prop.mesh.quaternion.copy(physQ1);
  prop.pop = 1; prop.sq = 0; prop.sqV = 0;
  prop.mesh.scale.setScalar(1);

  // The task reads "make SOMEONE spill their flat white" — an unowned cup on a
  // bench is a sandbox toy, not social mischief — and the capybara has to be
  // the cause. Decided BEFORE the emit below: npc.js's 'prop:impact' handler
  // clears prop.owner/stolenFrom when the victim reacts, which used to erase
  // the evidence a frame before it was read.
  const earnedSpill = prop.type === 'coffee' && (prop.owner || prop.stolenFrom) &&
                      physCausedByCapy(prop, physCAUSE_SPILL);

  physImpactPayload.prop = prop;
  physImpactPayload.speed = 0;
  physStampVoice(prop);
  physImpactPayload.spill = true;   // see the payload's declaration
  physImpactPayload.position.set(b.position.x, b.position.y, b.position.z);
  physGame.events.emit('prop:impact', physImpactPayload);
  physSfxOpts.volume = 0.8;
  physGame.sfx(def.spillSfx || 'splash', physSfxOpts);
  physDust3(b.position.x, b.position.y - prop.originY + 0.12, b.position.z, 5);
  // ...AND IT IS SYDNEY'S ROW (L3-8). The errand puts owned cups in other
  // people's hands in other places now, and a flat white spilt in Venice
  // must not tick a line on the Gardens' list (memory: shared-space leaks).
  if (earnedSpill && physGame.biome && physGame.biome.current === 'sydney') physTask('coffee-spill');
  // A burst sack throws its harvest across the drying patio.
  if (prop.type === 'coffeesack') {
    physThrowShards(b.position.x, b.position.y + 0.15, b.position.z, 6, 1);
    physSfxOpts.volume = 0.55;
    physGame.sfx('hiss', physSfxOpts);
    physGame.shake(0.22);
    if (physCausedByCapy(prop, physCAUSE_SPILL)) physTask('coffee-scatter');
  }
  prop.owner = null;
}

function physCheckTip(prop) {
  const b = prop.body;
  physQ1.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  physV1.set(0, 1, 0).applyQuaternion(physQ1);
  if (physV1.y > physTIP_COS) return;
  prop.tipped = true;
  const n = randInt(4, 6);
  for (let i = 0; i < n; i++) {
    physSpawnRubbish(
      b.position.x + rand(-0.35, 0.35),
      b.position.y + 0.3 + rand(0, 0.3),
      b.position.z + rand(-0.35, 0.35)
    );
  }
  physDust3(b.position.x, 0.15, b.position.z, 6);
  physSfxOpts.volume = 0.9;
  physGame.sfx('rustle', physSfxOpts);
  physGame.shake(0.3);
  // A bin that a tourist blunders into still spills its rubbish — but only the
  // capybara can tick the checklist, and only if it hit the thing just now.
  if (physCausedByCapy(prop, physCAUSE_TIP)) physTask('bin-chicken');
}

/**
 * THE WHEEK IS A PRESSURE WAVE.
 *
 * The signature verb of the game drew a shockwave on the ground, shook the
 * camera, startled every tourist in earshot and could not move a tin mug —
 * props.js had no listener for it at all. It has one now: a distance-falloff
 * radial nudge over the props of the LIVE biome, plus a flinch on each one's
 * own squash spring so a paper bag gives and a bowl barely twitches.
 *
 * THE SIZE OF IT IS THE WHOLE DESIGN. See the physWHEEK_* block: it is capped
 * as a velocity change, it is centre-of-mass so it produces no rotation and
 * cannot topple anything, and at the cap a prop travels about eight
 * centimetres. It may not solve a task, move a prop out of reach, or walk one
 * off a ledge the player needed it on. Expression, not a mechanic.
 *
 * `soft` on the payload is capybara.js's calm/quiet call. A soft wheek is about
 * a third of a loud one: it stirs and flinches things, it does not scatter them.
 */
function physOnWheek(e) {
  const pos = e && e.position;
  if (!pos || !physGame || !physGame.props) return;
  const scale = (e && e.soft === true) ? physWHEEK_SOFT : 1;
  // ...and everything on a string, which is the one class of thing in this
  // game that a shout SHOULD move and that has no rigid body to be moved.
  physHangWheek(pos, scale);
  const live = physLiveBiome();
  const arr = physGame.props;
  const r2 = physWHEEK_R * physWHEEK_R;
  const t = physGame.state ? physGame.state.time : 0;
  let voiced = null;
  let voicedD = 1e9;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    // held / carried / planted / parked props are somebody else's business, and
    // the biome filter is physNearestGrabbable's: a detached chapter's props
    // keep their frozen positions in the one shared coordinate space, so
    // without it a wheek in Cali rattles an invisible Sydney sandwich.
    if (p.removed || p.hidden || p.held || p.frozen || p.owner) continue;
    if (p.biome && p.biome !== live) continue;
    const b = p.body;
    const dx = b.position.x - pos.x;
    const dy = b.position.y - pos.y;
    const dz = b.position.z - pos.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 > r2) continue;
    // Linear falloff that reaches zero AT the radius, so nothing pops on at the
    // edge of earshot.
    const fall = 1 - Math.sqrt(d2) / physWHEEK_R;
    if (fall <= 0.02) continue;
    // 1/mass falls straight out of an impulse; the cap is what stops an 8 g
    // ferry ticket being fired across the harbour by the same push that a bin
    // shrugs off.
    let dv = (physWHEEK_IMP * fall * scale) / p.mass;
    const cap = physWHEEK_DVMAX * fall * scale;
    if (dv > cap) dv = cap;
    if (dv < 0.01) continue;
    // Radial in the HORIZONTAL plane with a fixed lift on top: taking the
    // direction in 3D would push a prop on the ground DOWNWARD into it, while
    // the falloff still wants the full 3D distance so a prop on a balcony above
    // is felt less. A prop directly overhead gets the lift and nothing else.
    const hd = Math.sqrt(dx * dx + dz * dz);
    const inv = hd > 1e-3 ? 1 / hd : 0;
    const j = dv * p.mass;
    physCV3.set(dx * inv * j, physWHEEK_LIFT * j, dz * inv * j);
    b.wakeUp();
    b.applyImpulse(physCV3, physCV0);   // at the centre of mass: no torque, ever
    // The causation ledger stays honest — the capybara did this, just now — for
    // exactly the same reason a shove does. It cannot tick anything by itself:
    // nothing here moves a prop far enough to complete a task.
    physStampTouch(p);
    physSquashHit(p, dv * physWHEEK_FLINCH);
    if (dv >= physWHEEK_VOICE_DV && d2 < voicedD && t - p.lastImpact > 0.25) {
      voicedD = d2; voiced = p;
    }
  }
  // ...and one of them answers, in its own material's voice.
  if (voiced) {
    voiced.lastImpact = t;
    physImpactPayload.prop = voiced;
    physImpactPayload.speed = physWHEEK_VOICE_SPD;
    physStampVoice(voiced);
    physImpactPayload.position.set(voiced.body.position.x, voiced.body.position.y,
                                   voiced.body.position.z);
    physGame.events.emit('prop:impact', physImpactPayload);
  }
}

function physOnDig(payload) {
  const p = payload && payload.position;
  if (!p) return;
  const arr = physGame.props;
  let best = null;
  let bestD = 2.4 * 2.4;
  for (let i = 0; i < arr.length; i++) {
    const prop = arr[i];
    if (prop.type !== 'flower' || !prop.planted) continue;
    const b = prop.body.position;
    const dx = b.x - p.x;
    const dz = b.z - p.z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = prop; }
  }
  physDust3(p.x, 0.12, p.z, 5);
  if (!best) return;
  best.planted = false;
  best.grabbable = true;
  best.frozen = false;
  physStampTouch(best);   // the dig is a player action by definition
  const b = best.body;
  b.type = CANNON.Body.DYNAMIC;
  b.updateMassProperties();
  b.wakeUp();
  b.position.y += 0.12;
  physSyncBodyTransform(b);   // hand-lifted out of the soil: no smear from below
  best.settled = false;
  b.velocity.set(rand(-0.6, 0.6), 2.4, rand(-0.6, 0.6));
  b.angularVelocity.set(rand(-2, 2), rand(-2, 2), rand(-2, 2));
  physDust3(b.position.x, 0.15, b.position.z, 6);
  physSfxOpts.volume = 0.85;
  physGame.sfx('rustle', physSfxOpts);
  physTask('dig-flower');
}

function physTask(id) {
  for (let i = 0; i < TASKS.length; i++) {
    if (TASKS[i].id === id) { physGame.completeTask(id); return; }
  }
}

// ===========================================================================
// 6. WATER
// ===========================================================================
/**
 * THE LIVE BIOME'S API — the same resolution rule capybara.js uses.
 * Every water and terrain question below asks the biome the player is actually
 * standing in. game.env (Sydney) answers only when Sydney is live; it stays
 * resident abroad and its isOverWater says yes to everything north of z = -10,
 * which is a volcano in Pasto and a basilica in Venice.
 */
function physBiomeApi() {
  const bm = physGame && physGame.biome;
  const n = bm && bm.current;
  if (!n) return physGame ? physGame.env : null;
  return n === 'sydney' ? physGame.env : (physGame[n] || null);
}
function physWaterLevel() {
  const api = physBiomeApi();
  return api && typeof api.waterLevel === 'number' && api.waterLevel === api.waterLevel
    ? api.waterLevel : physWATER_FALLBACK;
}
function physOverWater(x, z) {
  const api = physBiomeApi();
  if (api && typeof api.isOverWater === 'function') return !!api.isOverWater(x, z);
  return false;                       // a biome with no water publishes nothing
}
/** Surface height of the live biome's water at (x, z) — swell included, if
 *  modelled. One resolver, shared with capybara.js and systems.js since X8. */
function physWaterHeightAt(x, z) {
  return waterYAt(physBiomeApi(), x, z, physWATER_FALLBACK);
}
/** Terrain height under (x, z) in the live biome, or NaN where none is published. */
function physTerrainAt(x, z) {
  const api = physBiomeApi();
  if (api && typeof api.terrainHeight === 'function') {
    const h = api.terrainHeight(x, z);
    if (typeof h === 'number' && h === h) return h;
  }
  return NaN;
}
/** The live biome's water current at (x, z) — {x, z}, zeros where none flows. */
const physFlowOut = { x: 0, z: 0 };
function physFlowAt(x, z) {
  physFlowOut.x = 0; physFlowOut.z = 0;
  const api = physBiomeApi();
  if (api && typeof api.flow === 'function') {
    // NO DEPTH ARGUMENT, AND THAT IS THE STATEMENT (X8). A prop in this solver
    // is a FLOATING thing by construction — physBuoyancy is the only caller —
    // so it gets the surface field. Manly used to read the PLAYER's depth from
    // inside its own flow(), which meant a thong bobbing forty metres up the
    // beach lost its shoreward push whenever the player duck-dived somewhere
    // else entirely.
    const f = api.flow(x, z);
    if (f) {
      if (typeof f.x === 'number' && f.x === f.x) physFlowOut.x = clamp(f.x, -12, 12);
      if (typeof f.z === 'number' && f.z === f.z) physFlowOut.z = clamp(f.z, -12, 12);
    }
  }
  return physFlowOut;
}
/**
 * THE AIR THE PROPS FEEL — the live biome's own wind() PLUS weather.js's gust.
 * {x, z}, zeros in still air, cached once per frame.
 *
 * THE GUST IS IN HERE ON PURPOSE AND IT MUST NOT BE PUT INTO capyWindAt().
 * CONTRACT.md's "wind() IS NOT THE GUST, AND THE GUST MUST NEVER GO INTO IT" is
 * about the REFERENCE-FRAME channel: the one a biome publishes to say "the
 * ground under you is moving", which feeds platVX/platVZ in capybara.js beside a
 * ferry deck and a balloon basket. A five-metre ambient breeze on THAT channel
 * slides a capybara across Jemaa el-Fnaa at walking pace with nobody touching a
 * key, and in Cappadocia it fights the one system that chapter IS.
 *
 * This function merely SHARES THAT CHANNEL'S NAME. It is private to props.js,
 * it has exactly two readers — the quadratic aero drag and the wake-a-sleeping-
 * light-prop test, both in physUpdate — and capybara.js's own capyWindAt() is
 * untouched and still asks the biome alone. Nothing the controller sees changes.
 * Please do not "fix" this back.
 *
 * Only ONE chapter (the Drift) publishes wind() at all, so before this the whole
 * aero block ran against a zero vector in sixteen of seventeen chapters and the
 * wake branch — written specifically for gusts — could never fire anywhere.
 */
/**
 * ONE PUFF. See the block on physGUST_LIGHT for why this exists and what it
 * refuses. Called from the aero block, once per prop per frame; almost every
 * call falls straight out of the first two lines.
 */
function physGustKick(p, wnd, dt) {
  if (p.mass > physGUST_LIGHT) return;
  if (p.held || p.owner || p.frozen || p.planted || p.keep) return;
  const w2 = wnd.x * wnd.x + wnd.z * wnd.z;
  if (w2 < physGUST_KICK_W * physGUST_KICK_W) { p.gustT = 0; return; }
  const b = p.body;
  // A prop already moving is the drag's business, not the puff's: kicking one
  // that is in flight is how a skitter becomes a launch.
  if (b.velocity.lengthSquared() > physGUST_REST * physGUST_REST) return;
  const dx = b.position.x - p.homeX, dz = b.position.z - p.homeZ;
  if (dx * dx + dz * dz > physGUST_ROAM * physGUST_ROAM) return;
  p.gustT = (p.gustT || 0) - dt;
  if (p.gustT > 0) return;
  p.gustT = physGUST_KICK_T * (0.5 + Math.random());
  const wl = Math.sqrt(w2);
  const ux = wnd.x / wl, uz = wnd.z / wl;
  // TURBULENT: a puff is never straight downwind, or a row of props tracks
  // across a square in formation, which reads as a conveyor belt.
  const a = (Math.random() - 0.5) * physGUST_KICK_SP;
  const c = Math.cos(a), s = Math.sin(a);
  const kx = ux * c - uz * s, kz = ux * s + uz * c;
  // ...and how hard, off how far over the threshold the wind is. Manly's
  // absolute peak effective wind is 4.8 m/s, so `g` never reaches 1 anywhere
  // in this game and the numbers above are headroom rather than a target.
  const g = clamp((wl - physGUST_KICK_W) / 1.8, 0.45, 1);
  b.wakeUp();
  b.velocity.x += kx * physGUST_KICK_V * g;
  b.velocity.z += kz * physGUST_KICK_V * g;
  b.velocity.y += physGUST_KICK_UP * g;
  b.angularVelocity.x += (Math.random() - 0.5) * 5 * g;
  b.angularVelocity.z += (Math.random() - 0.5) * 5 * g;
}

const physWindOut = { x: 0, z: 0 };
let physWindTick = -1;
function physWindNow() {
  const t = physGame.state ? physGame.state.time : 0;
  if (t === physWindTick) return physWindOut;
  physWindTick = t;
  let wx = 0;
  let wz = 0;
  const api = physBiomeApi();
  if (api && typeof api.wind === 'function') {
    const w = api.wind();
    if (w) {
      if (typeof w.x === 'number' && w.x === w.x) wx = clamp(w.x, -12, 12);
      if (typeof w.z === 'number' && w.z === w.z) wz = clamp(w.z, -12, 12);
    }
  }
  // gust() swings its HEADING as well as its speed, so the floor is taken off
  // the SPEED and the direction is carried through untouched — subtracting a
  // constant vector would turn a wind shift into a wind reversal.
  const wxr = physGame.weather;
  if (wxr && typeof wxr.gust === 'function') {
    const g = wxr.gust();
    if (g) {
      const gx = typeof g.x === 'number' && g.x === g.x ? g.x : 0;
      const gz = typeof g.z === 'number' && g.z === g.z ? g.z : 0;
      const sp = Math.sqrt(gx * gx + gz * gz);
      if (sp > physGUST_MIN) {
        const k = ((sp - physGUST_MIN) * physGUST_K) / sp;
        wx += gx * k;
        wz += gz * k;
      }
    }
  }
  physWindOut.x = clamp(wx, -12, 12);
  physWindOut.z = clamp(wz, -12, 12);
  return physWindOut;
}

/** Splash, foam and the one-shot 'prop:water'. Idempotent: guarded by inWater. */
function physEnterWater(prop) {
  const b = prop.body;
  prop.inWater = true;
  prop.sunk = false;
  // Cannon's own damping is left mild — the drag below is what actually thickens
  // the water — but a little of it keeps the explicit integration well behaved.
  b.linearDamping = 0.35;
  b.angularDamping = 0.72;
  b.allowSleep = false;      // floating props must keep integrating, forever
  // Weight has to be audible AND visible. The sfx goes FIRST: listeners of
  // 'prop:water' may fire their own unweighted splash, and whoever gets in
  // first claims the mixer's throttle slot for this frame.
  const sp = prop.splash;
  const mw = 0.6 + clamp(prop.mass * 0.25, 0, 1);   // 0.6 (ticket) .. 1.6 (bin)
  physSfxOpts.volume = clamp(0.34 + prop.mass * 0.1 * sp, 0.34, 1);
  physGame.sfx('splash', physSfxOpts);
  physWaterPayload.prop = prop;
  physGame.events.emit('prop:water', physWaterPayload);
  physFoamRing(b.position.x, b.position.z, 0.9 * sp * mw);
  physFoamRing(b.position.x, b.position.z, 1.8 * sp * mw);
  physFoamRing(b.position.x, b.position.z, 2.6 * sp * mw);
  if (sp * mw > 1.2) physGame.shake(clamp(0.1 * sp * mw, 0, 0.32));
  // Same causation rule as everywhere else: something that rolls into the
  // harbour by itself is scenery, not mischief.
  const earned = physCausedByCapy(prop, physCAUSE_WATER);
  if (prop.type === 'ball' && earned) physTask('ball-harbour');
  if (prop.type === 'hat' && prop.wasStolen && earned) physTask('hat-harbour');
}

/**
 * A prop that has sunk past the harbour floor. Park it on the bottom and let it
 * sleep — a body falling forever under the map costs the solver real money.
 */
function physRestOnSeabed(prop, floorY) {
  const b = prop.body;
  b.position.y = floorY + prop.originY;
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.force.set(0, 0, 0);
  b.torque.set(0, 0, 0);
  physSyncBodyTransform(b);
  prop.sunk = true;
  prop.settled = false;
  b.allowSleep = true;
  b.sleep();
}

/**
 * Buoyancy, done as forces rather than as velocity fiddling.
 *
 *   F = rho * g * displacedVolume
 *
 * `rho` is baked per prop at spawn from its designed waterline (`float`), so a
 * fully submerged prop gets weight/float of lift and equilibrium lands exactly
 * where the type table asked for it. Nothing here writes a velocity or a
 * position, which is why props bob and settle instead of popping like corks:
 * gravity never stops pulling, the lift ramps with depth, and drag eats the
 * overshoot. A prop with float > 1 (the tourist's camera) can never displace
 * its own weight — it sinks, slowly, because the same drag holds it back.
 *
 * The lift is applied at the centre of BUOYANCY — a point below the centre of
 * mass in the prop's own frame — so a tilted prop gets a righting torque for
 * free, and the drift keeps it turning lazily on the swell.
 */
function physCheckWater(prop, dt) {
  const b = prop.body;
  const wl = physWaterHeightAt(b.position.x, b.position.z);
  const over = physOverWater(b.position.x, b.position.z);
  // Threshold scales with the prop so a tall sign does not flicker in and out
  // of buoyancy as it bobs: "base is 0.3m clear of the surface".
  if (!over || b.position.y > wl + prop.originY + 0.3) {
    if (!over && prop.inWater) {
      prop.inWater = false;
      physDryOut(prop);
    }
    return;
  }
  if (!prop.inWater) physEnterWater(prop);

  // The seabed is the terrain where the biome publishes one — Palawan's sand is
  // eleven metres down and Venice's is the paving of the square — and the old
  // harbour constant everywhere else.
  let floorY = wl - physSEABED;
  const terr = physTerrainAt(b.position.x, b.position.z);
  if (terr === terr && terr < wl - 0.2) floorY = terr;
  if (b.position.y - prop.originY < floorY) { physRestOnSeabed(prop, floorY); return; }
  prop.sunk = false;                           // shoved back off the bottom

  // The ramp from "just touching" to "fully under" is the prop's OWN height.
  // A fixed floor here would silently deepen every thin prop's equilibrium
  // (depth = floatFrac * span) until it settled under an opaque water plane.
  const span = prop.originY * 2 > physBUOY_SPAN_MIN ? prop.originY * 2 : physBUOY_SPAN_MIN;
  const sub = clamp((wl - (b.position.y - prop.originY)) / span, 0, 1);
  if (sub <= 0) return;

  const g = -physGame.world.gravity.y;
  const w = prop.mass * g;
  const t = physGame.state ? physGame.state.time : 0;

  // ---- Archimedes ----------------------------------------------------------
  let lift = prop.rho * g * (prop.vol * sub);
  const cap = physBUOY_CLAMP * w;
  if (lift > cap) lift = cap;                  // no catapults out of the harbour
  lift += w * physBUOY_SWELL * sub * Math.sin(t * 1.7 + prop.id);
  b.force.y += lift;

  // ---- linear drag, and THE CURRENT CARRIES WHAT YOU DROP IN IT ------------
  // Six chapters publish flow(x, z) — the Uji, the Manly rip, the Pantanal
  // flood among them — and the capybara has been carried by it since it was
  // written, while anything thrown in beside it got physBUOY_DRIFT, a
  // decorative sine, and wobbled on the spot.
  //
  // It goes in as a DRAG TOWARD THE WATER, never as a velocity write: a write
  // would stamp on the frame's linear drag and on the centre-of-buoyancy
  // righting torque both, and a prop being carried downstream would stop
  // bobbing and stop righting itself the moment it entered the current. As a
  // force it simply composes — the two drags settle the prop at
  // physFLOW_DRAG/(physFLOW_DRAG + physBUOY_DRAG_L) = 0.60 of the water's own
  // speed, so it is carried and still visibly LAGS the river.
  //
  // Scaled by `sub` like everything else here, so a prop barely touching the
  // surface is barely taken. In still water — and in the eleven chapters that
  // publish no flow() at all, where this is one property lookup that misses —
  // the sine below is bit-for-bit what it always was.
  const kl = physBUOY_DRAG_L * sub * prop.mass;
  const fl = physFlowAt(b.position.x, b.position.z);
  const flowing = fl.x !== 0 || fl.z !== 0;
  const kf = flowing ? physFLOW_DRAG * sub * prop.mass : 0;
  b.force.x += (flowing ? (fl.x - b.velocity.x) * kf
                        : Math.sin(t * 0.31 + prop.id * 1.7) * physBUOY_DRIFT * prop.mass * sub)
             - b.velocity.x * kl;
  b.force.y -= b.velocity.y * kl;
  b.force.z += (flowing ? (fl.z - b.velocity.z) * kf
                        : Math.cos(t * 0.23 + prop.id * 2.3) * physBUOY_DRIFT * prop.mass * sub)
             - b.velocity.z * kl;

  // ---- righting + angular drag + a lazy turn on the swell -----------------
  // Every torque is scaled by the body's OWN inertia, so these constants are an
  // angular-acceleration budget rather than a torque: a 60g ferry ticket and a
  // 9kg bin turn over at the same rate, and the thin light props cannot be
  // flung into a stiff-spring oscillation by a lever they have no inertia for.
  physQ1.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
  physV1.set(0, 1, 0).applyQuaternion(physQ1);
  physV2.crossVectors(physV1, physUp);         // roll-upright axis, |v| = sin(tilt)
  const ka = physBUOY_DRAG_A * sub;
  const kr = physBUOY_RIGHT * sub;
  const inr = b.inertia;
  b.torque.x += inr.x * (kr * physV2.x - ka * b.angularVelocity.x);
  b.torque.y += inr.y * (kr * physV2.y - ka * b.angularVelocity.y +
                         physBUOY_SPIN * sub * Math.sin(t * 0.4 + prop.id));
  b.torque.z += inr.z * (kr * physV2.z - ka * b.angularVelocity.z);
}

// ===========================================================================
// 7. PARTICLES (pooled, preallocated)
// ===========================================================================
/**
 * THE POOLS COME WITH YOU. Add to the scene WITHOUT joining a biome's set.
 *
 * main.js claims everything added while a capture tag is up, and these pools
 * were built inside createProps — which main.js wraps in
 * biome.capture('sydney'). So physDust and physFoam were SYDNEY OBJECTS and
 * went visible = false the instant Sydney detached. Landing dust, sprint
 * scuffs, impact dust, bin-tip dust, spill dust and — the big one — the three
 * physFoamRings on water entry drew nothing at all in chapters 3 to 17: the
 * splash sound played over an empty screen for fifteen chapters.
 *
 * A pool is one set of buffers that every chapter borrows, which is exactly
 * what main.js says about weather.js's two emitter fields where it notes they
 * are "deliberately NOT captured into a biome" — they must survive a hemisphere
 * change rather than being detached with whatever happened to be live when they
 * were allocated. Same argument, same treatment.
 */
function physSceneAddLoose(obj) {
  THREE.Object3D.prototype.add.call(physGame.scene, obj);
}
/** ...and the same for a body, so a pooled shard is not removed with a biome. */
function physWorldAddLoose(body) {
  CANNON.World.prototype.addBody.call(physGame.world, body);
}

function physInitParticles() {
  if (physDust) return;
  // Its OWN material, not the shared cached one: physDust3 tints it per biome
  // (physDUST_BIOME) and mat() hands back one instance per hex, so writing to
  // the cached material would recolour every soil-coloured mesh in the game.
  // matOwn rather than a clone of the cached one: the privacy is the point
  // above, and Material.copy() would have dropped the rim on the way.
  const dustMat = matOwn(PALETTE.soil);
  physDustColor = PALETTE.soil;
  physDust = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.1), dustMat, physDUST_MAX);
  physDust.frustumCulled = false;
  physDust.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  physSceneAddLoose(physDust);

  const ring = new THREE.CylinderGeometry(1, 1, 0.05, 8, 1, true);
  physFoam = new THREE.InstancedMesh(
    ring,
    mat(PALETTE.foam, { transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }),
    physFOAM_MAX
  );
  physFoam.frustumCulled = false;
  physFoam.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  physSceneAddLoose(physFoam);

  for (let i = 0; i < physDUST_MAX; i++) physDustLife[i] = 0;
  for (let i = 0; i < physFOAM_MAX; i++) physFoamLife[i] = 0;
  physWriteDust();
  physWriteFoam();
}

// ---- WHAT THE GROUND HERE IS MADE OF --------------------------------------
// The pool is biome-neutral now, so the one thing left that was ever chapter-
// specific about a scuff is its COLOUR. This replaces a hard-coded
// `physPastoLive()` branch whose stated reason ("the dust pool is a Sydney
// object") stopped being true two functions ago.
//
// One shared material, so a palette change is a hex write on emit rather than a
// second draw call, and a chapter has exactly one ground under it so two
// palettes are never wanted in the same frame.
//
// A chapter with no row gets soil, which is what all seventeen got before this
// table existed — so every unlisted chapter is unchanged to the pixel.
//
// physDUST_ASH is the one row that is not a colour but a POOL. Volcanic dust on
// the flank of Galeras RISES and billows rather than falling, which is the puff
// pool's entire behaviour and is how chapter 2 has looked since it shipped.
// Keeping Pasto identical is the point of the row, not an exception to it.
const physDUST_ASH = -1;
const physDUST_SOIL = 0;
const physDUST_SAND = 1;
const physDUST_SNOW = 2;
const physDUST_SPRAY = 3;
const physDUST_COLOR = [PALETTE.soil, PALETTE.sand, PALETTE.antIce, PALETTE.foam];
const physDUST_BIOME = {
  pasto: physDUST_ASH,
  sahara: physDUST_SAND, goreme: physDUST_SAND, manly: physDUST_SAND, palawan: physDUST_SAND,
  iceland: physDUST_SNOW, antarctic: physDUST_SNOW,
  pantanal: physDUST_SPRAY,
};

function physDust3(x, y, z, count) {
  const kind = physDUST_BIOME[physLiveBiome()];
  if (kind === physDUST_ASH && physPuffMesh) { physPuff3(x, y, z, count); return; }
  if (!physDust) return;
  const col = physDUST_COLOR[kind === undefined || kind < 0 ? physDUST_SOIL : kind];
  if (col !== physDustColor) { physDustColor = col; physDust.material.color.setHex(col); }
  const n = count || 4;
  for (let k = 0; k < n; k++) {
    const i = physDustHead;
    physDustHead = (physDustHead + 1) % physDUST_MAX;
    physDustPos[i * 3] = x + rand(-0.16, 0.16);
    physDustPos[i * 3 + 1] = y + rand(0.02, 0.2);
    physDustPos[i * 3 + 2] = z + rand(-0.16, 0.16);
    physDustVel[i * 3] = rand(-1.6, 1.6);
    physDustVel[i * 3 + 1] = rand(1.4, 3.4);
    physDustVel[i * 3 + 2] = rand(-1.6, 1.6);
    physDustLife[i] = rand(0.4, 0.8);
  }
  physDustDirty = true;
}

function physFoamRing(x, z, delay) {
  const i = physFoamHead;
  physFoamHead = (physFoamHead + 1) % physFOAM_MAX;
  physFoamPos[i * 3] = x;
  // The swell is ±0.18m and the water mesh is opaque, so a ring pinned to the
  // flat waterLevel spends a third of its life behind the surface. Ride the
  // actual wave here, and keep re-sampling it in physParticleUpdate.
  physFoamPos[i * 3 + 1] = physWaterHeightAt(x, z) + 0.06;
  physFoamPos[i * 3 + 2] = z;
  physFoamLife[i] = 0.9 + (delay || 0) * 0.12;
  physFoamMax[i] = 0.9 + (delay || 0) * 0.55;
  physFoamDirty = true;
}

function physWriteDust() {
  for (let i = 0; i < physDUST_MAX; i++) {
    if (physDustLife[i] > 0) {
      const s = clamp(physDustLife[i] * 1.6, 0.12, 1);
      physV1.set(physDustPos[i * 3], physDustPos[i * 3 + 1], physDustPos[i * 3 + 2]);
      physQ1.setFromAxisAngle(physUp, physDustLife[i] * 6);
      physV2.set(s, s, s);
      physM4.compose(physV1, physQ1, physV2);
    } else {
      physM4.compose(physV3.set(0, -900, 0), physQ2.identity(), physV2.set(0, 0, 0));
    }
    physDust.setMatrixAt(i, physM4);
  }
  physDust.instanceMatrix.needsUpdate = true;
}

function physWriteFoam() {
  for (let i = 0; i < physFOAM_MAX; i++) {
    if (physFoamLife[i] > 0 && physFoamLife[i] <= 0.9) {
      const t = 1 - physFoamLife[i] / 0.9;
      const r = lerp(0.35, physFoamMax[i], t);
      physV1.set(physFoamPos[i * 3], physFoamPos[i * 3 + 1], physFoamPos[i * 3 + 2]);
      physV2.set(r, 1, r);
      physM4.compose(physV1, physQ2.identity(), physV2);
    } else {
      physM4.compose(physV3.set(0, -900, 0), physQ2.identity(), physV2.set(0, 0, 0));
    }
    physFoam.setMatrixAt(i, physM4);
  }
  physFoam.instanceMatrix.needsUpdate = true;
}

function physParticleUpdate(dt) {
  let anyDust = false;
  for (let i = 0; i < physDUST_MAX; i++) {
    if (physDustLife[i] <= 0) continue;
    anyDust = true;
    physDustLife[i] -= dt;
    physDustVel[i * 3 + 1] -= 9 * dt;
    physDustPos[i * 3] += physDustVel[i * 3] * dt;
    physDustPos[i * 3 + 1] += physDustVel[i * 3 + 1] * dt;
    physDustPos[i * 3 + 2] += physDustVel[i * 3 + 2] * dt;
    if (physDustPos[i * 3 + 1] < 0.04) {
      physDustPos[i * 3 + 1] = 0.04;
      physDustVel[i * 3 + 1] *= -0.24;
      physDustVel[i * 3] *= 0.5;
      physDustVel[i * 3 + 2] *= 0.5;
    }
    if (physDustLife[i] <= 0) physDustLife[i] = 0;
  }
  if (anyDust || physDustDirty) { physWriteDust(); physDustDirty = anyDust; }

  let anyFoam = false;
  for (let i = 0; i < physFOAM_MAX; i++) {
    if (physFoamLife[i] <= 0) continue;
    anyFoam = true;
    physFoamLife[i] -= dt;
    // a ring lives ~1s; the swell moves under it the whole time
    physFoamPos[i * 3 + 1] = physWaterHeightAt(physFoamPos[i * 3], physFoamPos[i * 3 + 2]) + 0.06;
    if (physFoamLife[i] <= 0) physFoamLife[i] = 0;
  }
  if (anyFoam || physFoamDirty) { physWriteFoam(); physFoamDirty = anyFoam; }
}

// ===========================================================================
// 8. RUBBISH POOL (bin chicken payload)
// ===========================================================================
function physBuildRubbishGeo(kind) {
  const g = new THREE.Group();
  if (kind === 0) {
    physAdd(g, new THREE.TetrahedronGeometry(0.14), PALETTE.cloth6, 0, 0.12, 0);
    physAdd(g, new THREE.TetrahedronGeometry(0.11), PALETTE.plastic, 0.06, 0.16, 0.04, 0.6, 0.4, 0);
  } else if (kind === 1) {
    physAdd(g, physCylG(0.08, 0.08, 0.22), PALETTE.metal, 0, 0.11, 0);
    physAdd(g, physCylG(0.085, 0.085, 0.05), PALETTE.binRed, 0, 0.11, 0);
  } else {
    physAdd(g, physBoxG(0.06, 0.03, 0.24), PALETTE.petalYellow, 0, 0.03, 0, 0, 0, 0.1);
    physAdd(g, physBoxG(0.06, 0.03, 0.22), PALETTE.petalYellow, 0.05, 0.04, 0.02, 0, 0.9, -0.1);
    physAdd(g, physBoxG(0.06, 0.03, 0.2), PALETTE.petalYellow, -0.05, 0.04, -0.02, 0, -1.1, 0.1);
  }
  return physFlatten(g, 0.1);
}

/**
 * Litter is BODY-FREE. It used to be physRUBBISH_MAX real CANNON bodies added
 * to the world on demand, which meant four tipped bins pushed Sydney from 135
 * live bodies to a measured 153 — 23 over CONTRACT.md's hard budget of 130, and
 * spent entirely on chip packets nobody interacts with. They are now integrated
 * here: gravity, a bounce off physSurfaceY, tumble, friction, sleep. From the
 * 35° camera it is indistinguishable, it collides with nothing (litter never
 * usefully did), and it costs the solver and the budget exactly zero.
 */
function physInitRubbish() {
  const geos = [physBuildRubbishGeo(0), physBuildRubbishGeo(1), physBuildRubbishGeo(2)];
  for (let i = 0; i < physRUBBISH_MAX; i++) {
    const mesh = new THREE.Mesh(geos[i % 3], physPropMat);
    mesh.castShadow = true;
    mesh.visible = false;
    physGame.scene.add(mesh);
    physRubbish.push({
      mesh, active: false, life: 0, rest: false, biome: 'sydney',
      x: 0, y: -900, z: 0, vx: 0, vy: 0, vz: 0,
      rx: 0, ry: 0, rz: 0, sx: 0, sy: 0, sz: 0,
    });
  }
}

function physSpawnRubbish(x, y, z) {
  let slot = null;
  let oldest = 1e9;
  for (let i = 0; i < physRubbish.length; i++) {
    const r = physRubbish[i];
    if (!r.active) { slot = r; break; }
    if (r.life < oldest) { oldest = r.life; slot = r; }
  }
  if (!slot) return;
  slot.active = true;
  slot.rest = false;
  slot.biome = physLiveBiome();
  slot.life = 26;
  slot.mesh.visible = true;
  slot.mesh.scale.setScalar(1);
  slot.x = x; slot.y = y; slot.z = z;
  slot.vx = rand(-3.2, 3.2); slot.vy = rand(1.6, 4.2); slot.vz = rand(-3.2, 3.2);
  slot.rx = rand(0, 6.283); slot.ry = rand(0, 6.283); slot.rz = rand(0, 6.283);
  slot.sx = rand(-8, 8); slot.sy = rand(-8, 8); slot.sz = rand(-8, 8);
  slot.mesh.position.set(x, y, z);
  slot.mesh.rotation.set(slot.rx, slot.ry, slot.rz);
}

// GRAVITY IS NOT A CONSTANT IN THIS GAME, and this was written as though it
// were: 24 is main.js's number and the Drift runs at 0.36 g. So every scrap
// knocked off a table up there fell at nearly three times the rate of the thing
// that knocked it, in the one chapter whose entire premise is that it does not.
// The buoyancy solver forty lines up already reads the live number
// (`-physGame.world.gravity.y`); this is the same read, hoisted to once per
// frame rather than once per scrap.
function physRubG() {
  const w = physGame && physGame.world;
  const g = w && w.gravity ? -w.gravity.y : 24;
  return (typeof g === 'number' && g === g && g > 0) ? g : 24;
}
const physRUB_BOUNCE = 0.34;
const physRUB_SKID = 0.55;       // horizontal speed kept through a bounce
const physRUB_REST_V = 0.55;     // m/s below which a grounded scrap gives up

function physRubbishUpdate(dt, live) {
  const rubG = physRubG();          // once per frame, not once per scrap
  for (let i = 0; i < physRubbish.length; i++) {
    const r = physRubbish[i];
    if (!r.active) continue;
    if (r.biome !== live) continue;    // frozen with its biome, not aged out unseen
    r.life -= dt;
    if (r.life <= 0 || r.y < -14) {
      r.active = false;
      r.rest = false;
      r.mesh.visible = false;
      r.mesh.scale.setScalar(1);
      r.y = -900;
      continue;
    }
    // shrink away over the last 0.8s instead of blinking out of existence
    if (r.life < 0.8) r.mesh.scale.setScalar(clamp(r.life / 0.8, 0.02, 1));
    if (r.rest) continue;              // settled: nothing left to integrate

    r.vy -= rubG * dt;
    r.x += r.vx * dt;
    r.y += r.vy * dt;
    r.z += r.vz * dt;
    const floor = physSurfaceY(r.x, r.z) + 0.1;
    if (r.y <= floor) {
      r.y = floor;
      if (r.vy < -physRUB_REST_V) {
        r.vy = -r.vy * physRUB_BOUNCE;
        r.vx *= physRUB_SKID;
        r.vz *= physRUB_SKID;
        r.sx *= physRUB_SKID; r.sy *= physRUB_SKID; r.sz *= physRUB_SKID;
      } else {
        r.vy = 0;
        // ground friction, frame-rate independent
        const k = Math.exp(-7 * dt);
        r.vx *= k; r.vz *= k;
        r.sx *= k; r.sy *= k; r.sz *= k;
        if (r.vx * r.vx + r.vz * r.vz < 0.02 && Math.abs(r.sx) + Math.abs(r.sz) < 0.5) {
          r.rest = true;
          // lie flat where it stopped, the way a dropped wrapper does
          r.rx = 0; r.rz = 0;
          r.mesh.position.set(r.x, r.y - 0.06, r.z);
          r.mesh.rotation.set(0, r.ry, 0);
          continue;
        }
      }
    }
    r.rx += r.sx * dt;
    r.ry += r.sy * dt;
    r.rz += r.sz * dt;
    r.mesh.position.set(r.x, r.y, r.z);
    r.mesh.rotation.set(r.rx, r.ry, r.rz);
  }
}

// ===========================================================================
// 8b. PASTO — ANDEAN PROPS, MARKET STALLS, THE CRATER (chapter 2)
//
// Everything in this section is built lazily on the first 'biome:enter' for
// 'pasto' and is therefore auto-tagged to that biome: Sydney pays nothing for
// it, and the Andes pay nothing for Sydney's harbour code (see physPastoLive,
// which gates every water path).
//
// The stall contract (pasto.js owns the record, props.js owns the physics).
// EVERY field is optional and typeof-guarded, because pasto.js is being built
// concurrently and may publish `stalls` a frame — or a round — after we look:
//
//   game.pasto.stalls[i] = {
//     x, z, y, yaw, radius, tableY,      // numbers; sensible fallbacks below
//     bodies: [CANNON.Body],             // frame: posts, table, awning
//     supports: [CANNON.Body],           // alternative name for the same thing
//     parts: [{ body, mesh }],           // pairing, if the frame is mesh-backed
//     awning: CANNON.Body,               // flops DOWN rather than out
//     collapsed: bool,                   // props.js mirrors its own state here
//     collapse(opts)                     // INSTALLED HERE if pasto.js leaves it
//   }
// ===========================================================================
function physNum(v, d) { return typeof v === 'number' && v === v ? v : d; }

// Fallback stall ring, straight off CONTRACT.md's Pasto layout table
// (market stalls x [-26, 26], z [10, 30]). Used only until pasto.js publishes.
const physPASTO_STALLS = [
  [-19, 13], [-7, 12], [7, 12], [19, 13], [-19, 27], [19, 27],
];
// What each stall sells, cycled. Three items per table keeps the produce
// readable from above and the body count honest.
//
// These are TYPE KEYS, not labels — what the player reads is the `name` on the
// row in physTYPES ('ruana', 'Nariño hat', 'painted bowl'), and those are right.
// What was wrong was the MIX: two of the six tables sold nothing but things you
// wear, which is a market of a culture rather than a market. A Pasto plaza
// stall is produce with a bit of craft on the end of it, so every table now
// has something you can eat on it.
const physSTALL_MENU = [
  ['empanada', 'empanada', 'arepa'],
  ['maiz', 'plantain', 'arepa'],
  ['cuencobowl', 'empanada', 'maiz'],
  ['ruana', 'cuencobowl', 'plantain'],
  ['plantain', 'maiz', 'empanada'],
  ['sombrero', 'maiz', 'arepa'],
];
// The coffee drying patio, laid out around one anchor point on the terraces.
const physPATIO = [
  ['coffeesack', -1.2, -0.9], ['coffeesack', 0.5, -1.3], ['coffeesack', 1.6, 0.4],
  ['coffeesack', -0.4, 1.2], ['cuencobowl', 2.4, -0.6], ['arepa', -2.1, 0.3],
];

// ---- THE ONE THING YOU MAY BRING WITH YOU (item 5) ------------------------
// See the note inside physOnBiomeEnter. `physTravelP` is the single loose copy
// alive at any moment; there is deliberately no list.
let physTravelP = null;
let physTravelWhy = "never called";   // the last decision, for the harness
// WHAT MAY NOT TRAVEL, and each of these is a different reason rather than a
// longer version of the same one:
//   poster    it is not the chapter's, it is YOURS, and posterPut already
//             stands a fresh one wherever you land — a travelling one would
//             be two of the same joke in the same square
//   keep      a keepsake is not confiscated in the first place, so it never
//             reaches this code; naming it here is the assertion that it
//             must not ALSO be copied if that ever changes
//   planted   a planted prop is scenery with a body, not luggage
const physNO_TRAVEL = { poster: 1 };
/**
 * Send a loose copy of `type` through the border and put it in the mouth.
 * Called with the ORIGINAL's type after it has already been sent home.
 */
function physTravelThrough(type, from, capy) {
  capy = capy || (physGame && physGame.capy);
  const def = physTYPES[type];
  physTravelWhy = "called";
  if (!def) { physTravelWhy = "no def for " + type; return; }
  if (physNO_TRAVEL[type]) { physTravelWhy = "refused: " + type; return; }
  if (def.planted) { physTravelWhy = "planted"; return; }
  if (def.grabbable === false) { physTravelWhy = "not grabbable"; return; }
  if (def.keep) { physTravelWhy = "keepsake"; return; }
  // The previous traveller went home. Removed BEFORE the new one is made, so
  // the count can never be two even for a frame.
  if (physTravelP && !physTravelP.removed) physRemoveProp(physTravelP);
  physTravelP = null;
  const p = capy && capy.position;
  if (!p) { physTravelWhy = "no animal"; return; }
  let made = null;
  try {
    made = physMakeProp(type, p.x, p.z, type === "flower" ? randInt(0, 2) : 0,
                        undefined, undefined, true);
  } catch (err) { made = null; physTravelWhy = "threw: " + err.message; }
  if (!made) { if (!physTravelWhy) physTravelWhy = "makeProp returned null"; return; }
  physTravelWhy = "travelled";
  made.disturbed = true;                // it is yours; you brought it
  // ...and NOBODY HERE OWNS IT. See localOwnerOf in npc.js: ownership is
  // proximity to a prop's home, a travelled prop's home is wherever it landed,
  // and the pickup below emits `capy:grab` like any other — so without this
  // the nearest person to the arrival spawn read your luggage as a robbery and
  // walked over and took it back, measured, every single time.
  made.travelled = true;
  // ...and WHERE IT CAME FROM, which is the half that makes it worth
  // carrying. npc.js already has a pool for an object that is not from here
  // (see npcKeepStep) and it keyed on `keep`, so it could only ever remark on
  // the nineteen souvenirs. This is the same fact about ordinary luggage.
  made.travelFrom = from || "";
  physTravelP = made;
  // ...and straight back into the mouth, because the animal never let go of
  // it. A crossing that puts your luggage on the floor at your feet is a
  // different and much worse sentence.
  try {
    physTravelWhy = physGrab(made) ? "travelled, in the mouth" : "travelled, grab refused";
  } catch (err) { physTravelWhy = "travelled, grab threw: " + err.message; }
}
/** For the harness. Nothing in src reads this. */
function physTravelAudit() {
  return { has: !!(physTravelP && !physTravelP.removed),
           type: physTravelP ? physTravelP.type : '',
           held: !!(physTravelP && physTravelP.held),
           biome: physTravelP ? physTravelP.biome : null,
           from: physTravelP ? physTravelP.travelFrom : "", why: physTravelWhy };
}

function physOnBiomeEnter(e) {
  // A prop carried through the departures board cannot be released abroad: its
  // body was removed from the world with its home biome, so physRelease would
  // leave it dynamic-but-unsimulated and invisible (its instance slot lives in
  // the home biome's InstancedMesh) — a task soft-lock. Customs are strict:
  // travel empties the mouth and the prop goes home, whole.
  const capy = physGame && physGame.capy;
  const held = capy && capy.heldProp;
  if (held && e && held.biome && held.biome !== e.name) {
    const b = held.body;
    if (held.mesh) {
      // Raw add, not the patched scene.add: the capture tag is already the NEW
      // biome, and this mesh must not be claimed by it — it is going home.
      THREE.Object3D.prototype.add.call(physGame.scene, held.mesh);
      held.pop = 1; held.sq = 0; held.sqV = 0;
      held.mesh.scale.setScalar(1);
    }
    b.type = CANNON.Body.DYNAMIC;
    b.updateMassProperties();
    b.collisionResponse = true;
    b.collisionFilterMask = -1;
    b.allowSleep = true;
    held.held = false;
    held.owner = null;
    capy.heldProp = null;
    physSetSolo(held, false);
    physRescue(held);
    // ---- ...AND YOU MAY BRING ONE THING WITH YOU (item 5) ---------------
    // Customs stays strict and the paragraph above is untouched: the ORIGINAL
    // goes home, whole, for the reason it always did — its body left the world
    // with its own chapter and releasing it abroad would leave it dynamic,
    // unsimulated and invisible, which is a task soft-lock.
    //
    // What crosses is a LOOSE COPY, made through the one hatch in this file
    // that already carries objects between chapters every day: `physMakeProp`
    // with `loose` set gives it `biome: ''`, adds its mesh through
    // physSceneAddLoose and its body through physWorldAddLoose, and draws it
    // solo. Nineteen keepsakes have been doing exactly this since they were
    // built, and props.js's own note calls a keepsake "the only object in the
    // game that genuinely travels". This makes that one instead of nineteen.
    //
    // IDENTITY IS NOT PRESERVED AND NOTHING IN THE GAME READS IT. No task, no
    // find, no record and no name is keyed to a prop instance; they are keyed
    // to types and to events. What the player experiences — I carried my cone
    // through the door and I still have my cone — is exactly true, and the
    // alternative (re-tagging a live prop, moving its mesh out of the chapter's
    // capture group and its body out of the chapter's list) is surgery on the
    // three mechanisms this confiscation exists to protect.
    //
    // ONE AT A TIME, EVER. The previous traveller is removed on the way
    // through, which bounds the whole feature at a single extra draw call
    // against a budget this file puts at 220 with a worst case of 122 — and
    // makes the rule sayable: you can bring one thing.
    physTravelThrough(held.type, capy);
  }
  // ---- ...AND THE ONE KIND OF PROP CUSTOMS DOES NOT TOUCH ----------------
  // A keepsake in the mouth crosses with the animal and is not confiscated:
  // the gate above only fires on a prop with a biome tag, and a keepsake has
  // none. What DOES have to happen is the ones lying on the ground: every
  // chapter is authored in the same coordinate space, so a pine cone left on
  // the sand at Manly is, in Venice, thirty metres out in the Bacino or inside
  // the campanile. They are moved to wherever the animal is about to be put
  // down, which is the only point in a new world that is guaranteed to be
  // standable — that is what a spawn point IS.
  if (e && physGame.biome && typeof physGame.biome.spawnOf === 'function') {
    const sp = physGame.biome.spawnOf(e.name);
    const arr = physGame.props;
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.removed || p.biome || p.held || !p.keep) continue;
      // Fanned out around the spawn rather than stacked on it: seventeen
      // keepsakes dropped on one point is a physics explosion on frame one.
      // TIGHT, though — the golden angle over a radius that reaches 2.7 m and
      // not 4.5 — because a spawn point is only guaranteed standable AT the
      // spawn point, and four metres off the Drift's shelf or the Quay's apron
      // is open air.
      const a = (n++) * 2.399963;                  // the golden angle
      const r = 0.7 + n * 0.12;
      const kx = sp.x + Math.cos(a) * r, kz = sp.z + Math.sin(a) * r;
      p.body.position.set(kx, sp.y + 0.6, kz);
      p.body.velocity.set(0, 0, 0);
      p.body.angularVelocity.set(0, 0, 0);
      p.body.force.set(0, 0, 0);
      p.body.torque.set(0, 0, 0);
      // AND ITS HOME MOVES WITH IT. `homeX/Y/Z` is where physRescue puts a prop
      // that has fallen out of the world, and for a keepsake it was still the
      // coordinates of the chapter it was first put down in — so one that went
      // over an edge in Venice was rescued to a point in Sydney's gardens,
      // which in Venice is somewhere in the Bacino.
      // ...AND `homeY` IS A SURFACE, NOT A BODY CENTRE.
      //
      // physRescue puts a prop down at `homeY + originY + 0.05` — it reads
      // this as the GROUND under the prop. `sp.y` is the capybara’s spawn,
      // which is a body centre with the animal’s own radius already in it, so
      // every relocated keepsake was given a home about a metre and a half in
      // the air. Rescued, it was placed there, immediately slept — physRescue
      // sleeps a body on purpose, so it never falls — and hung. Measured in 12
      // of 17 chapters: Goreme 3.34 m above its own resting height, the Drift
      // 1.65, Kyoto 1.50, six more at 1.45, Antarctica 1.15, the Quay 0.85.
      // Ask the ground where it is, and only fall back on the spawn where the
      // chapter publishes no terrain at all.
      // ...AND NOTHING OUT HERE KNOWS WHAT IS UNDER THAT POINT.
      //
      // `sp.y` is the capybara’s spawn: a DROP height with the animal’s own
      // radius and some clearance already in it, so using it put every
      // relocated keepsake up to 3.34 m in the air — and physRescue sleeps a
      // body on the frame it places it, so it hung there. Asking the terrain
      // instead is closer and still wrong in the other direction: five spawns
      // are on a STRUCTURE — Venice’s quay, the Pantanal’s causeway,
      // Antarctica’s jetty, Göreme’s plaza floor, Palawan’s jetty — and
      // `terrainHeight` answers for the ground underneath a deck, not for the
      // deck. Measured, that buried them by up to 1.23 m.
      //
      // Only the solver knows what is actually under a point. So the prop
      // FINDS ITS OWN HOME: a provisional value now, and the moment it comes
      // to rest the height it actually rested at is written back. See
      // physHomeLearn.
      const gy = physTerrainAt(kx, kz);
      p.homeX = kx; p.homeZ = kz; p.homeY = (gy === gy) ? gy : sp.y;
      p.homeLearn = true;
      physSyncBodyTransform(p.body);
      p.body.wakeUp();
      physSyncMesh(p, true);
    }
  }
  if (!e) return;
  if (e.name !== 'pasto') { physScatterBiome(e.name); return; }
  physBindStalls();
  if (physPastoBuilt) return;
  physPastoBuilt = true;
  // physInitPuff/physInitShards used to be called from HERE, inside the pasto
  // capture — which is what made both pools Pasto's property. They are built at
  // boot and biome-neutral now; see physSceneAddLoose.
  physScatterPasto();
}

// ---- stall binding --------------------------------------------------------
function physCollectStallBodies(s, rec) {
  const seen = rec.bodies;
  const awn = rec.awn;
  const meshes = rec.meshes;
  const take = function (b, m, isAwning) {
    if (!b || typeof b.addShape !== 'function') return;
    if (seen.indexOf(b) >= 0) return;
    seen.push(b);
    awn.push(!!isAwning);
    meshes.push(m && m.isObject3D ? m : (b.mesh && b.mesh.isObject3D ? b.mesh : null));
  };
  const awning = s.awning || s.awningBody || s.canopy || null;
  if (Array.isArray(s.parts)) {
    for (let i = 0; i < s.parts.length; i++) {
      const p = s.parts[i];
      if (p) take(p.body, p.mesh, p.awning || p.body === awning);
    }
  }
  if (Array.isArray(s.bodies)) for (let i = 0; i < s.bodies.length; i++) take(s.bodies[i], null, s.bodies[i] === awning);
  if (Array.isArray(s.supports)) for (let i = 0; i < s.supports.length; i++) take(s.supports[i], null, false);
  // pasto.js pairs the awning frame's mesh with the awning body and drives it
  // from the body only WHILE `collapsed` is set — so props.js takes the same
  // pairing, and can put the mesh back on its rest transform when it re-sleeps
  // the stall (at which point pasto.js has stopped looking at it).
  if (awning) take(awning, s.awningMesh || s.mesh, true);
}

function physBindStall(s, idx) {
  const fb = physPASTO_STALLS[idx % physPASTO_STALLS.length];
  const pos = s && s.position && typeof s.position.x === 'number' ? s.position : null;
  const grp = s && s.group && s.group.position ? s.group.position : null;
  const x = physNum(s && s.x, physNum(pos && pos.x, physNum(grp && grp.x, fb[0])));
  const z = physNum(s && s.z, physNum(pos && pos.z, physNum(grp && grp.z, fb[1])));
  const ground = physSurfaceY(x, z);
  const rec = {
    stall: s,
    x, z,
    y: physNum(s && s.y, physNum(pos && pos.y, ground)),
    yaw: physNum(s && s.yaw, physNum(s && s.rotation, 0)),
    radius: physNum(s && s.radius, physSTALL_R),
    tableY: physNum(s && s.tableY, physNum(s && s.tableTop, ground + 0.95)),
    bodies: [], awn: [], meshes: [],
    rest: null, mass0: null, type0: null,
    collapsed: false, inCollapse: false, prevCollapse: null,
    onHit: null,
    // A collide callback fires from inside world.step. Flipping bodies from
    // static to dynamic there would mutate the solver mid-solve, so the hit is
    // recorded and the collapse runs at the top of the next physPastoUpdate.
    pending: false, pdx: 0, pdz: 1, pf: 1,
  };
  if (s) {
    physCollectStallBodies(s, rec);
    const n = rec.bodies.length;
    rec.rest = new Float32Array(n * 7);
    rec.mass0 = new Float32Array(n);
    rec.type0 = new Int32Array(n);
    for (let i = 0; i < n; i++) {
      const b = rec.bodies[i];
      const o = i * 7;
      rec.rest[o] = b.position.x; rec.rest[o + 1] = b.position.y; rec.rest[o + 2] = b.position.z;
      rec.rest[o + 3] = b.quaternion.x; rec.rest[o + 4] = b.quaternion.y;
      rec.rest[o + 5] = b.quaternion.z; rec.rest[o + 6] = b.quaternion.w;
      rec.mass0[i] = b.mass;
      rec.type0[i] = b.type;
    }
    if (n) {
      rec.onHit = function (e) { physStallHit(rec, e); };
      for (let i = 0; i < n; i++) rec.bodies[i].addEventListener('collide', rec.onHit);
    }
    // Publish the physics behind stalls[i].collapse(). If pasto.js authored its
    // own (a visual flourish, say) it is kept and called after the impulses.
    rec.prevCollapse = typeof s.collapse === 'function' ? s.collapse : null;
    s.collapse = function (opts) {
      physStallCollapse(rec,
        physNum(opts && opts.dx, 0), physNum(opts && opts.dz, 1),
        physNum(opts && opts.force, 1));
    };
  }
  return rec;
}

/** Idempotent: binds any stall pasto.js has published that we have not seen. */
function physBindStalls() {
  const p = physGame.pasto;
  const list = p && Array.isArray(p.stalls) ? p.stalls : null;
  if (!list) return false;
  let added = false;
  for (let i = 0; i < list.length; i++) {
    const s = list[i];
    if (!s || typeof s !== 'object' || physStallSeen.has(s)) continue;
    physStallSeen.add(s);
    physStalls.push(physBindStall(s, physStalls.length));
    added = true;
  }
  return added;
}

/** No stalls published yet — lay the market out from the contract table. */
function physFallbackStalls() {
  for (let i = 0; i < physPASTO_STALLS.length; i++) physStalls.push(physBindStall(null, i));
}

// ---- the collapse ---------------------------------------------------------
/** Lowest point of a body's shapes, in world y. Yaw does not change it. */
function physBodyBottom(b) {
  let lo = 0;
  for (let i = 0; i < b.shapes.length; i++) {
    const s = b.shapes[i];
    const o = b.shapeOffsets[i];
    const hy = s.halfExtents ? s.halfExtents.y
      : (typeof s.radius === 'number' ? s.radius : (s.boundingSphereRadius || 0));
    const y = o.y - hy;
    if (i === 0 || y < lo) lo = y;
  }
  return b.position.y + lo;
}

/**
 * A stall frame is authored STANDING IN its own counter: the awning posts run
 * from the ground up through the market's merged table collider. While that
 * overlap exists the solver clamps the body and no impulse can tip it — the
 * frame just sits there being barged. So the instant it goes dynamic it is
 * lifted clear of the counter, once, and from there the fall is entirely
 * physics: gravity, the tipping impulse and whatever it lands on.
 *
 * A hand write to body.position MUST drag previousPosition / interpolatedPosition
 * with it (physSyncBodyTransform) or the renderer smears it in from the old spot.
 */
function physUnwedge(rec, b) {
  const clear = rec.tableY + 0.08;
  const bottom = physBodyBottom(b);
  if (bottom >= clear) return 0;
  const want = clear - bottom;
  const lift = want < physUNWEDGE_MAX ? want : physUNWEDGE_MAX;
  b.position.y += lift;
  physSyncBodyTransform(b);
  return lift;
}

/**
 * Tipping a four-legged awning frame.
 *
 * Measured: pasto.js's frame is four 2.7 m posts at (±1.5, ±0.9) carrying a
 * 3.5 x 2.2 m canopy — a 16 kg body standing on a 3 x 1.8 m footprint with all
 * four feet flat on the cobbles (32 live contact points, traced). Every torque
 * you can apply to a body in that state is eaten by the contact solver: a spin
 * about its own centre of mass drives the leading legs into the ground, and the
 * trace showed 4.4 rad/s collapsing to 0.1 within two frames. Rotating about
 * the far row of feet instead (v = ω × r about the pivot edge) was measured
 * too, and dies the same way.
 *
 * What works is getting the posts out of the COUNTER they are standing inside.
 * Swept the hoist against a measured tip: at +0.45 m and +0.8 m the spin is
 * dead within 12 frames and the body does not even fall (0.06 m in 3 s — it is
 * still resting on the counter collider); at +1.1 m — i.e. `tableY + 0.08`,
 * exactly the constant physUnwedge already used — the spin survives and the
 * frame ends flat on its side (up·y = 0.03). An upward LAUNCH instead of the
 * hoist was tried and is eaten the same way, because the obstruction is
 * horizontal, not underfoot. So the hoist stays; what changes is that the frame
 * is thrown DOWN out of it rather than left to hang, and physStallCollapse
 * fires a wide puff at the legs on the same frame to cover the jump.
 */
function physTipFrame(rec, b, nx, nz, f) {
  physUnwedge(rec, b);
  // Down, not up: the frame is already as high as it will ever be, and every
  // extra frame it spends hanging there is a frame the player reads as a bug.
  // -1.2 m/s buys back a third of the fall time; at physTIP_W it is still 60°
  // past vertical before the posts touch anything, which is over the edge.
  b.velocity.set(nx * 2.6 * f, -1.2, nz * 2.6 * f);
  b.angularVelocity.set(nz * physTIP_W * f, rand(-1, 1), -nx * physTIP_W * f);
}

function physStallCollapse(rec, dx, dz, force) {
  if (!rec || rec.collapsed || rec.inCollapse) return false;
  rec.inCollapse = true;
  // pasto.js owns the frame's own drop — the awning body's mass, its mesh sync
  // and its own flourish — and guards on `stall.collapsed`, so its hook runs
  // FIRST, while the flag is still clear. props.js then adds the physics that
  // makes it a market disaster rather than a falling roof.
  let handed = false;
  if (rec.prevCollapse) {
    try { handed = rec.prevCollapse.call(rec.stall, { dx: dx, dz: dz, force: force }) !== false; }
    catch (err) { handed = false; }
  }
  rec.collapsed = true;
  if (rec.stall) rec.stall.collapsed = true;
  physCollapsed.push(rec);
  // Never leave more than physSTALL_MAX frames loose in the solver: the oldest
  // goes back to its exact rest transform, static and asleep.
  while (physCollapsed.length > physSTALL_MAX) physStallRestore(physCollapsed.shift());

  let nx = dx;
  let nz = dz;
  const l = Math.sqrt(nx * nx + nz * nz);
  if (l > 1e-3) { nx /= l; nz /= l; } else { nx = 0; nz = 1; }
  const f = force > 0 ? force : 1;

  for (let i = 0; i < rec.bodies.length; i++) {
    const b = rec.bodies[i];
    const isAwn = rec.awn[i];
    // Only promote what pasto.js left standing, and never overwrite a mass it
    // chose for itself.
    if (b.type !== CANNON.Body.DYNAMIC) {
      b.type = CANNON.Body.DYNAMIC;
      if (b.mass <= 0) b.mass = isAwn ? 12 : 5;
      b.updateMassProperties();
    }
    b.collisionResponse = true;
    b.allowSleep = true;
    b.sleepSpeedLimit = 0.3;
    b.sleepTimeLimit = 0.7;
    b.linearDamping = 0.04;
    b.angularDamping = 0.2;
    b.wakeUp();
    const m = b.mass > 0 ? b.mass : 1;
    if (isAwn) {
      physTipFrame(rec, b, nx, nz, f);
    } else {
      physUnwedge(rec, b);
      physCV3.set(nx * 2.6 * f * m, 1.5 * f * m, nz * 2.6 * f * m);
      physCV4.set(rand(-0.25, 0.25), 0.4, rand(-0.25, 0.25));
      b.applyImpulse(physCV3, physCV4);
      b.angularVelocity.set(rand(-3.4, 3.4), rand(-2.2, 2.2), rand(-3.4, 3.4));
    }
  }

  physStallScatter(rec, nx, nz, f);

  // The clatter. pasto.js already thuds and shakes if it handled the drop —
  // doubling either one just flanges the sample and jolts the camera twice.
  if (!handed) {
    physSfxOpts.volume = 1;
    physGame.sfx('thud', physSfxOpts);
    physGame.shake(clamp(0.55 * f, 0.2, 0.8));
  } else {
    physGame.shake(clamp(0.2 * f, 0.1, 0.3));
  }
  physSfxOpts.volume = 0.95;
  physGame.sfx('rustle', physSfxOpts);
  // Wide and low, at the feet: this fires on the same frame the frame is
  // hoisted out of its counter, and is what the eye reads instead of the jump.
  physPuff3(rec.x, rec.y + 0.35, rec.z, 10, 2.4);
  physTask('market-chaos');

  rec.inCollapse = false;
  return true;
}

/** Everything on (or near) the table goes flying. */
function physStallScatter(rec, nx, nz, f) {
  const arr = physGame.props;
  const t = physGame.state ? physGame.state.time : 0;
  const r = rec.radius + 1.2;
  const r2 = r * r;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.removed || p.hidden || p.held || p.frozen || p.spilled) continue;
    if (p.stall !== rec) {
      const dx = p.body.position.x - rec.x;
      const dz = p.body.position.z - rec.z;
      if (dx * dx + dz * dz > r2) continue;
    }
    const b = p.body;
    b.wakeUp();
    const m = p.mass;
    // Gravity here is 24 m/s², not 9.8. The impulses this used to apply gave
    // 3 m/s of lift, which is a 0.19 m hop and a 0.5 m skid: measured against a
    // screenshot, the produce simply landed back on its own table in formation.
    // These throw an empanada 1–2 m clear of the stall, which is the joke.
    physCV3.set(
      (nx * 3.6 + rand(-3.0, 3.0)) * f * m,
      rand(5.5, 8.5) * f * m,
      (nz * 3.6 + rand(-3.0, 3.0)) * f * m
    );
    b.applyImpulse(physCV3);
    b.angularVelocity.set(rand(-11, 11), rand(-11, 11), rand(-11, 11));
    physStampTouch(p);
    p.releaseTime = t;
    p.settled = false;
    if (physTYPES[p.type].spill && !p.spilled) p.spillArmed = true;
  }
}

function physStallRestore(rec) {
  if (!rec || !rec.collapsed) return;
  rec.collapsed = false;
  if (rec.stall) rec.stall.collapsed = false;
  for (let i = 0; i < rec.bodies.length; i++) {
    const b = rec.bodies[i];
    const o = i * 7;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.force.set(0, 0, 0);
    b.torque.set(0, 0, 0);
    b.position.set(rec.rest[o], rec.rest[o + 1], rec.rest[o + 2]);
    b.quaternion.set(rec.rest[o + 3], rec.rest[o + 4], rec.rest[o + 5], rec.rest[o + 6]);
    physSyncBodyTransform(b);
    b.mass = rec.mass0[i];
    b.type = rec.type0[i];
    b.updateMassProperties();
    b.allowSleep = true;
    b.sleep();
    physStallSyncOne(rec, i, true);
  }
}

/** Drives any mesh pasto.js paired with a frame body. No pairing, no work. */
function physStallSyncOne(rec, i, exact) {
  const o3d = rec.meshes[i];
  if (!o3d) return;
  const b = rec.bodies[i];
  const bp = exact ? b.position : b.interpolatedPosition;
  const bq = exact ? b.quaternion : b.interpolatedQuaternion;
  physPV1.set(bp.x, bp.y, bp.z);
  physPQ1.set(bq.x, bq.y, bq.z, bq.w);
  // The body transform is world-space; the mesh may hang under pasto.js's own
  // root, so fold it back through the parent's inverse before writing it.
  const parent = o3d.parent;
  if (parent && parent !== physGame.scene) {
    parent.updateWorldMatrix(true, false);
    physPM4.copy(parent.matrixWorld).invert();
    physPV1.applyMatrix4(physPM4);
    physQ2.setFromRotationMatrix(physPM4);
    physPQ1.premultiply(physQ2);
  }
  o3d.position.copy(physPV1);
  o3d.quaternion.copy(physPQ1);
}

function physStallSync(rec) {
  for (let i = 0; i < rec.bodies.length; i++) physStallSyncOne(rec, i, false);
}

function physStallHit(rec, e) {
  if (rec.collapsed || rec.pending) return;
  const capy = physGame.capy;
  if (!capy || !capy.body || !capy.position) return;
  if (!(e.body === capy.body || physIsCapyAgent(e.body))) return;
  const c = e.contact;
  const sp = c ? Math.abs(c.getImpactVelocityAlongNormal()) : 0;
  const v = capy.velocity;
  const cs = v ? Math.sqrt(v.x * v.x + v.z * v.z) : 0;
  if (sp < 2.8 && cs < physSTALL_BARGE) return;
  rec.pending = true;
  rec.pdx = rec.x - capy.position.x;
  rec.pdz = rec.z - capy.position.z;
  rec.pf = clamp(0.7 + cs * 0.14, 0.7, 1.6);
}

/** Public: game.physics.collapseStall(stallRecordOrIndex). */
function physCollapseStallByRef(which) {
  for (let i = 0; i < physStalls.length; i++) {
    const rec = physStalls[i];
    if (rec === which || rec.stall === which || i === which) {
      return physStallCollapse(rec, rand(-1, 1), rand(-1, 1), 1);
    }
  }
  return false;
}

/** Barge / tug detection for stalls whose frame we could not get bodies for. */
function physStallTriggers() {
  const capy = physGame.capy;
  if (!capy || !capy.position) return;
  const v = capy.velocity;
  const sp = v ? Math.sqrt(v.x * v.x + v.z * v.z) : 0;
  const input = physGame.input;
  // A grab press with nothing in reach and nothing in the mouth is a tug on the
  // awning rope — the player is clearly pulling at the stall itself.
  const tug = !!(input && input.actionPressed) && !capy.heldProp &&
              physNearestGrabbable(capy.position, 1.5) === null;
  if (sp <= physSTALL_BARGE && !tug) return;
  for (let i = 0; i < physStalls.length; i++) {
    const rec = physStalls[i];
    if (rec.collapsed) continue;
    const dx = rec.x - capy.position.x;
    const dz = rec.z - capy.position.z;
    const d2 = dx * dx + dz * dz;
    if (sp > physSTALL_BARGE && d2 < rec.radius * rec.radius) {
      physStallCollapse(rec, dx, dz, clamp(0.7 + sp * 0.14, 0.7, 1.6));
    } else if (tug) {
      const r = rec.radius + 1.1;
      if (d2 < r * r) physStallCollapse(rec, dx, dz, 0.8);
    }
  }
}

// ---- the crater -----------------------------------------------------------
function physCraterAt(out) {
  const p = physGame.pasto;
  const c = p && p.craterCentre;
  out.set(physNum(c && c.x, -40), physNum(c && c.y, 44), physNum(c && c.z, -70));
  return out;
}

// Fixed lines — a toast built by concatenation would allocate on an event that
// fires from inside physUpdate.
const physCRATER_LINES = [
  'Galeras swallows it whole',
  'gone — straight down the vent',
  'the mountain accepts your offering',
];
let physCraterLine = 0;
let physCraterToastAt = -1e9;

/**
 * Galeras is only funny if the prop makes the whole journey: over the crest,
 * down the inner wall, and out of sight at the vent. Two rules do that.
 *
 * 1. It is EATEN only on the floor (physCRATER_EAT_R ≈ the flat bit at the
 *    bottom) — never halfway down the wall, where the puff would go off at eye
 *    level and read as "it hit a rock".
 * 2. Inside the rim crest it may not come to rest AT ALL. The volcano collider
 *    is a 4 m heightfield, so its inner wall has ledges the real surface does
 *    not have, and a prop balanced on one — visible from the rim, mocking you —
 *    kills the gag. Anything that stops in the bowl gets shoved on (below).
 */
function physCraterCheck(p, dt) {
  const b = p.body;
  const c = physCraterAt(physPV1);
  const dx = b.position.x - c.x;
  const dz = b.position.z - c.z;
  const d2 = dx * dx + dz * dz;
  if (d2 > physCRATER_RIM * physCRATER_RIM) {
    if (p.craterIn) { p.craterIn = false; p.craterIdle = 0; p.craterTries = 0; }
    return;
  }
  if (!p.craterIn) {
    p.craterIn = true;
    p.craterIdle = 0;
    p.craterTries = 0;
    p.craterY = b.position.y;
  }
  // Height is measured off craterCentre.y — the vent floor — and NOT off
  // physSurfaceY. The collider is a 4 m heightfield and on a wall this steep it
  // sits metres away from the analytic surface, so "am I on the ground" is not
  // an answerable question here. "Am I at the bottom" is.
  if (b.position.y <= c.y + physCRATER_FLOOR_H && d2 <= physCRATER_EAT_R * physCRATER_EAT_R) {
    physCraterEat(p);
    return;
  }
  physCraterShove(p, dx, dz, d2, dt);
}

/** The payoff: ash, a thud from a long way down, a jolt, and a line. */
function physCraterEat(p) {
  const b = p.body;
  // A column, not a scuff: 16 m of volcano between this and the player's eye.
  physPuff3(b.position.x, b.position.y + 0.4, b.position.z, 9, 4.5);
  physPuff3(b.position.x, b.position.y + 2.2, b.position.z, 6, 3);
  physGame.sfx('thud', physSfxDeep);
  physGame.sfx('hiss', physSfxDeep2);
  physGame.shake(0.2);
  physDestroyPayload.prop = p;
  physGame.events.emit('prop:destroy', physDestroyPayload);
  const earned = physCausedByCapy(p, physCAUSE_CRATER);
  if (earned) physTask('crater-drop');
  // The checklist ticks once; the joke should land every single time.
  const t = physGame.state ? physGame.state.time : 0;
  if (earned && t - physCraterToastAt > 2.5 && typeof physGame.toast === 'function') {
    physCraterToastAt = t;
    physGame.toast(physCRATER_LINES[physCraterLine]);
    physCraterLine = (physCraterLine + 1) % physCRATER_LINES.length;
  }
  physHide(p, physHIDE_CRATER);
}

/**
 * Stopped on the inner wall. Wake it, kick it at the vent and spin it, so what
 * the player sees is a continuous tumble rather than a thing perched on a ledge.
 * The kick grows each time; after physCRATER_GIVEUP the mountain stops being
 * polite about it, which makes "balanced on the rim" unreachable by construction.
 */
function physCraterShove(p, dx, dz, d2, dt) {
  const b = p.body;
  const y = b.position.y;
  // The test is DESCENT, not stillness: a light prop on a 60° heightfield wall
  // buzzes against the facets forever without ever going anywhere, and a
  // velocity gate would read that as "moving" and never intervene.
  if (y < p.craterY - physCRATER_DESCEND) { p.craterY = y; p.craterIdle = 0; return; }
  p.craterIdle += dt;
  if (p.craterIdle < physCRATER_STILL) return;
  p.craterIdle = 0;
  p.craterY = y;
  p.craterTries++;
  const c = physCraterAt(physPV1);
  if (p.craterTries > physCRATER_GIVEUP) {
    // Wedged. Rather than leave it perched where the player can see it, drop it
    // down the vent by hand — the puff, the thud and the toast all still play
    // at the bottom, which is the only place they read.
    b.position.set(c.x + rand(-1, 1), c.y + 0.5, c.z + rand(-1, 1));
    physSyncBodyTransform(b);
    physCraterEat(p);
    return;
  }
  const d = d2 > 1e-6 ? Math.sqrt(d2) : 1;
  const m = b.mass > 0 ? b.mass : 1;
  const f = (1.5 + p.craterTries * 0.4) * m;
  b.wakeUp();
  p.settled = false;
  physCV3.set(-dx / d * f, 0.8 * m, -dz / d * f);
  b.applyImpulse(physCV3);
  b.angularVelocity.set(rand(-6, 6), rand(-3, 3), rand(-6, 6));
  physPuff3(b.position.x, b.position.y, b.position.z, 2);
}

// ---- shatter / hide / restock ---------------------------------------------
function physShatter(prop) {
  if (!prop || prop.hidden || prop.removed) return false;
  const b = prop.body;
  const x = b.position.x;
  const y = b.position.y;
  const z = b.position.z;
  // A camera and a pair of sunglasses do not break into pottery: `shard:`
  // on the type picks the material, and defaults to the ceramic sliver that
  // was the only one there was.
  physThrowShards(x, y, z, randInt(5, 6), (physTYPES[prop.type] || {}).shard || 0);
  physPuff3(x, y + 0.05, z, 4);
  physSfxOpts.volume = 0.95;
  physGame.sfx('pop', physSfxOpts);
  physSfxOpts.volume = 0.5;
  physGame.sfx('thud', physSfxOpts);
  physGame.shake(0.26);
  physDestroyPayload.prop = prop;
  physGame.events.emit('prop:destroy', physDestroyPayload);
  physHide(prop, physHIDE_BOWL);
  return true;
}

/** Parks a prop out of play WITHOUT destroying it: same body, asleep, off-map. */
function physHide(prop, delay) {
  if (!prop || prop.hidden) return;
  if (prop.held) {
    if (physGame.capy && physGame.capy.heldProp === prop) physGame.capy.heldProp = null;
    prop.held = false;
    if (prop.mesh.parent !== physGame.scene) physGame.scene.add(prop.mesh);
    physDropPayload.prop = prop;
    physGame.events.emit('capy:drop', physDropPayload);
  }
  prop.hidden = true;
  prop.hiddenUntil = (physGame.state ? physGame.state.time : 0) + delay;
  prop.grabbable = false;
  prop.spillArmed = false;
  prop.owner = null;
  const b = prop.body;
  if (b.type !== CANNON.Body.DYNAMIC) { b.type = CANNON.Body.DYNAMIC; b.updateMassProperties(); }
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.force.set(0, 0, 0);
  b.torque.set(0, 0, 0);
  b.collisionResponse = false;
  b.collisionFilterMask = -1;
  b.position.set(prop.homeX, -900, prop.homeZ);
  physSyncBodyTransform(b);
  b.allowSleep = true;
  b.sleep();
  // ---- ...AND STATIC, NOT MERELY ASLEEP (L6, E8 / qa F4) -------------------
  // A sleeping DYNAMIC body still has gravity, and nothing kept it asleep:
  // one wakeUp() from any path that touches the body — a gust, an owner, a
  // contact wake from the broadphase — and it fell from −900 at terminal
  // velocity until `hiddenUntil`, clamped by the sanitiser at MAIN_V_CAP once
  // a frame. Measured: Monaco's `camera` at −1 529 m and `solverSaves` +211
  // in nine seconds of standing at the spawn; Hanoi's wine bottle +45. The
  // escape check further down this file skips hidden props by design, so
  // nothing ever put it back. STATIC has no gravity and is not integrated,
  // whatever its sleep state; physUnhide re-types it before the rescue.
  b.type = CANNON.Body.STATIC;
  b.updateMassProperties();
  prop.mesh.visible = false;
  prop.pop = 1; prop.sq = 0; prop.sqV = 0;
  prop.mesh.scale.setScalar(1);
  physZeroInstance(prop);
  physHidden.push(prop);
}

function physUnhide(prop) {
  const def = physTYPES[prop.type];
  prop.hidden = false;
  prop.frozen = false;
  prop.tipped = false;
  prop.craterIn = false;
  prop.craterIdle = 0;
  prop.craterTries = 0;
  prop.grabbable = def.grabbable === false ? false : !prop.planted;
  prop.body.collisionResponse = true;
  prop.mesh.visible = prop.solo || !prop.instGroup;
  // Parked STATIC by physHide; a body the rescue is about to wake and drop
  // the last 35 cm has to be DYNAMIC again first, or it hangs there.
  if (prop.body.type !== CANNON.Body.DYNAMIC) {
    prop.body.type = CANNON.Body.DYNAMIC;
    prop.body.updateMassProperties();
  }
  physRescue(prop);                      // home, dead still, asleep, transforms synced
  physPuff3(prop.homeX, prop.homeY + 0.35, prop.homeZ, 3);
}

// ---- the puff pool (Pasto's dust; built inside the biome, so it is tagged) --
function physInitPuff() {
  if (physPuffMesh) return;
  physPuffMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.17, 6, 4),
    mat(PALETTE.smoke, { transparent: true, opacity: 0.6, depthWrite: false }),
    physPUFF_MAX
  );
  physPuffMesh.frustumCulled = false;
  physPuffMesh.castShadow = false;
  physPuffMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  physSceneAddLoose(physPuffMesh);   // biome-neutral — see physSceneAddLoose
  for (let i = 0; i < physPUFF_MAX; i++) physPuffLife[i] = 0;
  physWritePuff();
}

function physPuff3(x, y, z, count, size) {
  if (!physPuffMesh) return;
  const n = count || 4;
  const s = size > 0 ? size : 1;
  for (let k = 0; k < n; k++) {
    const i = physPuffHead;
    physPuffHead = (physPuffHead + 1) % physPUFF_MAX;
    physPuffPos[i * 3] = x + rand(-0.2, 0.2) * s;
    physPuffPos[i * 3 + 1] = y + rand(0.02, 0.24) * s;
    physPuffPos[i * 3 + 2] = z + rand(-0.2, 0.2) * s;
    physPuffVel[i * 3] = rand(-0.9, 0.9) * s;
    physPuffVel[i * 3 + 1] = rand(0.7, 1.9) * s;
    physPuffVel[i * 3 + 2] = rand(-0.9, 0.9) * s;
    physPuffSize[i] = s;
    physPuffSpan[i] = rand(0.7, 1.15) * (s > 1 ? 1 + (s - 1) * 0.45 : 1);
    physPuffLife[i] = physPuffSpan[i];
  }
  physPuffDirty = true;
}

function physWritePuff() {
  for (let i = 0; i < physPUFF_MAX; i++) {
    if (physPuffLife[i] > 0) {
      const age = 1 - physPuffLife[i] / physPuffSpan[i];
      const s = (0.55 + age * 1.5) * (1 - age * 0.55) * (physPuffSize[i] || 1);
      physV1.set(physPuffPos[i * 3], physPuffPos[i * 3 + 1], physPuffPos[i * 3 + 2]);
      physQ1.setFromAxisAngle(physUp, physPuffLife[i] * 2.4);
      physV2.set(s, s * 0.86, s);
      physM4.compose(physV1, physQ1, physV2);
    } else {
      physM4.compose(physV3.set(0, -900, 0), physQ2.identity(), physV2.set(0, 0, 0));
    }
    physPuffMesh.setMatrixAt(i, physM4);
  }
  physPuffMesh.instanceMatrix.needsUpdate = true;
}

function physPuffUpdate(dt) {
  if (!physPuffMesh) return;
  let any = false;
  for (let i = 0; i < physPUFF_MAX; i++) {
    if (physPuffLife[i] <= 0) continue;
    any = true;
    physPuffLife[i] -= dt;
    physPuffVel[i * 3 + 1] += 1.4 * dt;          // warm air, it keeps climbing
    physPuffPos[i * 3] += physPuffVel[i * 3] * dt;
    physPuffPos[i * 3 + 1] += physPuffVel[i * 3 + 1] * dt;
    physPuffPos[i * 3 + 2] += physPuffVel[i * 3 + 2] * dt;
    if (physPuffLife[i] <= 0) physPuffLife[i] = 0;
  }
  if (any || physPuffDirty) { physWritePuff(); physPuffDirty = any; }
}

// ---- the shard pool (ceramic slivers + spilled coffee beans) ---------------
// physSHARD_MAX bodies, created once, added to the world once and never removed:
// a break costs zero allocations and zero body churn.
function physShardGeo(kind) {
  const g = new THREE.Group();
  if (kind === 2) {
    // ---- B9: GLASS AND DARK PLASTIC ------------------------------------
    // Kind 0 is a white ceramic sliver, which is right for a bowl, a mug and
    // a bowl of pho and wrong for the three new fragile types that are made
    // of glass and camera body. A `shard:` on the type picks this instead.
    physAdd(g, physBoxG(0.09, 0.02, 0.07), PALETTE.glass, 0, 0.04, 0, 0.5, 0.3, 0.2);
    physAdd(g, new THREE.TetrahedronGeometry(0.07), PALETTE.stoneDark, 0.03, 0.07, 0.02);
  } else if (kind === 0) {
    physAdd(g, new THREE.TetrahedronGeometry(0.11), PALETTE.churchWhite, 0, 0.06, 0);
    physAdd(g, physBoxG(0.11, 0.03, 0.05), PALETTE.awning1, 0.02, 0.09, 0.01, 0.4, 0.6, 0.2);
  } else {
    physAdd(g, physSphG(0.06), PALETTE.coffeeLiquid, 0, 0.06, 0);
    physAdd(g, physSphG(0.05), PALETTE.coffeeLiquid, 0.06, 0.05, 0.03);
    physAdd(g, physBoxG(0.02, 0.02, 0.1), PALETTE.wood, 0, 0.1, 0);
  }
  return physFlatten(g, 0.06);
}

function physInitShards() {
  if (physShards.length) return;
  physShardGeos.push(physShardGeo(0), physShardGeo(1), physShardGeo(2));
  for (let i = 0; i < physSHARD_MAX; i++) {
    const mesh = new THREE.Mesh(physShardGeos[0], physPropMat);
    mesh.castShadow = true;
    mesh.visible = false;
    physSceneAddLoose(mesh);
    const body = new CANNON.Body({
      mass: 0.1,
      material: physLightMat || (physGame.mats ? physGame.mats.prop : undefined),
      linearDamping: 0.06,
      angularDamping: 0.16,
    });
    body.addShape(new CANNON.Sphere(0.075));
    body.collisionFilterGroup = physGRP_DYN;
    body.allowSleep = true;
    body.sleepSpeedLimit = 0.25;
    body.sleepTimeLimit = 0.5;
    body.collisionResponse = false;
    body.position.set(0, -900, 0);
    physSyncBodyTransform(body);
    body.sleep();
    // Loose, like the mesh: a bowl travels now (the type table says so) and a
    // shard whose body was detached with Pasto would be a sliver frozen in the
    // air over Marrakech.
    physWorldAddLoose(body);
    physShards.push({ mesh, body, active: false, life: 0 });
  }
}

function physThrowShards(x, y, z, count, kind) {
  if (!physShards.length) return;
  const geo = physShardGeos[kind === 1 ? 1 : kind === 2 ? 2 : 0];
  const n = count || 5;
  for (let k = 0; k < n; k++) {
    const s = physShards[physShardHead];
    physShardHead = (physShardHead + 1) % physSHARD_MAX;
    s.active = true;
    s.life = physSHARD_LIFE;
    s.mesh.geometry = geo;
    s.mesh.visible = true;
    s.mesh.scale.setScalar(1);
    const b = s.body;
    b.collisionResponse = true;
    b.position.set(x + rand(-0.12, 0.12), y + rand(0.02, 0.22), z + rand(-0.12, 0.12));
    b.quaternion.set(0, 0, 0, 1);
    physSyncBodyTransform(b);
    b.velocity.set(rand(-3.4, 3.4), rand(1.4, 4.2), rand(-3.4, 3.4));
    b.angularVelocity.set(rand(-9, 9), rand(-9, 9), rand(-9, 9));
    b.wakeUp();
    s.mesh.position.set(b.position.x, b.position.y, b.position.z);
    s.mesh.quaternion.set(0, 0, 0, 1);
  }
}

function physParkShard(s) {
  s.active = false;
  s.life = 0;
  s.mesh.visible = false;
  s.mesh.scale.setScalar(1);
  const b = s.body;
  b.collisionResponse = false;
  b.velocity.set(0, 0, 0);
  b.angularVelocity.set(0, 0, 0);
  b.force.set(0, 0, 0);
  b.torque.set(0, 0, 0);
  b.position.set(0, -900, 0);
  physSyncBodyTransform(b);
  b.sleep();
}

function physShardUpdate(dt) {
  for (let i = 0; i < physShards.length; i++) {
    const s = physShards[i];
    if (!s.active) continue;
    s.life -= dt;
    if (s.life <= 0 || s.body.position.y < -40) { physParkShard(s); continue; }
    if (s.life < 0.7) s.mesh.scale.setScalar(clamp(s.life / 0.7, 0.02, 1));
    const b = s.body;
    if (b.sleepState === CANNON.Body.SLEEPING) continue;
    s.mesh.position.set(b.interpolatedPosition.x, b.interpolatedPosition.y, b.interpolatedPosition.z);
    s.mesh.quaternion.set(
      b.interpolatedQuaternion.x, b.interpolatedQuaternion.y,
      b.interpolatedQuaternion.z, b.interpolatedQuaternion.w
    );
  }
}

// ---- layout ---------------------------------------------------------------
function physScatterPasto() {
  if (!physStalls.length) physFallbackStalls();

  // Capped at the menu length: six stalls x three items is 18 bodies, which is
  // all the Pasto budget can spare once pasto.js's town is standing.
  for (let i = 0; i < physStalls.length && i < physSTALL_MENU.length; i++) {
    const rec = physStalls[i];
    const menu = physSTALL_MENU[i % physSTALL_MENU.length];
    const cy = Math.cos(rec.yaw);
    const sy = Math.sin(rec.yaw);
    for (let k = 0; k < menu.length; k++) {
      const off = (k - 1) * 0.55;
      const x = rec.x + cy * off;
      const z = rec.z + sy * off;
      const prop = physMakeProp(menu[k], x, z, 0, rand(0, Math.PI * 2), rec.tableY);
      if (prop) prop.stall = rec;
    }
  }

  // The coffee drying patio, out on the terraces.
  const p = physGame.pasto;
  let ax = 44;
  let az = 8;
  if (p && typeof p.randomPointIn === 'function') {
    const spot = p.randomPointIn('coffee');
    if (spot && typeof spot.x === 'number' && typeof spot.z === 'number') { ax = spot.x; az = spot.z; }
  }
  for (let i = 0; i < physPATIO.length; i++) {
    const row = physPATIO[i];
    physMakeProp(row[0], ax + row[1], az + row[2], 0, rand(0, Math.PI * 2));
  }

  // Everything was laid down exactly on its surface: settle it all immediately
  // so a market full of produce costs the solver nothing until it is touched.
  const arr = physGame.props;
  for (let i = 0; i < arr.length; i++) {
    const b = arr[i].body;
    if (arr[i].biome !== 'pasto' || b.type !== CANNON.Body.DYNAMIC) continue;
    b.velocity.set(0, 0, 0);
    b.angularVelocity.set(0, 0, 0);
    b.force.set(0, 0, 0);
    b.torque.set(0, 0, 0);
    b.sleep();
  }
}

// ---- per-frame ------------------------------------------------------------
function physPastoUpdate(dt) {
  // physPuffUpdate/physShardUpdate used to be driven from here and therefore
  // only ever ran in Pasto. They are integrated for every chapter now, at the
  // end of physUpdate, beside the dust and the foam.

  // hits recorded during the step, applied now that the solver has finished
  for (let i = 0; i < physStalls.length; i++) {
    const rec = physStalls[i];
    if (!rec.pending) continue;
    rec.pending = false;
    physStallCollapse(rec, rec.pdx, rec.pdz, rec.pf);
  }

  // pasto.js may publish `stalls` after our first look — keep glancing, cheaply.
  physBindTimer -= dt;
  if (physBindTimer <= 0) { physBindTimer = 1.5; physBindStalls(); }

  physStallTriggers();
  for (let i = 0; i < physCollapsed.length; i++) physStallSync(physCollapsed[i]);
}

/**
 * PUT BACK WHAT THE GRAZE TOOK — AND IT ONLY EVER RAN IN PASTO.
 *
 * The graze’s whole guarantee is that NOTHING IS EVER DESTROYED: a bitten
 * prop is hidden, `hiddenUntil` is stamped, and it comes back so that no task
 * can be starved of the object it needs. This drain is the ONLY caller of
 * `physUnhide` — and it lived inside `physPastoUpdate`, which is gated on
 * `biome.isActive('pasto')` for a good reason of its own (the stall triggers
 * compare against coordinates every biome shares, so running them abroad
 * collapses invisible stalls in Cali).
 *
 * So in SIXTEEN OF SEVENTEEN CHAPTERS a grazed prop was gone for the session.
 * Measured: a Sydney sandwich hidden at t = 526.7 s with hiddenUntil 560.7 was
 * still hidden ninety seconds later, and switching to Pasto un-hid it on frame
 * zero. And it takes TASK-CRITICAL props with it — holding the Quay’s chips
 * and standing still for 5.63 s eats them, and both `qgFindChips` and the
 * hint arrow skip a hidden prop, so `seagull-chips` is quietly unwinnable.
 * Fifteen edible props game-wide.
 *
 * A clock is not a place. This runs everywhere, every frame.
 */
/**
 * A STAGED PROP LEARNS WHERE IT ACTUALLY LANDED.
 *
 * `homeY` is what physRescue treats as the surface, and outside the solver
 * there is no way to know whether a point is open ground, a deck, a jetty or
 * the roof of something. Rather than guess it, the prop is dropped and the
 * height it comes to rest at becomes its home — once, on the frame it stops
 * moving. Self-correcting, needs no list of which chapters have decks in them,
 * and it is the same number a scattered prop would have had.
 */
// AT REST, NOT ASLEEP. Learning only on the frame the body SLEEPS is correct
// and insufficient: a prop on a busy plaza is nudged by passing feet and by its
// own neighbours often enough that cannon never lets it doze, so `homeLearn`
// stays armed and the PROVISIONAL height — physTerrainAt, which answers for the
// ground under a deck rather than for the deck — is what a rescue uses.
// Measured by batch 4 as a keepsake left hovering in 3 of 17 chapters, Göreme
// 1.74 m and Palawan 0.69 m, both of them plazas with crews walking over them.
//
// So: sleeping still learns immediately, and a body that merely holds still for
// physHOME_REST seconds learns too. The thresholds are deliberately well under
// cannon's own sleepSpeedLimit — this has to catch the props that will NEVER
// reach it.
const physHOME_V    = 0.14;   // m/s, and the same number for rad/s
const physHOME_REST = 0.45;   // s held below it before the height is believed
function physHomeLearn(p, dt) {
  if (!p.homeLearn) return;
  const b = p.body;
  if (b.sleepState !== CANNON.Body.SLEEPING) {
    if (!(dt > 0)) return;                     // the sleep path calls without one
    const v = b.velocity, w = b.angularVelocity;
    const still = (v.x * v.x + v.y * v.y + v.z * v.z) < physHOME_V * physHOME_V &&
                  (w.x * w.x + w.y * w.y + w.z * w.z) < physHOME_V * physHOME_V;
    if (!still) { p.homeRestT = 0; return; }
    p.homeRestT = (p.homeRestT || 0) + dt;
    if (p.homeRestT < physHOME_REST) return;
  }
  p.homeLearn = false;
  p.homeRestT = 0;
  // Only if it settled somewhere sane — a prop that fell out of the world
  // while learning must not adopt the void as its home.
  const dx = b.position.x - p.homeX, dz = b.position.z - p.homeZ;
  if (dx * dx + dz * dz > 36) return;
  p.homeX = b.position.x; p.homeZ = b.position.z;
  p.homeY = b.position.y - p.originY;
}

function physRestockTick() {
  if (!physHidden.length) return;
  const t = physGame.state ? physGame.state.time : 0;
  for (let i = physHidden.length - 1; i >= 0; i--) {
    const p = physHidden[i];
    if (t < p.hiddenUntil) continue;
    physHidden[i] = physHidden[physHidden.length - 1];
    physHidden.pop();
    physUnhide(p);
  }
}

// ===========================================================================
// 9. FRAME UPDATE
// ===========================================================================
function physUpdateHeld(prop, dt) {
  const capy = physGame.capy;
  const anchor = capy && capy.mouthAnchor;
  if (!anchor || capy.heldProp !== prop) {
    // something else took it away from us — hand it back to the simulation
    prop.held = false;
    physDropOwned(prop, 0, 0.4, 0);
    return;
  }
  const m = prop.mesh;
  m.position.x = damp(m.position.x, prop.holdOffset.x, physHOLD_LAMBDA, dt);
  m.position.y = damp(m.position.y, prop.holdOffset.y, physHOLD_LAMBDA, dt);
  m.position.z = damp(m.position.z, prop.holdOffset.z, physHOLD_LAMBDA, dt);
  m.quaternion.slerp(prop.holdQuat, 1 - Math.exp(-physHOLD_LAMBDA * dt));
  // The grab-pop, easing out in the mouth. Tracked on the prop rather than read
  // back off the scale, so it is the same number the free path eases — a prop
  // dropped mid-pop carries on from where it was instead of restarting.
  // A held prop never squashes: it is not hitting anything.
  let pop = prop.pop === undefined ? 1 : prop.pop;
  if (pop !== 1) {
    pop = damp(pop, 1, physSQ_POP_LAM, dt);
    if (Math.abs(pop - 1) < 0.004) pop = 1;
    prop.pop = pop;
  }
  // ONE WRITER ON mesh.scale, and it is this line. The pop and the graze are
  // two independent reasons for a held prop not to be its own size, and two
  // separate setScalar calls a few lines apart is the trap that has already
  // been paid for once in this codebase (see the note on springs and scale in
  // capybara.js): whichever ran second simply erased the other.
  physGrazeStep(prop, dt);
  m.scale.setScalar(pop * (1 - prop.eaten * physGRAZE_TAKE));
  m.getWorldPosition(physV1);
  m.getWorldQuaternion(physQ1);
  const b = prop.body;
  b.position.set(physV1.x, physV1.y, physV1.z);
  b.quaternion.set(physQ1.x, physQ1.y, physQ1.z, physQ1.w);
  // Give the carried body real momentum so swinging a sign into a bin bites.
  if (dt > 1e-5) {
    b.velocity.set(
      clamp((physV1.x - prop.lastWX) / dt, -physHELD_VMAX, physHELD_VMAX),
      clamp((physV1.y - prop.lastWY) / dt, -physHELD_VMAX, physHELD_VMAX),
      clamp((physV1.z - prop.lastWZ) / dt, -physHELD_VMAX, physHELD_VMAX)
    );
  }
  prop.lastWX = physV1.x;
  prop.lastWY = physV1.y;
  prop.lastWZ = physV1.z;
}

// ===========================================================================
// THE GRAZE (v22)
// ===========================================================================
//
// A hundred and fourteen thousand lines about a capybara, and `nibble`,
// `graze` and `forage` between them appeared nowhere in any of them. The
// animal could steal a sandwich, carry a sandwich, throw a sandwich into a
// harbour and be chased for a sandwich, and could not eat one. It is the most
// obviously missing verb in the game and it has been missing since v1.
//
// It is also the verb with the highest chance of breaking something, so it is
// built out of the two most conservative decisions available:
//
//   NO NEW BUTTON. You graze by holding something edible and STANDING STILL —
//   the same settle the soft wheek is built on and the same one THE CALM is
//   built on (capy.stillT), so eating is a thing that happens to a player who
//   has stopped, which is exactly what eating is. Anybody mid-mischief never
//   sees it.
//   NOTHING IS EVER DESTROYED. The last bite HIDES the prop rather than
//   removing it, on the restock path this file has had since the market stalls
//   — so a sandwich you ate is a sandwich that is back on the picnic rug half a
//   minute later, and no task can be starved of the object it needs. That is
//   the whole safety argument: there is no state this verb can reach that the
//   world does not repair by itself.
//
// FOUR VISIBLE BITES rather than a smooth shrink, because a thing that scales
// down continuously reads as a bug and a thing that goes in steps reads as
// being eaten. Each bite is a squash, a crumb and a noise.
const physGRAZE_STILL = 0.9;    // s settled before the first bite is taken
const physGRAZE_BITE  = 1.05;   // s between bites after that
const physGRAZE_BITES = 4;      // how many it takes
const physGRAZE_TAKE  = 0.19;   // ...and how much of it each one removes
const physGRAZE_BACK  = 34;     // s before the world quietly puts another one out

/**
 * One frame of eating whatever is in the animal's mouth. Called from
 * physUpdateHeld and from nowhere else.
 *
 * The stillness test is the animal's own published settle timer, not a speed
 * read here: capybara.js zeroes it for a dozen reasons (in the air, in the
 * water, on a wall, at the helm, being carried) and duplicating that list over
 * here is how the two of them drift apart.
 *
 * `capy.restT`, though, and not `capy.stillT` — the two are the same list with
 * one entry's difference and the difference is exactly this verb. See the note
 * on capyRestT in capybara.js.
 */
function physGrazeStep(prop, dt) {
  const def = physTYPES[prop.type];
  if (!def || !def.edible) return;
  const capy = physGame.capy;
  // restT, not stillT: stillT is zeroed by having anything in the mouth, and
  // having something in the mouth is the precondition of this entire verb.
  const still = (capy && capy.restT) || 0;
  if (still < physGRAZE_STILL) { prop.grazeT = 0; return; }
  prop.grazeT = (prop.grazeT || 0) + dt;
  if (prop.grazeT < physGRAZE_BITE) return;
  prop.grazeT = 0;
  prop.eaten = (prop.eaten || 0) + 1;
  const b = prop.body;
  physSfxOpts.volume = 0.30 + Math.random() * 0.12;
  physGame.sfx(def.grazeSfx || 'rustle', physSfxOpts);
  physDust3(b.position.x, b.position.y - 0.06, b.position.z, 2);
  physSquashHit(prop, 6);
  physGame.events.emit('capy:graze', prop);
  if (prop.eaten < physGRAZE_BITES) return;
  // Gone. The scale is put back FIRST — physHide parks the body but the mesh
  // keeps whatever transform it had, and a prop that restocks at nineteen per
  // cent of its size is a prop nobody can see.
  prop.eaten = 0;
  prop.pop = 1;
  prop.mesh.scale.setScalar(1);
  physHide(prop, physGRAZE_BACK);
}

/** Barge a tourist at speed and whatever they are carrying goes flying. */
function physBarge(prop, speed) {
  const capy = physGame.capy;
  const owner = prop.owner;
  const b = prop.body;
  prop.lastImpact = physGame.state.time;
  physImpactPayload.prop = prop;
  physImpactPayload.speed = speed;
  physStampVoice(prop);
  physImpactPayload.position.set(b.position.x, b.position.y, b.position.z);
  physGame.events.emit('prop:impact', physImpactPayload);   // npc.js reacts while owner is intact
  const cv = capy.velocity;
  physDropOwned(prop, cv.x * 0.6, 2.0, cv.z * 0.6);
  prop.stolenFrom = owner;
  prop.spillArmed = true;
  physStampTouch(prop);                       // the barge IS the capybara's doing
  prop.releaseTime = physGame.state.time;
  physDust3(b.position.x, b.position.y, b.position.z, 3);
}

// ===========================================================================
// THINGS THAT HANG — game.hang().
//
// This game has a wind field, a gust that swings its heading, a wake shader, a
// sway term on every plant in fourteen chapters and a prop system with
// buoyancy and aerodynamics in it, and until now there was NOTHING SUSPENDED
// anywhere in nineteen worlds for any of it to act on. No shop sign, no wind
// chime, no lamp on a bracket, no washing line, no bell rope. Every object in
// the game is either bolted to the ground or lying on it.
//
// A hung thing is a SINGLE-BONE DAMPED PENDULUM and deliberately not a rigid
// body: cannon has no cheap revolute joint here, a real constraint on a 200 g
// lantern jitters at this solver's iteration count, and the one thing a
// pendulum has to do — hang still, then swing, then settle — is four lines of
// arithmetic. Two angles about a fixed anchor, gravity as the restoring term,
// linear damping, and three things that can push it:
//
//   THE AIR      the real one, un-floored — see physAirNow and the note there;
//   A WHEEK      the signature verb, which already moves every prop in reach;
//   A CONTACT    the animal walking into it, which is the joke.
//
// The mesh is the CALLER'S and the contract is one line long: the group's
// ORIGIN is the pivot and everything hangs below it in local -Y. This module
// writes rotation.x and rotation.z on that group and touches nothing else, so
// there is exactly one writer on the transform (the trap this repo has paid
// for twice on mesh.scale).
//
// It is not a physics body, it does not collide, and nothing can be gated on
// it. It is scenery that answers — which is the whole of area 3.
const physHANG_G      = 9.81;    // the restoring term. NOT the biome's gravity: a
                                 // chime hangs off a beam in air, and the Drift's
                                 // thin gravity is a fact about falling, not about
                                 // what a string does.
const physHANG_C      = 0.55;    // 1/s of angular damping at wind: 1
const physHANG_WIND_K = 0.055;   // rad/s² per (m/s)² of air, at wind: 1
const physHANG_WIND_MAX = 3.2;   // rad/s² — a squall does not put a sign over the top
const physHANG_MAX    = 1.15;    // rad — a hard stop just past 65°, so nothing inverts
const physHANG_SLEEP  = 0.004;   // rad/s below which, with no air, it is parked
const physHANG_FAR    = 70;      // m past which a hung thing is not integrated at all
// 5.5 put the Son Doong lantern to 0.90 rad — fifty-two degrees, from one
// shout at five metres, which is a thing being HIT rather than a thing being
// shouted at. 3.2 gives about twenty-five degrees at that range and still
// reaches the clamp point blank.
const physHANG_WHEEK  = 3.2;     // rad/s of swing a wheek at zero distance grants
// ---- ...AND ITS OWN RADIUS, LARGER THAN A PROP'S -------------------------
// physWHEEK_R is 5.0 m and it is small ON PURPOSE: a shout that could walk a
// prop off a ledge it was deliberately left on breaks a puzzle. None of that
// applies to a thing on a string, which cannot be displaced at all — only
// turned — and 5 m turns out not even to REACH most of them: measured, the
// lantern at the end of Son Doong's exit board is 5.44 m from a capybara
// standing in front of the board, so the one chapter with no air in it, where
// the shout is the ONLY thing that can move it, was the one chapter where the
// shout did nothing. The whole sweep read 0.0000 and looked like a dead system.
const physHANG_WHEEK_R = 9.0;    // m — how far a shout swings something hung
const physHANG_HIT_V  = 0.55;    // m/s of animal before a brush counts as a knock
const physHANG_HIT_K  = 1.35;    // rad/s of swing per m/s of animal
const physHANG_HIT_MAX = 4.2;    // ...and the ceiling on it
const physHANG_COOL   = 0.30;    // s between two sounds out of one hung thing
const physHANG_CHIME  = 0.62;    // rad/s through the bottom before a chime speaks
const physHANG_CHIME_GAP = 1.15; // s — and no more often than this
const physHangs = [];
const physHangSfx = { volume: 1, pitch: 1, at: { x: 0, y: 0, z: 0 }, near: 5 };

/**
 * ...AND THE AIR A PENDULUM FEELS IS NOT THE AIR A PROP FEELS.
 *
 * physWindNow subtracts physGUST_MIN before it hands anything over, because a
 * permanent 1.5 m/s breeze in Sydney would walk a ferry ticket off the quay
 * while nobody was touching a key — and "a prop stays exactly where the player
 * put it" is worth more than a moving ticket. That floor makes NINE CHAPTERS
 * read exactly 0.000, which is the correct answer for a ticket and the wrong
 * one for a wind chime: a thing on a string is the one object in the game
 * whose entire job is to show you air you cannot otherwise see, and a chime
 * that only moves in the four squall chapters is a chime that is broken in
 * fifteen.
 *
 * So this is the raw sum — the biome's own wind() plus the whole gust, floor
 * and all — and a hung thing cannot be displaced by it, only turned.
 */
const physAirOut = { x: 0, z: 0 };
let physAirTick = -1;
function physAirNow() {
  const t = physGame.state ? physGame.state.time : 0;
  if (t === physAirTick) return physAirOut;
  physAirTick = t;
  let wx = 0, wz = 0;
  const api = physBiomeApi();
  if (api && typeof api.wind === 'function') {
    const w = api.wind();
    if (w) {
      if (typeof w.x === 'number' && w.x === w.x) wx = clamp(w.x, -12, 12);
      if (typeof w.z === 'number' && w.z === w.z) wz = clamp(w.z, -12, 12);
    }
  }
  const wxr = physGame.weather;
  if (wxr && typeof wxr.gust === 'function') {
    const g = wxr.gust();
    if (g) {
      if (typeof g.x === 'number' && g.x === g.x) wx += g.x;
      if (typeof g.z === 'number' && g.z === g.z) wz += g.z;
    }
  }
  physAirOut.x = clamp(wx, -14, 14);
  physAirOut.z = clamp(wz, -14, 14);
  return physAirOut;
}

/**
 * HANG SOMETHING.
 *
 *   game.hang({ biome: 'kyoto', group: lantern, len: 0.55,
 *               mat: 'timber', wind: 1.1, r: 0.6, hit: 1.2 })
 *
 *   biome  which chapter it belongs to. Nothing outside the live one is
 *          integrated, pushed or heard — the shared-space rule.
 *   group  an Object3D whose ORIGIN IS THE PIVOT. Required.
 *   len    m from the pivot to the middle of what hangs. It is the ONLY thing
 *          that sets the period (T = 2*pi*sqrt(len/g)), so a 0.25 m chime
 *          ticks and a 2.5 m sign swings, out of one number.
 *   mat    a physVOICE key — what it sounds like when something touches it.
 *   wind   how much air gets to it, 0..2. A lantern under an eave is 0.5, a
 *          sign on an open corner is 1.4, something inside is 0.
 *   r      m — the horizontal radius the animal has to come within.
 *   hit    m — how far BELOW the pivot the animal can reach. Default len+0.3;
 *          set it above the animal's head to make a thing that only the wheek
 *          and the weather can move.
 *   axis   'free' (default), 'x' or 'z' — a sign on a bracket swings one way.
 *   chime  true if it should speak on its own in the wind. Off by default:
 *          nineteen chapters of scenery that makes a noise unprompted is how
 *          an ambient mover becomes an irritation (rule 1 of the movers).
 */
function physHang(o) {
  if (!o || !o.group) return null;
  const g = o.group;
  const len = o.len > 0.05 ? o.len : 0.6;
  const rec = {
    biome: o.biome || (physGame.biome && physGame.biome.current) || 'sydney',
    group: g, len: len,
    x: o.x !== undefined ? o.x : g.position.x,
    y: o.y !== undefined ? o.y : g.position.y,
    z: o.z !== undefined ? o.z : g.position.z,
    voice: physVOICE[o.mat] || physVOICE.timber,
    wind: o.wind === undefined ? 1 : clamp(o.wind, 0, 2),
    r: o.r > 0 ? o.r : 0.6,
    reach: o.hit > 0 ? o.hit : len + 0.3,
    axis: o.axis === 'x' ? 'x' : o.axis === 'z' ? 'z' : 'free',
    chime: o.chime === true,
    gain: o.gain === undefined ? 1 : clamp(o.gain, 0, 2),
    ax: 0, az: 0, vx: 0, vz: 0,     // the two angles and their rates
    cool: 0, chimeT: 0, wasIn: false, asleep: false,
  };
  // Whatever the caller left on the group, the pendulum owns from here.
  g.rotation.x = 0;
  g.rotation.z = 0;
  physHangs.push(rec);
  return rec;
}

/** One sound out of one hung thing, placed and rationed. */
function physHangVoice(rec, k) {
  if (rec.cool > 0) return;
  rec.cool = physHANG_COOL;
  const v = rec.voice;
  physHangSfx.at.x = rec.x;
  physHangSfx.at.y = rec.y - rec.len * 0.5;
  physHangSfx.at.z = rec.z;
  physHangSfx.volume = clamp(v.gain * k * 0.5 * rec.gain, 0.02, 0.9);
  physHangSfx.pitch = v.pitch * (0.9 + Math.random() * 0.2);
  physGame.sfx(v.sfx, physHangSfx);
}

/** The wheek reaches everything hanging, exactly as it reaches every prop. */
function physHangWheek(pos, scale) {
  const live = physLiveBiome();
  for (let i = 0; i < physHangs.length; i++) {
    const h = physHangs[i];
    if (h.biome !== live) continue;
    const dx = h.x - pos.x, dy = (h.y - h.len) - pos.y, dz = h.z - pos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > physHANG_WHEEK_R) continue;
    const fall = 1 - d / physHANG_WHEEK_R;
    if (fall <= 0.02) continue;
    // Radially AWAY from the animal in the horizontal plane, which for a
    // pendulum means about the axis at right angles to that direction: a
    // shout pushes a lantern away from you, not sideways past you.
    //
    // AND THE SIGNS ARE NOT FREE. The bob of a group rotated by (ax, az) sits
    // at (+len*sin az, -len*cos, -len*sin ax): +X wants az UP and +Z wants ax
    // DOWN. Written the intuitive way round — vx from dz, vz from dx, both
    // positive — every one of the three pushes in this file was exactly
    // inverted and self-consistently so, which is the worst kind: the lantern
    // leaned INTO the wind and swung TOWARD the animal that shouted at it, and
    // it did all of that smoothly.
    const hd = Math.sqrt(dx * dx + dz * dz) || 1;
    const k = physHANG_WHEEK * fall * scale / Math.max(0.35, h.len);
    h.vx += -(dz / hd) * k;
    h.vz += (dx / hd) * k;
    h.asleep = false;
    physHangVoice(h, fall * 0.8);
  }
}

/**
 * The pendulum, the air, the animal walking into it, and the sound.
 *
 * THREE THINGS THAT ARE DELIBERATELY NOT HERE, and all three are the ambient
 * movers' rules (see THINGS THAT ARE SIMPLY THERE):
 *
 *  1. It never speaks unprompted unless it was asked to (`chime`), and even
 *     then only through the bottom of a swing and no more than once a second.
 *  2. It goes to sleep. With no air and no push the integration stops, so
 *     nineteen chapters of scenery cost nothing on a still frame.
 *  3. It cannot be seen from far enough away for any of this to matter, so
 *     past physHANG_FAR it is not integrated at all — and it is PARKED first,
 *     because a thing that stops mid-swing and is still there when you turn
 *     round is worse than one that was never moving.
 */
function physHangStep(dt, live) {
  if (!physHangs.length) return;
  const capy = physGame.capy;
  const cp = capy && capy.position;
  const cv = capy && capy.velocity;
  const air = physAirNow();
  const aw = Math.sqrt(air.x * air.x + air.z * air.z);
  for (let i = 0; i < physHangs.length; i++) {
    const h = physHangs[i];
    if (h.biome !== live) continue;
    if (h.cool > 0) h.cool -= dt;
    if (h.chimeT > 0) h.chimeT -= dt;
    if (cp) {
      const fx = h.x - cp.x, fz = h.z - cp.z;
      if (fx * fx + fz * fz > physHANG_FAR * physHANG_FAR) {
        if (!h.asleep) {
          h.asleep = true; h.ax = 0; h.az = 0; h.vx = 0; h.vz = 0;
          h.group.rotation.x = 0; h.group.rotation.z = 0;
        }
        continue;
      }
    }
    // ---- the animal, on its way through -----------------------------------
    // Measured against where the thing IS, not where it hangs from: something
    // already swung out of the way cannot be hit again until it comes back,
    // which is what makes pushing through a row of them feel like anything.
    if (cp && cv) {
      const bx = h.x + Math.sin(h.az) * h.len;
      const bz = h.z - Math.sin(h.ax) * h.len;
      const dx = bx - cp.x, dz = bz - cp.z;
      const near = dx * dx + dz * dz < h.r * h.r &&
                   cp.y < h.y + 0.25 && cp.y > h.y - h.reach - 0.35;
      if (near) {
        const sp = Math.sqrt(cv.x * cv.x + cv.z * cv.z);
        if (!h.wasIn && sp > physHANG_HIT_V) {
          const k = Math.min(physHANG_HIT_MAX, sp * physHANG_HIT_K) / Math.max(0.35, h.len);
          h.vx += -(cv.z / (sp || 1)) * k;
          h.vz += (cv.x / (sp || 1)) * k;
          h.asleep = false;
          physHangVoice(h, clamp(sp / 4, 0.25, 1));
        }
        h.wasIn = true;
      } else h.wasIn = false;
    }
    // ---- the air ----------------------------------------------------------
    // Quadratic, like every other aerodynamic term in this file, and applied
    // as an angular acceleration about the two axes at right angles to the
    // heading — so a wind out of the north swings a lantern south and the
    // gust's own heading swing is what makes it wander rather than hold.
    let awx = 0, awz = 0;
    if (h.wind > 0 && aw > 0.05) {
      const k = Math.min(physHANG_WIND_MAX, physHANG_WIND_K * aw * aw * h.wind)
                / Math.max(0.35, h.len);
      awx = -(air.z / aw) * k;
      awz = (air.x / aw) * k;
    }
    if (h.asleep && !awx && !awz) continue;
    // ---- the pendulum -----------------------------------------------------
    const gl = physHANG_G / h.len;
    const c = physHANG_C * (0.6 + h.wind * 0.4);
    h.vx += (-gl * Math.sin(h.ax) - c * h.vx + awx) * dt;
    h.vz += (-gl * Math.sin(h.az) - c * h.vz + awz) * dt;
    h.ax += h.vx * dt;
    h.az += h.vz * dt;
    if (h.axis === 'x') { h.az = 0; h.vz = 0; }
    else if (h.axis === 'z') { h.ax = 0; h.vx = 0; }
    if (h.ax > physHANG_MAX) { h.ax = physHANG_MAX; if (h.vx > 0) h.vx = -h.vx * 0.3; }
    if (h.ax < -physHANG_MAX) { h.ax = -physHANG_MAX; if (h.vx < 0) h.vx = -h.vx * 0.3; }
    if (h.az > physHANG_MAX) { h.az = physHANG_MAX; if (h.vz > 0) h.vz = -h.vz * 0.3; }
    if (h.az < -physHANG_MAX) { h.az = -physHANG_MAX; if (h.vz < 0) h.vz = -h.vz * 0.3; }
    // ---- and, if it was asked to, it speaks through the bottom -------------
    // THROUGH THE BOTTOM, not at the top: a pendulum is fastest and quietest at
    // the bottom of its arc and a chime that rang at the extremes would ring in
    // time with the swing, which is a metronome. The angle test is what makes it
    // the bottom; the speed test is what stops a dying swing ticking for a
    // minute; the gap is what stops a gale being a fire alarm.
    if (h.chime && h.chimeT <= 0 &&
        Math.abs(h.ax) + Math.abs(h.az) < 0.06) {
      const sw = Math.abs(h.vx) + Math.abs(h.vz);
      if (sw > physHANG_CHIME) {
        h.chimeT = physHANG_CHIME_GAP * (0.8 + Math.random() * 0.6);
        physHangVoice(h, clamp(sw * 0.28, 0.1, 0.7));
      }
    }
    h.group.rotation.x = h.ax;
    h.group.rotation.z = h.az;
    h.asleep = Math.abs(h.vx) + Math.abs(h.vz) < physHANG_SLEEP &&
               Math.abs(h.ax) + Math.abs(h.az) < physHANG_SLEEP;
  }
}

/**
 * WHAT IS HANGING IN THIS CHAPTER AND WHETHER IT IS MOVING, read-only.
 *
 * A pendulum that is not moving and a pendulum that is not being integrated
 * look identical in a screenshot, and both look identical to one that was
 * never registered. Nothing in src reads this. See qa/d7-hang.js.
 */
function physHangAudit() {
  const live = physLiveBiome();
  const air = physAirNow();
  const cp = physGame.capy && physGame.capy.position;
  const out = { biome: live, air: +Math.sqrt(air.x * air.x + air.z * air.z).toFixed(3),
                total: physHangs.length, here: 0, rows: [] };
  for (let i = 0; i < physHangs.length; i++) {
    const h = physHangs[i];
    if (h.biome !== live) continue;
    out.here++;
    // THE DISTANCE AND THE CULL, because without them this audit cannot tell a
    // dead pendulum from a working one you are standing too far away from.
    // physHangStep skips anything past physHANG_FAR and zeroes it on the way
    // out, so a sweep taken at the nineteen chapter SPAWNS reads 0.0000 in
    // eleven of them and looks like a system that was never wired. It is
    // wired; an exit board is simply not near the door you arrived by.
    // Measured 3 Sep 2026, from six metres: all nineteen swing on their own
    // weather and all nineteen answer a shout. See qa/d10-hang2.js.
    const d = cp ? Math.hypot(h.x - cp.x, h.z - cp.z) : null;
    out.rows.push({ x: +h.x.toFixed(1), y: +h.y.toFixed(1), z: +h.z.toFixed(1),
                    len: h.len, wind: h.wind, voice: h.voice.key,
                    a: +(Math.abs(h.ax) + Math.abs(h.az)).toFixed(4),
                    v: +(Math.abs(h.vx) + Math.abs(h.vz)).toFixed(4),
                    d: d === null ? null : +d.toFixed(1),
                    far: d !== null && d > physHANG_FAR,
                    asleep: h.asleep });
  }
  return out;
}

/**
 * TAKE ONE DOWN. The record game.hang() handed back, and nothing else.
 *
 * The first version of this took a BIOME and dropped everything that chapter
 * had hung, which is a footgun rather than an api: the exit board replants
 * itself every time you enter a chapter, so a board that took its own lantern
 * down that way would take down anything the chapter itself had hung as well,
 * silently, on the second visit. One record in, one record out.
 */
function physHangRemove(rec) {
  if (!rec) return;
  const i = physHangs.indexOf(rec);
  if (i >= 0) physHangs.splice(i, 1);
}

function physUpdate(dt) {
  if (!physGame || !physGame.world) return;
  // game.physics.update is contract-published AND returned to main.js's updater
  // list — make a second call in the same frame a no-op instead of double-stepping.
  if (physGame.state) {
    if (physGame.state.time === physLastTick) return;
    physLastTick = physGame.state.time;
  }
  // The hit flash is on a WALL clock and its own list, because a prop that has
  // come to rest is skipped past the per-prop loop below — so a crate that
  // was hit and settled in the same second would keep the flash material for
  // ever. See THE HIT FLASH.
  physFlashStep(dt * 1000);
  // ---- the getaway (M7) ---------------------------------------------------
  // Above the biome gate on purpose: an armed row belongs to the journey, not
  // to the chapter it was armed in, and the props it points at are gated by
  // `held` rather than by which world they were born in.
  physGetawayStep();
  // ---- biome gate ---------------------------------------------------------
  // Props are tagged with the biome they were born into (main.js auto-tags
  // everything added at runtime). A detached biome's bodies are out of the
  // world entirely, so simulating or re-syncing them is pure waste — skip
  // them wholesale. Sydney's scatter is skipped the moment Sydney detaches;
  // anything spawned while Pasto is live keeps running there instead.
  const live = physLiveBiome();
  const sydneyLive = physGame.biome ? physGame.biome.isActive('sydney') : true;
  const arr = physGame.props;
  const capy = physGame.capy;
  // Everything on a string, before the props: it is not a body, it takes no
  // part in the solver, and it is the one thing in this file that runs off the
  // UN-floored air. See THINGS THAT HANG.
  physHangStep(dt, live);
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (p.removed) continue;
    if (p.hidden) {                           // hidden = parked off-map, awaiting restock
      // Belt under physHide's braces: a parked body that has somehow left
      // its parking (a caller that re-typed it, a future path that moves
      // it) is put back on the spot and parked again, before it can spend
      // a solver save a frame under the world.
      const hb = p.body;
      if (hb && hb.position.y < -950) {
        hb.type = CANNON.Body.STATIC;
        hb.updateMassProperties();
        hb.velocity.set(0, 0, 0);
        hb.angularVelocity.set(0, 0, 0);
        hb.position.set(p.homeX, -900, p.homeZ);
        physSyncBodyTransform(hb);
        hb.sleep();
      }
      continue;
    }
    // a prop in the capybara's mouth travels with it, whatever it was born into
    // — and a KEEPSAKE has no biome at all and is simulated everywhere, which
    // is the whole of what makes it a keepsake. See physKEEPS.
    if (p.biome && p.biome !== live && !p.held) continue;
    physSetSolo(p, p.held || p.spilled || p.owner !== null || !!p.inVessel);
    if (p.held) { physUpdateHeld(p, dt); continue; }
    // A prop riding in a bin is driven by the bin, not by the solver. See
    // A THING INSIDE A THING.
    if (p.inVessel) { physUpdateInVessel(p, dt); continue; }
    if (p.frozen) continue;
    // if something reparented the mesh (an NPC carrying it) that owner drives it
    if (p.mesh.parent !== physGame.scene) continue;
    const b = p.body;

    // shoulder-barge: knock a carried coffee out of a tourist's hand
    if (p.owner && !p.spilled && capy && capy.position && capy.velocity &&
        physGame.state.time - p.lastImpact > 0.5) {
      const bx = b.position.x - capy.position.x;
      const bz = b.position.z - capy.position.z;
      if (bx * bx + bz * bz < 1.21) {
        const sp = Math.sqrt(capy.velocity.x * capy.velocity.x + capy.velocity.z * capy.velocity.z);
        if (sp > 3.2) physBarge(p, sp);
      }
    }


    // Escaped the world (tunnelled, or was ejected out of a static box): put it
    // back on its scatter point. Checked BEFORE the sleep gate, or a body that
    // fell through and then fell asleep down there would never be recovered.
    // The harbour is a Sydney fact. In Pasto there is no water at all, and the
    // ground is a 60 m volcano — "escaped the world" has to be measured against
    // the terrain under the prop, not against a flat plane.
    // Sideways counts as escaped too. The fall tests below only catch a prop that
    // goes DOWN; one that gets flung horizontally lands somewhere the terrain
    // function still answers for, sits happily at ground level 400 m outside the
    // world, and takes its task with it. No biome here is wider than ~250 m.
    if (b.position.x * b.position.x + b.position.z * b.position.z > physESCAPE_R2) {
      physRescue(p);
      continue;
    }
    if (sydneyLive) {
      if (b.position.y < physFALL_Y && !p.inWater && !physOverWater(b.position.x, b.position.z)) {
        physRescue(p);
        continue;
      }
    } else if (b.position.y < physSurfaceY(b.position.x, b.position.z) - physPASTO_FALL &&
               !p.inWater && !physOverWater(b.position.x, b.position.z)) {
      physRescue(p);
      continue;
    }

    // Galeras eats what falls into it. Tested BEFORE the sleep gate: a prop that
    // came to rest on the crater floor and then dozed off must still be taken.
    // PASTO ONLY, not merely "not Sydney": the crater is a set of shared-space
    // coordinates like everything else, and running this abroad had an invisible
    // volcano shoving and eating props out of the middle of eleven other cities.
    if (physPastoLive()) {
      physCraterCheck(p, dt);
      if (p.hidden) continue;
    }

    if (p.inWater && !p.sunk) b.wakeUp();      // a prop on the seabed stays asleep
    // a real gust flips a light prop off the paving rather than politely
    // ignoring it — sleeping bodies skip narrowphase AND the drag below
    if (p.mass < 0.6 && b.sleepState === CANNON.Body.SLEEPING) {
      const wg = physWindNow();
      if (wg.x * wg.x + wg.z * wg.z > physGUST_WAKE * physGUST_WAKE) b.wakeUp();
    }
    // AT REST counts, not only asleep — a prop on a busy plaza may never doze.
    // Called every frame while `homeLearn` is armed; it costs one squared-length
    // test on the props that are still looking for their home and nothing at all
    // on the rest, because it returns on the flag first.
    if (p.homeLearn && b.sleepState !== CANNON.Body.SLEEPING) physHomeLearn(p, dt);
    if (b.sleepState === CANNON.Body.SLEEPING) {
      physHomeLearn(p);              // ...and where it landed IS home now
      p.spillArmed = false;          // a settled cup stops being a time bomb
      // A sleeping body is never synced again, so the frame it drops off must
      // land ON its true rest transform — the last interpolated write was a
      // fraction of a step behind it, and that offset would be permanent.
      // ...and it must land on a PERFECT BOX. A prop that dozed off while its
      // squash spring was still running would have that frame's scale written
      // once, exactly, and then never be synced again — a permanently dented
      // bin, for the rest of the session. Cleared before the final write, not
      // after it.
      if (p.settled && !p.sq && !p.sqV) continue;
      physSquashClear(p);
      p.settled = true;
      physSyncMesh(p, true);
      if (!p.solo) physWriteInstance(p, true);
      continue;
    }
    p.settled = false;
    physSquashStep(p, dt);

    physSyncMesh(p, false);

    // BUOYANCY EVERYWHERE THERE IS WATER. This used to be gated on Sydney —
    // written when the harbour was the only water in the game — which meant a
    // prop thrown into Venice's flooded square, Palawan's bay, Kyoto's pond or
    // the Río Cali fell through the surface like a stone and lay on the bottom
    // with no Archimedes at all. Every query inside now asks the LIVE biome, so
    // a biome with no water (no isOverWater published) costs one property miss.
    physCheckWater(p, dt);

    // ---- the air is a fluid too ---------------------------------------------
    // Quadratic aerodynamic drag against the moving air, per-shape: a hat and a
    // bin no longer fall identically, a thrown frisbee sheds speed the way a
    // frisbee does, and the Drift's wind (and Marrakech's storm) carries light
    // props exactly as far as it should. F = ½·ρ·Cd·A·|v_rel|·v_rel, with the
    // area and Cd baked per prop at spawn (prop.aeroK = ½·ρ·Cd·A).
    if (!p.inWater && p.aeroK > 0) {
      const wnd = physWindNow();
      // ---- THE KICK, which is the half drag cannot do --------------------
      physGustKick(p, wnd, dt);
      let rvx = wnd.x - b.velocity.x;
      const rvy = -b.velocity.y;
      let rvz = wnd.z - b.velocity.z;
      // ---- ...AND THE CAP, which is the half that keeps it charming -------
      // A prop's terminal velocity under drag IS the wind speed, so drag on
      // its own turns a squall into props migrating downwind at five metres a
      // second — which is not comedy, it is a prop leaving the place the
      // player set it down, and tasks read prop positions. The air may
      // DECELERATE anything at any speed (a thrown frisbee still sheds speed
      // exactly as it did), and it may not ACCELERATE anything past
      // physGUST_VMAX along the wind. Only the accelerating component along
      // the wind axis is removed; everything sideways and vertical is
      // untouched, so a prop still gets turned by a gust, just not launched.
      const w2 = wnd.x * wnd.x + wnd.z * wnd.z;
      if (w2 > 1e-6) {
        const wl = Math.sqrt(w2);
        const ux = wnd.x / wl, uz = wnd.z / wl;
        if (b.velocity.x * ux + b.velocity.z * uz > physGUST_VMAX) {
          const rvw = rvx * ux + rvz * uz;
          if (rvw > 0) { rvx -= rvw * ux; rvz -= rvw * uz; }
        }
      }
      const rl2 = rvx * rvx + rvy * rvy + rvz * rvz;
      if (rl2 > 0.36) {
        const rl = Math.sqrt(rl2);
        // capped as an acceleration so a near-massless prop can never be made
        // to ring by its own drag inside one 60 Hz step
        let f = p.aeroK * rl;
        const fCap = (physAERO_AMAX * p.mass) / rl;
        if (f > fCap) f = fCap;
        b.force.x += f * rvx; b.force.y += f * rvy; b.force.z += f * rvz;
      }
    }

    if (p.inWater) p.spillArmed = false;
    // "has it hit the deck yet" — measured against the surface under it, so a
    // cup thrown onto the Opera House podium still lands.
    else if (p.spillArmed && !p.spilled &&
             b.position.y < physSurfaceY(b.position.x, b.position.z) + p.originY + 0.12 &&
             (Math.abs(b.velocity.y) > 2.2 || b.velocity.lengthSquared() > 9)) physSpill(p);

    if (!p.solo) physWriteInstance(p);
  }

  // No tip may register during the opening settle — nothing the player has done
  // yet can have caused one.
  if (!physGame.state || physGame.state.time >= physTASK_GRACE) {
    for (let i = 0; i < physBins.length; i++) {
      const bin = physBins[i];
      if (bin.biome !== live) continue;
      if (bin.tipped || bin.held || bin.removed) continue;
      if (bin.body.sleepState === CANNON.Body.SLEEPING) continue;
      physCheckTip(bin);
    }
  }

  physRubbishUpdate(dt, live);
  // EVERY POOL, EVERY CHAPTER. This used to read `if (sydneyLive)`, which meant
  // the pools were not even integrated abroad — so on the two occasions a
  // particle did get emitted outside Sydney it hung in the air for ever. All
  // four loops are O(pool) early-outs on `life <= 0` / `!active`, sixty-two
  // slots between them, and a dead slot parks offscreen at scale 0: an idle
  // chapter pays a few dozen array reads a frame and nothing else.
  physParticleUpdate(dt);
  physPuffUpdate(dt);
  physShardUpdate(dt);
  // Pasto only, not merely "not Sydney": the stall triggers compare the
  // capybara's position against stall coordinates that every biome shares, so
  // running this abroad collapses invisible stalls and ticks market-chaos
  // from the middle of Cali.
  if (physPastoBuilt && physGame.biome && physGame.biome.isActive('pasto')) physPastoUpdate(dt);
  // ...and the restock, which is a CLOCK and belongs to no chapter. See
  // physRestockTick — it spent its whole life inside the line above.
  physRestockTick();
  physFlushInstances();
}
