---
name: capy3-fourth-pass-sixteen-seventeen
description: "The fourth pass over capy3 chapters 16 and 17: a chapter whose exit was never built, a marquee under a canopy, a task that ticked itself off, and the albedo ceiling that hides everything in Antarctica"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3deed6f6-0960-4f8c-bfde-3308de215a57
  modified: 2026-08-23T03:23:20.460Z
---

Done 23 Aug 2026, a deep pass over Sơn Đoòng (16) and Antarctica (17), six weeks
after [[capy3-third-pass-fifteen-sixteen-seventeen]]. That pass was about what
is IN THE FRAME. This one kept finding the same thing one level down: **a
feature that is fully described in the comments, wired to the fog, the grade
and the checklist, and does not physically exist.**

## THE SLOT WAS NEVER BUILT

cave.js's own header has said since it shipped:

    z-150..-176  THE SLOT, which is daylight, and is the way out.

`cavDaylightAt` answers **0.85** down there, so systems.js opens the fog from
165 m to 500, lifts the hemisphere by 1.05, the ambient by 0.36, the sun by 2.0
and the grade's threshold by 0.62 — for a daylight with **no source and no
opening**. The far wall was one unbroken 150 m slab of `cavRockDk`. The player
walks a hundred and seventy metres of mountain to the place the card sends them
and finds a wall.

And it was worse than nothing, twice over:

- **`cavRoofH` brought the roof to 16 m over a floor at 12.5.** Three and a half
  metres of room, and the follow rig sits about eight metres above the animal —
  so the LAST SHOT OF THE CHAPTER was a **completely black frame**, because the
  camera was inside the ceiling. 27 now.
- **The floor was painted a lawn.** `if (dl > 0.05 && z < 30) lerp(soil, 0.68)`
  is true at BOTH ends of the chapter; the final chamber, which is bare
  limestone, came out 68 % forest soil. Soil happens under a COLLAPSE (gated on
  `cavHole` now); at the slot there is a patchy rind of `cavPhyto` on rock,
  inside the fan of the beam and nowhere else.

Four things make an opening read as one, and it is all four or none: it is a
TUNNEL (fourteen metres of rock, lined); there is a WORLD behind it (a
silhouette of jungle in FRONT of the bright plane — a light with nothing in it
is a light box); the light COMES IN (an additive wedge, sloping, with dust
blown along it, because at this end the sun is low and across rather than
overhead); and something GROWS in it, in a gradient from moss to a sapling.

**AND THE BRIGHT PLANE MUST BE FOGGED.** First cut ran all three `fog: false`
"because they are the horizon" — and `cavDaylightAt` is 1 at the SPAWN, so the
fog is open to 500 m out there, and the head of the slot stands ten metres
proud of the Great Wall. A lit rectangle with trees in it was hanging in the
middle of the first frame of the chapter, 270 m away, through a mountain.
Fogged it is a chink you will not understand for twenty minutes, and at the
forty metres you stand at it the fog has not started (near is 61 under that
much daylight).

**And you could walk out of the world through it.** The sill was 0.4 m over the
floor — under a capybara's step — into a tunnel that ends past the heightfield.
2.5 m of sill: the chapter does not end by walking out, it ends by standing in
the zone.

## THE MARQUEE WAS UNDER A CANOPY

Photographed standing at `game.cave.doline()` — the hint-arrow target, where
`the-doline` ticks and the score holds a swell — chapter 16's marquee was a
wall of bare trunks and green fern cones in a green haze. Three numbers did it:
trees grew from one metre out, they were TALLEST at the middle
(`lerp(11, 3.5, rr / D.r)`), and the rig is eight metres up.

A collapse doline does not work like that. **What lands under a hole in a roof
is THE ROOF** — and nothing grows on the pile for a long time. So: an
eleven-and-a-half-metre glade, the wood as a RING that is tallest AT the ring,
and forty-four blocks of breakdown in an annulus with the middle five metres
left bare for the column of light to land on. (First cut put the biggest blocks
at the centre at up to eight metres and walled the animal in — the glade exists
so the player can STAND in the light.)

Same disease at the arrival: the corridor through the jungle had a **ceiling**.
3.4 m of half-width against a 2.4 m crown radius means two legal trees MEET
over the middle of it; the path ran through x = 3.4 at z = 62 and the animal is
put down at x = 0. 6.5 m wide (8.5 at the spawn end), centred on the spawn, and
nothing over 3.2 m within twelve metres of it — which is not a compromise, it
is what a track through a forest looks like from the air.

## THE TASK THAT TICKED ITSELF OFF

