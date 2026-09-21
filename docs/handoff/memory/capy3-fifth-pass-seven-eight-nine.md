---
name: capy3-fifth-pass-seven-eight-nine
description: "The pass over Iceland, Marrakech and the Drift that found five people standing inside their own furniture, a basket with a lid on it, and a chapter fifty per cent over the body budget"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-23T22:45:39.588Z
  originSessionId: 34669054-1249-4141-bc7f-191c9584c759
---

Done 24 Aug 2026 on chapters 7 (Iceland), 8 (Marrakech) and 9 (the Drift), after
[[capy3-third-pass-six-seven]] and [[capy3-third-pass-eight-nine]] had already been through
them. The three earlier passes found *systems drawn and not implemented*, then *things
standing in the wrong place*, then *maths that was wrong in a way every number agreed with*.
This one found **things that had a comment saying what they were and geometry saying
something else**, and **three chapters that never got the upgrades chapters 4-6 had.**

## THE AUDIT THAT SHOULD HAVE EXISTED FROM THE FIRST LOCAL

`addLocal` gives every person a 0.52 x 1.70 x 0.48 CANNON box at their feet. `qa/y7-loc.js`
walks `world.bodies`, picks out `userData.local`, and tests each one against every other
static shape's world-space AABB. It found **three more instances of the class in one run** —
Marrakech's juice seller inside the orange cart, Iceland's pylsa man inside the hot dog van,
and Marrakech's dyer inside a souk block's wall — plus, by hand, the snake charmer in the
middle of the snake basket and the acrobat in the middle of his own throwing mat.

**The cause is always the same and it is worth writing down once: the landmark constant is
the point the task BEACON aims at, and that is never a place a person can stand.** `sahCART`,
`icePYLSA`, `sahSNAKE`, `sahACRO`, `rioKIOSK` — all of them are the centre of a solid object.
Anybody placed at one is invisible with their collider inside its collider. That is five
instances across five chapters now. **Run the audit whenever a chapter gets people.**

Two caveats learned writing it: test the axes SEPARATELY (using `max(he.x, he.z)` on both
axes reports every person within fifteen metres of a long thin wall), and it cannot see a
person standing inside a RING of shapes, which is how the snake charmer hid.

## A COMMENT THAT SAYS "OFF TO ONE SIDE" AND GEOMETRY THAT SAYS (0, 1.16, 0)

**The snake basket had a lid on it and could not be entered.** The task is *'Sit in the snake
charmer's basket'*; what stood there was a solid 1.44 m cylinder with a cone dead-centre on
top of it — the comment beside the cone reads "the lid, off to one side" — and
`sahUpdateTasks` ticked the row when the animal came within **2.2 m of the middle, with no
input at all**. So chapter 8's third line, the one that runs before the chapter shows you the
chase, was "walk past a sealed drum". Exactly Iceland's hot spring, whose silica rim was a
plate over the whole pool.

A basket is a RING: sixteen staves, an open middle, a floor at ankle height, a rim at 45 cm
(the animal steps 0.4 and hops 1.4, so getting in is a deliberate hop and getting out can
never fail), a rim collider on ONE body, and the lid flat on the sand. The tick now needs the
animal inside a 92 cm circle and below the rim. And the cobra — which the chapter had talked
about for two versions and never drawn — comes up out of the basket to see who is in it,
every time, and goes back down. **Set the riser at 0.66 m from the middle, not 0.34: the
first cut came up out of the capybara's back.**

## THE OTHER TWO "SAYS ONE THING, DRAWS ANOTHER"

