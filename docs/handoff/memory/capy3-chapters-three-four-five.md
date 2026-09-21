---
name: capy3-chapters-three-four-five
description: "What a deep second pass on capy3's Quay, Kyoto and Cali found: a ferry that collided with nothing, a dance floor that was half building, and six people standing inside their own props"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f886bbb-15ec-4e4a-a66c-829bc9d2cdbf
  modified: 2026-08-20T19:43:35.975Z
---

Done 21 Aug 2026, on "deep second pass for biomes 3, 4 and 5". Same shape as the Sydney/
Pasto pass ([[capy3-the-second-pass]]) — everything found was in something already 95% right —
but three of the findings were structural rather than tail, and all three had survived every
existing audit for the same reason: **the audits all test the CAPYBARA.**

**A KINEMATIC BODY IS NOT STOPPED BY A STATIC ONE, and MV Wheek had no other collision.**
The whole of chapter 3 is steering a ferry seven hundred metres up the harbour, and for the
life of the chapter she sailed through Fort Denison, Shark Island, both pylons of the Harbour
Bridge, thirteen sandstone headlands, the Manly wharf and up the beach. Nothing reported it:
`qa/audit-solid.js` samples the animal's chest height on foot, and a vehicle that writes its
own position every frame is invisible to it. The fix is analytic and lives in the module —
push the hull out, delete the component of way that was carrying it in, keep the component
along, so a glancing blow SLIDES her round the point. Verified by driving at Bradleys Head:
stops at 31.1 m (the collision radius) instead of passing through; a full berth-to-Manly
passage still runs 64.5 s and still arrives.

**THIRTEEN HEADLANDS WERE OPEN WATER.** `quayHeadland()` drew a bluff and nothing else was
ever done with the numbers: `isOverWater` true, `terrainHeight` 0, no collider. Same omission
as Fort Denison in the last pass, twelve more times. They are one pooled body now, TWO shapes
each — a square and the same square turned 45°, whose union is an octagon (flats at 0.70 r,
points at 1.02 r, against a drawn 11-gon whose radii run 0.68–1.18 r). Two shapes, not the
150 a tiled disc needs. Quay went 954 → 3441 audit samples (there is land there now) and
1 → **0** walk-through hits.

**TWO STATIC BOXES CAN BE BUILT IN THE SAME PLACE AND NOTHING WILL EVER TELL YOU.** Cali's
salsoteca and San Antonio's south terrace were laid over each other: measured on a 1 m grid at
chest height, **43% of the dance floor was solid** — three houses in it, one nearly on the
centre. So chapter 5's marquee mechanic, the one task in the game that cannot be brute-forced,
was played in a circle that was half wall. Both were only ever "hold the capybara up", so both
worked. The measure that finds it is AREA BLOCKED ON A GRID inside the zone a mechanic lives
in — not a raycast. 43% → 3% (the residue is AABB artefacts of the ring wall's own rotated
segments). The floor's way in was also cut on the far side from the street, and the wall that
stood where the entrance should be was across the chiva's road.

**A LANDMARK CONSTANT IS NOT A PLACE TO STAND.** Six locals across the three chapters were
anchored on the constant that names the thing they belong to, and every one of those is the
centre of a solid object or a body of water: the Kyoto miller on `kyoMILL` (the river's
CENTRELINE — he was 1.35 m above the middle of the mill pond; npc.js's note says this was
fixed, and it moved his y and left his x/z in the water), the tea master 3 m from the centre
of a 5.4 m tea bowl, the chip-shop keeper in the middle of his own building, the lulada seller
inside his cart, the bus conductor inside the parked bus, the dance teacher dead centre of the
floor. **The audit is four lines and is worth keeping** — for every `game.locals` entry:
`y − terrainHeight`, `isOverWater`, and the anchor against the static bodies.

**THE FLAT-SLAB ROOF IS SYSTEMIC IN THIS CODEBASE.** Manly's wharf shed, the three finger-wharf
shelters, Gion's eighteen machiya, Uji's twelve tea shops and San Antonio's eighteen painted
houses ALL drew their roofs as two or three stacked flat boxes. The game has exactly one camera
angle — 41° down — and at 41° a flat roof IS the building, so five separate places put an
unbroken grey or red plane across the top of every frame. Two pitched planes about a ridge is
one box a side. **And the follow-on trap:** a separate eave course under a pitched plane has to
agree with it about two rotations and a width, and it does not — it reads as a loose plank
floating off the roof edge. Make the plane deep enough to be its own eave.

**THE ONE-SHOT MINI, three times.** Quay's chip basket, Kyoto's matcha heap and Cali's lulada
jug each set a `...Gone` flag and `visible = false` at the moment they fire, and none of the
three was ever re-armed in `onEnter` — so on a second visit (which the departures board allows
from anywhere) the set piece was spent and the object simply was not there. Quay's own onEnter
comment argues for exactly this and then re-armed only the voyage. The CHECKLIST stays ticked;
the OBJECT is a thing in the world. Also: `quayBurstChips` moves all 22 gulls to Manly and
nothing had ever moved them back.

**COLLIDER TOP vs DRAWN TOP disagree by a hand's width all over.** Fort Denison 0.50 m, the
Manly cove floor 0.30 (and the dry sand above it 0.125 — it needed two shelves, not one), the
Uji bridge deck 0.155, the Circular Quay apron 0.20. Nothing reports these; you see it as the
capybara hovering over its own shadow, or standing inside the flagstones.

**terrainHeight FEEDS capybara.js's SOFT-FLOOR BACKSTOP** (`capyGroundY` → adds upward velocity
toward whatever the ground claims to be, capped, never a teleport). So making a 31 m bridge
pylon "land" in `terrainHeight` is a levitation bug waiting at the waterline. Solid is solid:
the static box does the job; leave terrainHeight at the water. Headlands are safe only because
the octagon test and the collider are the identical shape, so a swimming animal is always
outside both.

**TWO HARNESS TRAPS, both of which wasted a probe:**

- The `body.aabb` inside-a-collider test is **useless for POOLED bodies** — a compound's AABB
  is the union of all its shapes, so the whole Circular Quay quayside reads as one enormous
  box and every local in the chapter reports "inside a collider". Kyoto and Cali use
  one-shape-per-body helpers, so their results are real.
- A merger's `add()`/`box()` AFTER its `build()` goes nowhere, silently. Gion's new lantern
  posts needed their own merger because `G` had been built four lines earlier.

**QUAY HAD NO AMBIENCE RUNG AT ALL.** `bio === 'quay'` appears nowhere in systems.js's
soundscape ladder, so a working harbour fell all the way through to the bare `sfx('gull')`
fallback for the whole of a seventy-second passage. Kyoto had one line (a chime every 16–34 s)
over a chapter containing a bamboo grove, a river at six metres a second and a temple bell.
All three are positional now, which is the sahara rule.

Frame time unchanged (1.5–1.8 ms headless in all three); bodies 32→36 / 150→151 / 73→71;
`node build.mjs` clean, no top-level collisions; `qa/audit-tasks.mjs` 0 blockers;
`qa/pointers.js` empty for all three; fuzz clean (no NaN, no void falls, no solver saves).

Related: [[capy3-the-second-pass]], [[capy3-solid-or-drawn]], [[capy3-the-locals]],
[[capy3-external-forces-on-the-capybara]], [[headless-qa-harness]]
