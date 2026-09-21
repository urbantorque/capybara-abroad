---
name: capy3-third-pass-twelve-thirteen
description: "The deep pass over Palawan and Cappadocia: the water sheet that shadowed the whole reef, a shadow that cast a shadow, and four chapters' worth of objects stuck ON surfaces instead of cut INTO them"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4c34fb9b-c29f-4e2f-938b-b320650f7f56
  modified: 2026-08-22T19:26:10.243Z
---

Done 23 Aug 2026, chapters 12 (Palawan) and 13 (Cappadocia). The second pass over these two
([[capy3-second-pass-twelve-thirteen-fourteen]]) found *systems described and not populated*.
This one found **one lighting bug that had been eating the subject of a whole chapter**, and
then the same modelling mistake five times in two files.

## THE WATER SHEET WAS SHADOWING THE ENTIRE REEF

`registerShadowTarget(root)` is the last line of every biome build and systems.js answers it
with `traverse(n => { if (n.isMesh) n.castShadow = true })` — so every `castShadow = false`
written above it is reverted. Marrakech and the Drift each paid for this once. **Neither of
these two had the traverse, and in Palawan the consequence was visible in every underwater
frame the chapter has ever produced:** `palWaterMesh` is 13,024 triangles of transparent,
DoubleSide plane lying over the whole bay at y = 0, and **a shadow map does not care about
transparency**. The reef, the drop-off, the coral, the caustic net — the half of that chapter
the chapter is *about* — sat in one flat unbroken shadow, and the net was being drawn on top
of it. 116,663 of 117,867 triangles were in the shadow pass.

Cappadocia's version is funnier and just as visible: **the painted balloon shadows were being
fed to the shadow map.** Those discs exist precisely because the real shadow camera is a
44-unit box that cannot reach a balloon at a hundred metres — and each of them had a second,
harder, darker shadow of itself underneath. Plus the 900 m sky dome, the sun, its halo, the
cirrus, the dust plume and the wind wisps.

`palNoShadowOnGhosts` / `gorNoShadowOnGhosts`, the same two rules the other two files use
(anything see-through, plus a `userData.noShadow` flag for lights and for things too small and
far to resolve). Ghost-caster triangles: **27,150 → 0** and **3,800 → 0**.

## THE SHAPE THIS PASS KEPT FINDING: A HOLE IS NOT A DARK RECTANGLE

Five instances across the two files, all the same mistake — an opening drawn as a flat dark
box placed AT the face radius, so half of it stands out of the rock and it reads as a black
brick glued on:

- **The dovecote cliff.** Four hundred holes on a dead-regular grid in one flat plane, with
  the perch ledges drawn at `C.x + 3.6` on a face at `C.x + 4.0` — **forty centimetres inside
  the rock, all of them, invisible** — and a single 26 m whitewash panel coplanar with the
  holes. It photographed as an office block. The face is a FUNCTION now (`faceX(z)`), and the
  holes, lips, perches, paint, the rope and all 260 birds are placed against it. Courses that
  sag across each bay, not a grid; piers between seven bays; a cornice at half the rib spacing
  because *a brink is a line and not a staircase*; talus at the foot; and a rope with a
  bosun's plank and a guano basket on it, because the chapter's own local says his grandfather
  cut forty of those holes on a rope at night and there was no rope.
- **The fairy chimneys' windows** and **the town's rock-cut fronts**: same fix, three pieces
  each — recess (the dark is DEPTH), a pale cut reveal, a sill.
- **Palawan's karst.** Forty-three towers of stacked flat-faced boxes. A karst tower leans OUT
  as it goes up (tapers, wider at the head of each block than the foot), is FLUTED, is
  STREAKED black from the top down, and has figs growing sideways out of it halfway up with
  nothing underneath — that last one is what tells you the wall is vertical.
- **The coral heads.** A table coral is a trunk that FLARES into its own plate; at a 20 cm stem
  under a 3 m plate the stem is not there at six metres and the plate floats. A sea fan is a
  fan (one taper), not two stacked boxes.

## GROUND DETAIL WITH NO EDGE, FOR THE FIFTH AND SIXTH TIME

Göreme's plaza was **sixty-two cobble boxes on 2.4 m centres over a 13 m square** — three
metres of bare dirt between each pair, which reads as dropped paper. Five hundred jittered
flat facets over the whole square (two triangles each, fraying at the rim) is a pavement.

And I made the mistake myself on the way: the valley floor got wash channels and bare patches
as quads, and the rendered frame showed forty pale RECTANGLES lying on smooth sand. **Painted
into the ground mesh's vertex colours instead** — and a braided channel wants a RIDGED noise
through a narrow threshold, which gives a network of lines rather than a field of blobs. Only
what you would trip over is geometry.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **Cappadocia's tether balloon flew away and left its collider behind.** `gorBuildTether`
  discarded the body it made, so cutting the crown line left an invisible 11 × 5 × 7.4 m wall
  standing in the middle of the launch field for the rest of the chapter. It is lifted with the
  bag now (lifted, not removed, so hopping on at the moment it lets go rides it).