- **Iceland's twenty-six fumaroles were oil drums.** `h = rand(1.0, 3.6)`, `rr = rand(0.85,
  2.1)`, in `iceMoraineDk` and `iceBasalt`: stacks up to four metres across and taller than
  the animal, in the two darkest greys in the palette, on the one piece of ground the chapter
  crosses in every direction. The comment above them describes "cracked rock with steam coming
  out of it". They are ankle-high broken crusts now with an emissive mouth, and three of the
  twenty-six are tall because a field needs landmarks. **The apron went into the ground's
  vertex colours, not into geometry**: the first cut gave each one three concentric discs
  (sulphur, silica, snow) and rendered twenty-six FRIED EGGS — the "however many rings you
  draw, each one is a flat value" note, for the third time in this chapter.
- **The geothermal basin was a LAWN.** Everything between the lagoon and the sea fell through
  the same bare `else` that paints an old lava field, so the geyser basin — Strokkur, the
  dormant Geysir, the hot pool, twenty-six vents and the whole boardwalk — was army-blanket
  green with black drums standing on it. Precisely Rio's beach-sand `else` painting the city
  shelf. It is altered ground now: bleached silica where the water is at the surface, sulphur
  round the vents, iron-red on the margin, painted per vertex on a squared falloff with two
  incommensurable waves and no test a polygon edge can land on. **And the vent sites had to
  move out of the builder into a module-level table with a seeded LCG**, because the ground
  mesh is built first and had no way of knowing where the vents were.

## A CHAPTER FIFTY PER CENT OVER THE BODY BUDGET, MEASURED NOT GUESSED

`world.bodies` with the Drift live: **197 static bodies against CONTRACT.md's hard 130**, and
seventy-five of them were the field walls — one `CANNON.Body` per stone, on nine islands.
Rio, Iceland and Marrakech all got a `*StaticGroup` helper during their own passes; the Drift
is the only chapter that never did, which is exactly why it is the only chapter over budget.
**197 -> 82**, 200 shapes, and a physical test (drop the animal on each of the 146 small
static shapes) reports zero fall-throughs.

**GROUP PER ISLAND, NEVER PER FILE.** A compound body's AABB is the union of its shapes, so
one body holding all seventy-five wall stones would have an AABB four hundred metres across
and be tested against everything, every step. Same reason the far lip of the Long Gap gets its
own body rather than joining the near one. (This is also the caveat already recorded against
`qa/audit-solid.js`, arriving from the other direction.)

## THE THREE CHAPTERS NEVER GOT THE v20 NPC UPGRADE

`localResolve` in npc.js has supported `{t, before}` / `{t, after}` / `{t, when}` and `onTask`
/ `praise` / `addExchange` since chapter 4's pass — and chapters 7, 8 and 9 were still flat
bags of three or four strings. Twenty-six people, ninety-odd lines, none of which changed
between the first second of a chapter and the last: you could rob the pylsa stand, ride
Strokkur, take the glacier in one go and bring the northern sky down, and the man at the stand
would still be offering you one with everything.

**332 lines now, and `qa/y7-final.js` resolves every pool of every local in every biome and
calls every `when`** — because `localResolve` swallows a throwing predicate in a try/catch, so
a broken one is invisible until somebody reads the whole game by hand. It caught my own bug
immediately: `lampfliesNeeded` is a NUMBER on the drift API and I had written
`lampfliesNeeded()` four times.

Three exchanges in Iceland, four in Marrakech, and **deliberately none in the Drift** — the
design there is one voice per island with forty metres of sky between them, and two people
talking would mean two people standing together.

The line-writing rule that fell out of it: *a person in Reykjavik at half past eleven at night
is not amazed by the aurora. They have seen four thousand. What they are is mildly interested
that you sat still long enough to get one.*

## FOUR MORE, ALL "THE TASK HAPPENS AND NOTHING SAYS SO"

- **The whale mini was a three-metre coin flip.** She breaches at (6, 164); the head of the
  pier is 31.2 m away and the point the task BEACON aims at is 33.6 m away, against a 34 m
  trigger. Four tenths of a metre inside. The question was wrong anyway — the task is 'be on
  the pier' — so it is answered by the pier now, and **she comes when somebody is waiting**:
  the idle clock runs four times as fast while the animal is within 42 m of the pier head, so
  turning up produces a whale in ~23 s instead of an average 27 s and a coin toss.
- **The weathervane asked for up to nineteen seconds of standing still and said nothing.**
  `driVaneT` was accumulated and never read by anything. A line once you have settled, a
  ripple of paper off the post each time the breath goes slack, and `vaneToTurn()` on the API
  so the task card counts it down (the treatment `souk-escape` has had since it was written).
- **The hot spring is called 'have a LONG sit' and was over in seven seconds.**
  `game.record('hot-spring', …)` has always banked the overstay and nothing in the world ever
  mentioned it. Six marks, and they escalate DOWNWARD — quieter sound, drier joke — because
  the reward for staying in a hot spring must be less exciting than the reward for getting in.
- **The souk chase never acknowledged a near miss.** A trader passing the end of your alley
  without looking down it is the only thing a chase through a maze has that a chase across a
  square does not, and it happened constantly in silence. Latched per pursuer per chase.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **Fourteen stall canvases in Jemaa el-Fnaa were one colour.** `awn` was three creams four
  values apart, cycled by index, so the fourteen brightest objects in the square were one
  object drawn fourteen times. The canvas stays cream (they really are) and the VALANCE, the
  ridge and the number board are struck in the souk's own dye palette, one per pitch, with a
  striped tarp on every third. Plus a pressure lamp under each, emissive, driven off `sahDusk`
  — the square had no light source at all except fourteen discs of ember paint.
- **The Drift's opening five minutes were a lawn with poles on it.** Three stepping islands,
  three trees each (the green density is 0.058 and the clamp floor is 3). The fix is the same
  one the Crown's approach got: mark the ROUTE. Worn take-off and landing patches at each lip,
  a leaning marker with a rag, a hand-sized stack. It does a second job worth more than the
  first — **the player can now see where to jump from**, and on stepB that is the difference
  between clearing fourteen metres and not.
- **The wheek did nothing in the cloud**, which is where a player sits having just fallen off
  something. A ring runs out across the whole sheet now (four multiplies a vertex on a mesh
  already rewritten every other frame) — but **from inside the cloud the sheet's wave is
  invisible**, because the eye is ten centimetres over the vapour and the horizon is lumps.
  It needed the puff-ring burst as well.
- **A local's dialogue may be rude about a task; it may not send the player to the wrong
  object.** The man at the gate said "the lead one bites, ride the third" and the one kinematic
  platform in the chapter is on the FIRST camel.
- `driUpdateSeeds` dereferenced `cp` four lines above its own `if (!cp) return` — one frame
  with no capybara position and systems.update throws, which takes the module out for the
  session ([[capy3-module-drop-failure]]).

## NUMBERS

Whole-scene visible triangles (my measure, which includes the shared systems and reads about
70k above the per-chapter figures the earlier passes recorded): Iceland 199,002 -> 198,478,
Marrakech 194,874 -> 196,180, the Drift 203,486 -> 206,462. Bodies: Iceland 40, Marrakech 58,
the Drift **207 -> 82**. Locals 8 / 10 / 8 and dialogue lines 111 / 125 / 96. `node
build.mjs` clean, `qa/audit-tasks.mjs` 0 blockers, 15 s random-input fuzz per biome with no
NaN, no void falls and `state.lastError` null, a real-clock soak with audio unlocked over all
three reporting **zero console messages**, and a 146-shape physical solidity test on the
Drift's regrouped bodies with zero fall-throughs.

Related: [[capy3-third-pass-six-seven]], [[capy3-third-pass-eight-nine]], [[capy3-the-locals]],
[[capy3-solid-or-drawn]], [[capy3-the-picture]], [[headless-qa-harness]],
[[capy3-module-drop-failure]], [[capy3-fourth-pass-four-five-six]]
