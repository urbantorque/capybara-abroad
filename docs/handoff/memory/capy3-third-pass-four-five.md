---
name: capy3-third-pass-four-five
description: "The deep pass over Kyoto and Cali: the marquee shot that was a golf course, the reflection that took five attempts, and the mirador whose inland half was inside the hill"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-21T16:53:31.083Z
  originSessionId: 61e2d5ae-a3dc-45e7-9e0d-e0292f7730d3
---

Done 22 Aug 2026, a third pass over chapters 4 and 5 after
[[capy3-chapters-three-four-five]] had already been through them. That pass found
*things pointed slightly wrong*. This one found **the ground the marquee stands on**:
in both chapters the single most-photographed shot was correct in every number and
empty in the picture.

## The two headline misses were both EMPTY GROUND

**Fushimi Inari was a lawn.** Forty-four vermilion gates S-curving up a 34 m dome
with a shrine at the top and NOTHING ELSE on the hill. Rendered, chapter four's
marquee shot is a red ribbon lying on a golf course. Fushimi Inari is not a hill
with gates on it, it is a *mountain of sugi*, and the reason the tunnel reads as a
tunnel is that the wood outside it is dark and close. 360 cedars, three instanced
draws, the corridor cut OUT of the placement (nothing within `kyoTORII_CAM_R + 2.4`
of a gate) — plus the ground under them tinted to needle litter, because three
hundred dark columns standing on bright grass is a plantation, not a wood.

**And the mirador at the top of Cali's chiva ride was a bare slab.** 465 m of bus,
three cables, the sun going down, nine hundred and forty windows coming on — and
you step off onto empty concrete with two unlit lamp posts. A chontaduro cart with
a charcoal brazier, a coin viewer, a rail of padlocks and ribbons, a string of
bulbs, and a man who is not remotely impressed.

## The mirador's inland half was INSIDE THE HILL

`caliRoadY` has always blended to `caliMIR_DECK` over the terrace footprint,
because the bus has to arrive on the deck rather than climb a kerb. `caliTerrain`
— which is what the ground MESH and the CANNON heightfield are both built from —
knew nothing about it. Measured on a grid: the raw flank crosses deck level about
**0.9 m inboard of the terrace centreline**, so the inland half of an 18 × 12 m
deck is buried and there are seven metres of standable stone at the end of the
chapter's marquee ride. It cost two wrong cart positions before it was measured.

Three follow-ons, all of which had to be found by looking at the frame:

- **Cut to 30 cm BELOW the slab, not to it.** The drawn terrace's top face IS
  `caliMIR_DECK`; cutting the ground to the same number makes them coplanar and
  the flank z-fights across the whole terrace as a translucent green wedge.
- **The cut has to be WIDER than the deck.** `caliMiradorT` feathers over the last
  2.5 m *inside* the footprint (right for blending a bus onto a kerb), so used as a
  terrain cut it leaves 2.5 m of the deck's own edge with hillside standing over it.
  3.2 m proud on every side, feathered outside.
- **A shelf that becomes flat becomes attractive to every placer that tests slope.**
  `caliBuildFlora` rejects on `caliSlope > 0.5`; the flank used to fall at nearly
  60% so the mirador was rejected for free. The next build put a ceiba through the
  middle of the terrace. Rejecting the *footprint* was not enough either — the
  bench is cut 3.2 m proud of it, so the tree simply moved to the shelf outside the
  paving with its 8 m canopy filling the arrival frame. A 22 m radius.

## A NEW PLACER MUST KNOW WHERE THE ROAD IS

465 m of chiva route wander the whole biome and nothing outside `caliBuildRoad`
ever had to know where it goes. The moment anything is PLACED that stops being
true: the first cut of the back rows put a terrace **25 cm** off the near side of a
bus doing 7 m/s, and the first line of samán was planted on the road's centreline.
`caliRX/caliRZ` are already resampled at ~1 m by `caliBuildRoute`, which
`caliBuild` runs FIRST — so **`caliOffRoute(x, z, m)` is four lines and every
placer should use it.** Verified by driving the whole route: arrived, progress 1,
no stall, and an audit over 1433 route samples finds one pre-existing 15 cm
near-miss at the corner by the north terrace and nothing else.

Same class, one row up: `z = caliSTREET_Z + side * 34` is `z = 6` on the north
side, which is **the Río Cali** — a dozen tiled roofs floating in the river. The
far scatter only exists uphill.

## THE REFLECTION TOOK FIVE ATTEMPTS AND THE ANSWER WAS NOT GEOMETRY

Kinkaku-ji is famous for what is *under* it and the pond was a flat pale ellipse.
Venice's camera-facing additive smear ([[capy3-third-pass-nine-ten-eleven]]) was
the obvious port and it is wrong here, for a reason worth keeping: **her reflectors
are lamps fifty metres off; this is a nine-metre gold building twenty metres away
filling a quarter of the frame.** Every cut rendered as a pane of frosted glass with
the plate seams showing, and each time the tell was the standing one — the new
thing had become the most prominent object in the shot. On the way:

1. anchored at the island centre → a slab of gold light across the island's own
   granite apron from half the angles;
2. four fixed reflectors round the rim with outward normals → two light at once,
   and the pond gets two detached rectangular panes ten metres off the building;