- **Nothing in either chapter had a distance law.** The bell mare rang at full volume from
  anywhere in a two-hundred-metre valley, every 2.4 s, for as long as she ran. `gorHeard` /
  `palHeard`, squared ramp, and it is a GATE as much as a gain — 0 means the sound is not made.
- **The rim light's rotation is `-atan2(dy, dz)`.** `Rx(t)` maps +z to `(0, -sin t, cos t)`, so
  laying a z-aligned bar along `(0, dy, dz)` takes MINUS the arctangent. Written as
  `atan2(dy,dz) - π/2` every segment stands upright and a line of light along a crest renders
  as a row of fence pickets. Only a screenshot finds it — same class as Manly's rock pools.
  And a rim hung off spurs scattered ±9 m in x leaves gaps: **the crest is its own centreline.**
- **One translucent shell is a solid.** Palawan's god rays were single 7-gon cones and
  photographed as panes of glass in the chapter's best shot; five shells on a squared ramp,
  fourteen sides at the core and seven at the rim. The sun's halo in Göreme was one sphere and
  drew a hard pale octagon — four shells. Third and fourth time this note has been paid for.
- **A shaft has to LAND.** An additive disc on the floor under each one, breathing on its own
  clock, or the cone is hanging in a room.
- **A gore is a panel OF the bag, not a batten laid across it.** Ribs stood proud of the
  half-inflated envelopes with square corners and read as packing crates; slicing the ellipsoid
  itself into seven overlapping slices of alternating fabric, each one's half-height taken off
  the parent's own profile, gives panels that curve with it. The slices have to OVERLAP or it
  is a string of sausages.
- **`mat()` caches by colour**, so `palFishMesh`'s material had to be `.clone()`d before the
  bloom could write an emissive onto it — [[capy3-clone-eats-the-shader]], again.
- Göreme's props scatter still had a **`sombrero`** in it, which is the Jemaa el-Fnaa mistake;
  Palawan's had a **traffic cone**, forty kilometres from the nearest road.
- **A sitting bird has its wings folded**, and one uniform scale cannot say so — the x axis is
  the span, so squeezing it to a third tucks them. Four hundred perched pigeons read as moths
  without it.

## WHAT WAS ADDED

Palawan: **the free-diving boy** off the jetty on a 26 s loop (the chapter's verb, demonstrated
rather than toasted — and a ten-second breath-hold from a child, in the chapter about an animal
that can do five minutes); **terns** working the bait ball at fifteen metres, which is how
anybody has ever found fish and is the only thing that makes a marquee 6.5 m underwater legible
from the beach; **a blue-spotted ray** buried on the sand that goes in a cloud of it; **440
small animals** on the reef (anemones that sway on one surge, with clownfish that duck INTO
them at the wheek — the one animal in the game whose answer to being shouted at is to stay);
**swiftlets** in the cathedral; **marine snow** (the bloom's own 240 motes, a fifth the size and
a fifteenth the brightness when it is not blooming, so the marquee is the water you were
already swimming through turning on). Audio: **a heartbeat under a third of a tank** and a
**gasp on surfacing** — the chapter's central resource, in the ears rather than in the corner of
the HUD — and **snapping shrimp**, which is the actual sound of a reef and exists nowhere above
the waterline.

Cappadocia: **all twenty-six decor balloons burn** on their own clocks, lighting from the inside
and roaring at the distance's volume, which is the photograph of that valley and is also how you
read a wind you are not in yet; **the crest of the east ridge lights before the disc clears it**
(a rim light only exists while the source is BEHIND the thing); **the tea house has a front**
(canopy, board, lit window, washing on the roof); **the bulbs go out over the sunrise**; the
wisps are tinted by LAYER (the chapter's whole UI, and it was four layers of identical grey);
**the higher you go the quieter the ground gets**, which is the one thing everybody says about
a balloon; and both chapters' locals now **change what they say** when a task lands under them.

## NUMBERS

Palawan **117,867 → 128,510** (ceiling 130k; ~22,000 reclaimed and respent), Cappadocia
**82,776 → 116,170**. Bodies 78 → 79 and **113 → 77**. Solidity residue: Cappadocia 146 → 41,
Palawan's beach 179 → 26. Ghost shadow casters 27,150 / 3,800 → **0 / 0**. `audit-tasks` 0
blockers over 199 tasks; 3,200-frame random-input fuzz clean in both (no NaN, no void falls,
`state.lastError` null); a 100 s real-clock soak with audio unlocked reports **zero console
messages**; frame time **16.6–16.7 ms median / 18.0 p95** in Palawan, Cappadocia and untouched
Pasto alike, so the p95 is the machine.

Related: [[capy3-second-pass-twelve-thirteen-fourteen]], [[capy3-dive-and-balloon]],
[[capy3-third-pass-eight-nine]], [[capy3-solid-or-drawn]], [[capy3-the-picture]],
[[capy3-the-locals]], [[capy3-clone-eats-the-shader]], [[headless-qa-harness]],
[[capy3-props-in-every-world]]