`if (up > 30) cavTask('swiftlets')`. The roost turns over on its own every
38–66 s (correct — a world is a place things happen in), that lift reaches
`cavSwiftUp = 0.46`, and with the per-bird taper that puts **seventy-eight of
the ninety** over the `k > 0.3` line. So the one task in chapter 16 that is a
thing you DO was ticked within forty seconds of arriving, from four hundred
metres away, with the roost not yet in the frustum. Measured after: 30 s soak
at the entrance ticks nothing; a wheek at the roost ticks `first-echo`, `wheek`
and `swiftlets` together.

Two more from the same function: the roost's noises were **not rationed by
distance at all** (audible through a mountain from the entrance), and the
settled state damped every bird's live X and Z toward a 1.5 m circle at the
roost centre — a colony that finished its circuit converged into a **column of
ninety birds hanging in mid-air**. They have homes now (`cavSwiftHX/HY/HZ`), and
the homes are on the wall `cavBuildRoost` puts two hundred nest cups on.

## THE ALBEDO CEILING, WHICH IS THE WHOLE OF CHAPTER 17'S LOOK

Antarctica runs the highest hemisphere in the game (1.24) with a white ground
bounce, ambient 0.36 and sun 1.06. **Measured off the ground mesh**: the middle
of the rookery carried a vertex colour of (0.48, 0.43, 0.39) and rendered as
clean snow; the whalers' beach at (0.04, 0.04, 0.04) rendered as the black
shingle it is. **Anything much over about 0.25 of albedo saturates to white on
this ground.** That single fact explains every "it is in the palette and you
cannot see it" in the chapter:

- `antGuano` is 0xb98b62 and the colony stain was invisible. Mixed at 0.38 and
  made blotchy (an even wash reads as a change of ground; a stain reads as a
  stain because it is patchy at the size of the thing that made it).
- `antGroundSlip` has said since the chapter shipped that the whalers' beach is
  "black volcanic sand and it is the grippiest thing in the chapter" — and the
  ground mesh painted it with the same snow-above-4.5-m rule as everywhere
  else, over a dome that PEAKS at 8. The one dark landform in a world made of
  white things was another white dome. (First fix faded it out above 7.2 m,
  which is above the peak, and it stayed grey.)
- The hut windows were `antWindow`-coloured boxes in a merged Lambert mesh:
  slightly yellow rectangles that neither glowed nor bloomed (the chapter runs
  the game's highest bright-pass threshold on purpose). They are emissive panes
  on their own nodes with a point light apiece now — same helper cave.js grew.

## THE CHICKS NEVER EXISTED

`antNests` holds an x AND a z per nest, so `antNests.length / 2` is the NUMBER
of nests (~104). `const spare = i >= antNests.length / 2` inside a loop that
runs to `antPENG_COL` (100) was **false on every iteration for the chapter's
whole life**. No bird ever stood between the nests, and the quarter of them
meant to be chicks — the single most obvious thing about a colony in the one
month anybody visits one — were never drawn. Both the `instanceColor` array and
the scale array were allocated and written to nothing but 1.

## FOUR MORE THAT ONLY A MEASUREMENT FINDS

- **The wake was under the sea.** `antUpdateSea` gives the sheet 23 cm of
  relief; the wake rings were at `antWATER + 0.06`, the brash at `+ r*0.10`,
  the spray at a fixed height, and the tender rode a THIRD, unrelated sine that
  agreed with the sheet nowhere. One `antSwellAt(x, z)`, four callers.
- **A recycled floe could be dropped on the moored tender.** The wrap puts a pan
  at z ∈ [18, 44] with x anywhere in a 96 m band about the lead — and the
  berth is (3.6, 22) with the jetty at x = 0 running z 18→39. `qa/kine.js`
  caught it: the moored boat teleporting **4.8 m in one frame with zero
  velocity**, shoved out from under a nine-metre pan. Worse than the boat — a
  pan is reported as GROUND by `antFloeTop`, so one landing over the jetty puts
  a floor at the waterline across the one place the player is guaranteed to
  stand. Roll until clear of both.
- **`cavGlow()` does not set `vertexColors`.** The cave-pearl group is one
  merged geometry with rims in `cavCalcite`, water in `cavWaterLt` and pearls in
  `cavPearl`, drawn with a material that ignores all of it: a heap of enormous
  cream dinner plates with faint bumps. Two meshes — the pools carry vertex
  colour, only the pearls glow.
- **A bare `BoxGeometry` in a `vertexColors: true` material renders BLACK.**
  Three feeds the shader a missing attribute, which reads as zero. Six hundred
  sun cups came out as solid black quads across the blue tongue. Every other
  instanced field in antarctic.js is a merged geometry that carries a colour
  attribute, which is why it had never bitten; the pack, also a bare box,
  correctly uses a plain `mat()`.

## THE FLAT-MARK RULE, LEARNT AGAIN TWICE

Everything laid ON a surface is either a MARK or a THING, and they want
opposite treatment. The glacier's first cut put crevasse lips at 34 cm of
relief and runnels at 2 m of width in one merged mesh with `castShadow = true`:
a hundred and thirty crevasses and twenty-six channels came out as a
scaffolding of white planks each throwing its own hard black shadow — a
builder's yard. A mark is FLUSH (a change of colour with two centimetres of
edge) and never casts; seracs, moraine and erratics are three-dimensional and
do. Two meshes, and the numbers on the first are a fifth of what they were.