3. squaring the facing term and scaling BOTH axes by it → a 4 m sliver you cannot
   find in the frame;
4. one orbiting anchor at radius 8.4 → **`kyoIsOverWater` excludes a RECTANGLE for
   the island (|dx| < 8, |dz| < 7) and a circle of radius 8.4 passes INSIDE that
   rectangle at forty-five degrees**, so every diagonal approach read as dry land
   and the smear collapsed. Solve the ray against the box, not a circle.

**What a still pond under a gold building looks like from 41 degrees up is not a
strip pointing at you. It is a WARM PATCH, it is the same warm patch from every
side, and it does not move.** Baked into the water's own vertex colours: no seams,
no camera term, no draw call, right from all four approaches instead of from one.
It only reads at all because the pond stopped being the river's pale glacial blue
— a bright cyan sheet has nowhere left to go brighter (`pondWater`/`pondDeep`).

**And a smear IS depth-tested.** `kyoRipple` writes the pond ±9.4 cm, so at
Venice's +0.014 most of every reflection was being cut away by the wave it was
supposed to be lying on. This is also why a shot harness must give the biome one
`update()` against the SHOT camera before rendering: anything keyed to
`game.camera` is otherwise measured against wherever the follow camera happened to
stop.

## Two more done-flag-gates-the-THING-not-the-TASK, and the fix is a joke that lands

Fifth and sixth in this family. Kyoto's nine stone lanterns stayed on their sides
with their colliders reshaped to the fallen box, and the twenty-six paw prints
stayed in the gravel with `kyoTrackN` at its ceiling — so a second visit found a
garden already vandalised and neither object could be used again. Both are put
back in `onEnter` now (`kyoLanternStand` is the inverse of `kyoLanternFell`), and
that is better than merely correct: the man beside the rock garden says *"I raked
that this morning. I will rake it again."* Coming back to a raked garden is the
chapter answering a line it has been saying since it was written.

## What else went in

- **The bell reaches the valley.** `kyoBellWave` decays over 16 s, which is right
  for koi going deep and much too slow for anything HIT by a shock front. A second
  envelope, `kyoBellPulse`, over ~2 s: Gion's forty paper lanterns swing five times
  their idle amplitude and IN PHASE, ninety petals lift and drive sideways, the
  grove shivers — and all twenty-two tea pickers eighty metres away straighten up
  and turn to face the shoro. A bell is only enormous if somebody who is not you
  agrees that it was.
- **`torii-run` is a mini now** (`SENBON TORII`). Forty-four gates up a mountain was
  paying out through the same channel as knocking over a lantern.
- **Twenty-two tea pickers** on nine terraces that had nobody — bent, with baskets,
  straightening every ~8 s. They must go in the FRONT AISLE (±2.85): the hedgerows
  are 1.5 m high and 1.2 m apart, so a picker in the 50 cm channel between two of
  them is buried to the shoulders, which is what the first cut rendered.
- **Eighteen ringside watchers** at Cali's salsoteca, clapping on 2 and on 6 — the
  same eight the dancers step to, at head height, in the one channel a player
  looking at their own animal can still see. The hands are their own instance
  because a clap is a gap that scales to nothing.
- **Uji's tea street was unpaved grass** — twelve shopfronts with their noren out
  standing on a lawn, while Gion has had granite setts since the chapter was
  written. Paving, gutters with water in them, potted maples, doorway lanterns,
  trestles of sample tins and stacks of tea chests.
- **Eight new locals** (5 Kyoto, 3 Cali): the summit shrine keeper (so the payoff
  for 44 gates is a person who saw you do it), the bell keeper, an Uji tea seller,
  a picker, the ukai master beside his cormorant boats; the mirador vendor, the
  salsoteca bartender, and somebody at the foot of Cristo Rey.
- Cali's back rows, riverside samán/benches/lamp standards, San Antonio's
  bougainvillea and power poles (which also teach the cable hazard forty seconds
  before it has to be hopped), and a plantain grove in the seam between town and
  cane.

## Numbers

Kyoto 81 728 → **118 088** triangles (+44%), 185 draw calls, 3.4 ms headless.
Cali 72 432 → **91 400** (+26%), 182 calls, 3.1 ms. Both under 130k/220.
`qa/fuzz.js` clean on both (no NaN, no void falls, no solver saves, no errors);
`qa/audit-tasks.mjs` 0 blockers over 199 tasks; every local anchors at
`dy >= 0` and none over water; `node build.mjs` clean, no top-level collisions.

**One harness lesson, and it cost an hour:** `s.slice(indexOf(A), indexOf(B))` in a
patch script returns *everything to the end of the file* when B is not found —
`indexOf` gives -1 and `slice(a, -1)` is not empty. Replacing that "chunk" deleted
1800 lines of `kyoto.js`. There is no git here; **`dist/untitled-capybara-game.html`
is the only backup, it is a flattened copy of every module, and it was newer than
the file it saved.** Splice by anchor with an occurrence count that must equal 1,
never by computed slice.

Related: [[capy3-chapters-three-four-five]], [[capy3-third-pass-nine-ten-eleven]],
[[capy3-the-locals]], [[capy3-the-middle-rung]], [[capy3-visibility-metrics]],
[[headless-qa-harness]], [[capy3-solid-or-drawn]]
