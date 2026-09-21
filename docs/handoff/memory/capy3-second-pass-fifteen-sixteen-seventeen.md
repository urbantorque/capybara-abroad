---
name: capy3-second-pass-fifteen-sixteen-seventeen
description: "The second pass over capy3 chapters 15, 16 and 17: three published APIs nothing read, a cave with nobody in it, and a pod that could not catch the boat"
metadata: 
  node_type: memory
  type: project
  originSessionId: 75704d9a-1241-4622-8155-c3535a1243d3
  modified: 2026-08-21T05:59:10.088Z
---

Done 21 Aug 2026, a deep second pass over the Pantanal (15), Sơn Đoòng (16) and
Antarctica (17) — the last three chapters, none re-audited since it was built. About a
hundred changes. The shape was different again from the earlier passes:
[[capy3-the-second-pass]] found furniture nobody collided,
[[capy3-chapters-six-seven-eight]] found systems built and never implemented,
[[capy3-second-pass-twelve-thirteen-fourteen]] found systems described and never
populated. **These three had things PUBLISHED and never consumed**, and the tell was
always the same: a comment saying who reads it.

## The pattern: an API with a reader that does not exist

`grep -on "game\.<biome>\.[a-zA-Z]*" src/systems.js | sort | uniq -c` is the whole
diagnostic and it takes ten seconds. Cave came back with `daylight` ×4 and `echo` ×4.
Pantanal came back with **eleven landmark getters and nothing else** — and pantanal.js
publishes `dusk()` with the comment *"0..1 — the sundown the crossing switches on.
systems.js reads it."* Nothing in the game read it. The chapter's marquee is written as
a STATE rather than a stunt (you are in the river, four of them are behind you, and the
light does the ceremony) and **the ceremony was a variable being damped toward one in
a file nobody asked**. Same class: `crossing()`, `echoReady()`, `packAt` — all dead.

The same grep over the PALETTE finds the other half: `panLilyRim`, `panLilyBud`,
`panSkyDusk`, `cavCricket`, `cavGlowDim`, `cavFoam`, `antBrashDk` were all declared with
a comment describing what they were for, and never used once. Every one of them turned
out to name a real missing feature — the giant water lilies, the sundown sky, the cave
crickets, and **the glow-worms going out when you shout**, which is now the best
sentence in chapter 16 and was sitting in the palette as a colour called `cavGlowDim`.

## Three chapters, three headline gaps

- **Pantanal was a LAWN.** 820 grass tufts over 54 000 m² is one every 66 m: from the
  standard rig, the largest wetland on earth was a flat green plane with four cones on
  it. Fixed by density AND variety at three heights — reeds along the waterline contour
  (which draws every shoreline for free), caranda palms on open ground, low scrub, and
  the grass put down in CLUMPS from ~200 seeds rather than scattered.
- **Sơn Đoòng had NOBODY IN IT.** Zero locals, in the one chapter where the fact
  everybody knows about the real place is that you cannot go in it alone. Five now, plus
  an expedition camp under the doline with three tents and a washing line — and in a
  chapter about darkness **a person is a LIGHT**: two of them carry head torches
  (real PointLights), which are the only moving lights in a hundred and seventy metres of
  mountain and a better signpost than any arrow.
- **Antarctica's wheek did nothing on land.** `if (antHelmOn) antPodSummon()` — one line,
  so off the tiller the loudest animal at 65°S was inaudible to 4 000 penguins, a skua,
  26 petrels and a leopard seal, while the colony local's wheek line promised *"now they
  are all looking at you"*. Now the colony answers in three calls rolling up the hill
  (a new task, `colony-chorus`), the skua breaks off its stoop, the petrels scatter and
  the seal lifts its head.

## THE POD COULD NOT CATCH THE BOAT, and it is the marquee

`antPodSummon` sets state `coming` and the pod closes at **7.6 m/s**. The tender's top
speed in the lead is **12.6**. The marquee is *"call them, then HOLD YOUR SPEED"* — so
the one state in which the summon has to work is the one in which the gap opened at five
metres a second until the 26-second patience ran out and they went home. Measured over a
full run down the channel: wheek at the tiller, hold full ahead, `withPod()` stayed at
**zero for four hundred and seventy metres**, which is the entire chapter. 15.5 m/s now,
which is also what an orca actually does. **Only a real playthrough finds this** — every
number in the file was individually sensible.

## Bugs found, in the order they cost the most

- **A shared scratch Vector3 returned from an API is a trap for the TEST, not the game.**
  `game.pantanal.caiman()` returns `panV3b`, which `herd()`, `cowbird()` and `anteater()`
  all also write — and systems.js calls those every frame for the hint arrow. A probe
  that held the result across a `sleep` measured the capybara 88 m from where it was
  standing, three times, and cost half an hour. Snapshot on read.
- **The Pantanal's road embankment was collided at the deck's width.** Drawn
  `ROAD_W*2 + 1.6`, collided `ROAD_W*2`: 80 cm of a 1.75 m earth bank, either side, for
  two hundred metres. 556 walkable squares — the worst single number in the sweep.
- **'Sit on a sleeping jacaré' fired for walking past one.** The caimans had no colliders
  at all, so the height band was satisfied by standing on the sandbar beside the animal.
  Fixing it needed the chapter's OWN lesson applied to its other platform: a jacaré lying
  in eight inches of water has to be reported in `terrainHeight`, or `isOverWater` tells
  the animal it is swimming on the frame it lands. Measured: a capybara at rest sits
  **0.337 m** above whatever it is on, so "on it" is +0.66 and "beside it" is +0.34, and
  the test sits at +0.46 between them.