The same rule, in the other direction, is why the hut drifts had to become
squashed spheres (five flat boxes stepping downwind = a stack of white paper
with a hard edge on every layer) and why the jungle's ground palms and
heliconias had to be pitched to 0.6 rad: **this camera looks down at about
forty degrees, so a leaf held within a quarter of a radian of horizontal
presents its whole top face and photographs as a green playing card.** Manly's
rock pools, the Pantanal's lily rims, the cave's moss discs, the sastrugi and
now these — it is the most repeated mistake in this codebase.

## WHAT WENT IN

Chapter 16: the slot; the doline glade and its breakdown; the arrival corridor,
a real arch with rock teeth over the mouth, a cliff face on it, and the CLOUD
POURING OUT (the postcard fact about the place, and the only thing that makes a
black patch in a cliff read as two hundred metres deep); the roost — cups,
lime, guano cone, a pole ladder; soda straws in patches along the joints; the
pearls; a rope, a stake and a battery LAMP at the top of the Great Wall, because
a climb with nothing above it is a dead end; seven locals with kit (a survey
tripod, a load, a coil, a camera, a billy) and head torches that SWEEP with a
visible cone.

Chapter 17: the whaleboat, which was a **staircase of nine boxes** (a brown
ziggurat — a keel that curves, a hull widest amidships, and ONE continuous
gunwale, which is the line the eye actually reads); the rest of a hundred years
of abandoned industry (staves, casks, tanks, chain, a roofless shed, five
graves); a whole whale rather than nine ribs and a jaw — a spine, a scapula and
a skull a third the length of the animal; ribs that CURVE, because two straight
props per station is an A-frame; the glacier's crevasses, runnels, sun cups,
seracs, moraine and erratics; the gate — sea cliffs, cornices, talus and four
stacks (added to `antBlockedAt` in the same breath, because she is kinematic and
cannon will not put her together with a static); the landing, which is where the
chapter starts and had a traffic cone on it; the apron; lit windows; drift; and
cape petrels round both bastions.

Audio, both: cave gets the river and the two-hundred-metre fall as POSITIONAL
beds and swiftlet ECHOLOCATION (which is the same sentence the chapter's one
verb makes, said by something that has been doing it for four million years),
and **a room with no ceiling does not answer** — a wheek in the doline or at the
slot gets no return at all, which is the loudest way of saying "you are nearly
out". Antarctica gets the katabatic (positional: loudest on the ice and high
up), the floe grinding under your feet, the calving as a CRACK and then a rumble
a beat behind it, and the gate giving a horn back off both walls with the delay
being the width of the narrows.

Two moments that are not tasks: the gate, and **the gentoos that ride the bow**
— a dozen of them form up at four and a half metres a second and porpoise
alongside for fifteen seconds, once, on the way out of the bay. The orcas are
the marquee and have to be summoned, held and earned; this just happens.

## MEASURED AFTER

`qa/fuzz.js` clean on both (no NaN, no void falls, no console errors, no
`lastError`). Solidity **2 / 5** hits, all of them brash floating in open water
or the far corner of the world (cave was 7 before the sill fix). `qa/kine.js`
maxTele 0.15 / 0.35, zero bodies out of the world. `qa/audit-tasks.mjs` 0
blockers over 199 tasks. Pointers clean. Locals 5 → 7 and 6 → 6, all speaking.
The pod still forms up and gives back **14.7 m/s** against a 12.6 VMAX.

**Cave 91 064 → 145 304 triangles (+60 %), Antarctica 122 870 → 181 166
(+47 %)**, both at 16.6 ms median and 18.9 / 19.8 p95 — the same band as Sydney
(19.5) and Pasto (19.0) on the same run, one draw call each. Bodies 160 → 189
and 83 → 116.

**And the wheek is Q, not Space.** Two probes and half an hour went on a "the
pod will not come" that was a harness bug: Space is HOP. Emit `capy:wheek`
directly when testing anything downstream of the voice.

Related: [[capy3-third-pass-fifteen-sixteen-seventeen]], [[capy3-the-dark]],
[[capy3-the-pack-and-the-pod]], [[capy3-the-picture]], [[capy3-solid-or-drawn]],
[[capy3-world-size-audit]], [[headless-qa-harness]], [[capy3-the-locals]]