- **The cave's log teleported 130 m with a passenger aboard.** The lap wrap ran whether
  or not anybody was standing on it — a ride that ends by leaving you alone in the sump
  while your floor reappears in the entrance. It grounds at the bottom now and waits.
- **The jabiru landed 15 m from where it took off, every time, and then teleported back.**
  The flight was `t * PI * 1.4` — 252° of a circle drawn round a hard-coded centre — and
  the ground state never moved the bird home. A full turn lands it on its own feet. It
  also re-triggered on `near < 9` with a clock that resets on landing, so a player
  standing under the tree got an infinite loop of take-off and landing.
- **The skua cried nine times per dive.** The test was a 0.15 s WINDOW on a clock that
  advances by dt, so it was true for nine consecutive frames. An edge crossing
  (`prevU < k && u >= k`) is true exactly once however long the frame is.
- **The Pantanal's grazing herd was an unbounded random walk** — ±5 m every ~9 s with no
  anchor diffuses ~23 m per ten minutes, so over a long session the herd leaves the
  meadow and 'wheek near another capybara' stops being a thing you can do.
- Six of the fourteen jacarés were placed at `x = rand(-90, 90)` on the river's z, which
  is the middle of the channel: `max(bed, WATER - 0.1)` floats them dead flat on the
  surface out in the stream, and `api.caiman()` pointed the hint arrow at one of them.

## Things that measured wrong before they measured right

1. **A lily pad's rim is TANGENTIAL and `panXform` composes 'XYZ'.** `M.box(..., 0.40
   wide, ry = -a)` turns the box's own X axis to point RADIALLY, so eight rim segments
   became eight spokes: photographed from the river, a red and green pinwheel. Same
   family as Manly's rock pools standing on their edge. **The long axis goes in Z.**
2. **A puddle is DARK.** Painted `panWaterLit` at 1.15 × 3.3 m they photographed as
   sheets of A4 lying on the road. And the wheel RUTS were drawn at `ROAD_Y - 0.045`
   with a height of 0.10, so their top face was 1.5 cm *under* the deck plank they were
   meant to be worn into — the road came out perfectly blank twice.
3. **A green stripe down the middle of a dirt road is a road MARKING.** The crown is
   drawn by letting the chapter's own grass grow there instead.
4. **One light 30 m up with decay 1.5 does not light a floor 30 m below it.** Inverse
   square over that distance is a factor of nine hundred, so the number that matters is
   the RANGE, not the intensity: 190 m of falloff, not 96.
5. **A two-hundred-metre waterfall at alpha 0.34 is a slab of concrete** — exactly what
   the shaft beside it already had a comment about — and a seven-sided cylinder that tall
   photographs as a flat wall. 12 sides, alpha 0.16, and it is mostly air by halfway down.
6. **Snow in a katabatic wind is a THREAD.** 120 quads at 0.30 opacity and 1.5 m across
   photographed as sheets of paper blowing down a hill. 0.13, twenty times longer than
   wide, and the fade baked into the SCALE because there is one material.
7. **A pitch big enough to read as "head thrown back" lies the whole penguin down.** The
   gentoo is a bowling pin with no neck; at −0.95 rad the rookery was a field of birds
   having a nap. −0.40 plus a vertical STRETCH is the same read.
8. **The sparkle has to be judged from the camera the marquee is taken with.** The
   Pantanal's sheen was tuned from the standing rig six metres up; the crossing is taken
   SWIMMING with the lens at the waterline, where a 1.6-scale cell subtends fifteen
   degrees — a screen of white splotches over three quarters of the frame, in the one
   shot the chapter is built around.

## The budget, and it is real

Density is not free and it is the easiest thing in this codebase to overspend. The
Pantanal went **117k → 270k triangles** before anything was trimmed, against a Pasto that
does the whole of Sydney's rival for 98k. Frame time cannot tell you — all seventeen
chapters measure 16.8–17.0 ms median because that is vsync. **Measure per mesh**
(`tris × count`, sorted) and the answer is always the same shape: the grass was 44 748 of
188 000. What worked, in order of value:

- a grass blade is a box whose two narrow faces nobody can see: **3 blades not 5**, and
  buy the density back in instances (same cost, 57 % more tufts);
- **a flat water sheet does not need 3 m cells.** Every vertex is written to one height,
  so the only thing the resolution buys is the alpha gradient at a shoreline, which is a
  4 m feature. 13 400 → 7 500 and nothing looks different;
- three canopy blobs per tree, not four — the fourth is inside the other three.

Landed at **Pantanal 160 900 / Cave 70 700 / Antarctica 89 500**, all at 16.8–17.0 ms
median and 17.7–17.9 p95, one draw call each.

## Measured after

**17/17 clean on `qa/fuzz.js`** (no NaN, no void falls, no console errors, no
`lastError`). `qa/audit-tasks.mjs` **0 blockers over 199 tasks** in 17 chapters — the
new one is `colony-chorus`, and chapter registration is still the fourteen places listed
in [[capy3-the-pack-and-the-pod]]. Locals **2 → 7 / 0 → 5 / 3 → 6**. Bodies 71 / 127 / 38.
Verified by playthrough: the caiman ticks when you stand on one and not when you walk
past, the colony chorus ticks on a wheek in the rookery, the whale bones tick from
inside the (now solid) ribcage, the glow-worms drop from 1.9 to ~1.1 emissive on a
wheek, the log makes no jump with a passenger, and the orcas reach **5.3 m clear of the
water** on the breach.

Related: [[capy3-the-herd]], [[capy3-the-dark]], [[capy3-the-pack-and-the-pod]],
[[capy3-solid-or-drawn]], [[capy3-the-locals]], [[capy3-things-that-are-simply-there]],
[[capy3-the-picture]], [[headless-qa-harness]]
