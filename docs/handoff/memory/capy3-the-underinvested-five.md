---
name: capy3-the-underinvested-five
description: "Lifting the five least-developed capy3 chapters (Drift, Iceland, Quay, Göreme, Sahara) to the 205k ceiling: the one flag that was wrong in four files at once, and the flat-plate trap found five more times"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2c097897-0dd4-4e7e-b93a-b06dad14ccfe
  modified: 2026-08-23T06:12:54.859Z
---

Done 23 Aug 2026, against the measured asset census in `qa/BRIEF-lift-5-biomes.md`.
Five chapters, one at a time: the Drift (9), Iceland (7), Circular Quay (3),
Göreme (13) and the Sahara (8).

## THE ONE FLAG THAT WAS WRONG IN FOUR FILES AT ONCE

`sysEnableShadows` is `traverse(n => { if (n.isMesh) n.castShadow = true })`, and
**`THREE.InstancedMesh` extends `Mesh`**, so `isMesh` is true on every batch in
every biome. Each file then has a `xxxNoShadowOnGhosts` that puts it back — but
in drift.js, iceland.js and quay.js that function recognised a ghost **by its
MATERIAL** (transparent / additive / no depth write / no fog) and by nothing
else. So:

> **An OPAQUE mesh that says `castShadow = false` has been casting anyway,
> everywhere, since the day it was written.**

Measured: 172 fern quads and 78 blossom octahedra in the Drift; the entire
150-bird puffin colony in Iceland — 27,600 triangles, 23 % of that chapter and
the largest single object in it, on a cliff over the sea in a world lit by a sun
that never rises. Both call sites had said `false` for their whole lives.

goreme.js and sahara.js already read `userData.noShadow` and were correct. That
is the honest channel: **the flag, not a material sniff**. Every `xxxInstance`
now stamps `userData.noShadow` when `cast` is false, and the three traverses now
check it first.

That single fix paid for the whole density pass. Casting proportions went
**72→21 %, 84→49 %, 65→39 %, 82→54 %, 91→59 %** while triangles went up ~2×.

## THE FLAT-PLATE TRAP, FIVE MORE TIMES

The most repeated mistake in this codebase, now at eleven confirmed instances.
This camera looks down about **0.7 rad**, so anything held near horizontal shows
its whole top face. Found live in:

- **Iceland's moss**: `cyl6`, `rand(1.4, 3.6)` across by 0.32 tall — two hundred
  green playing cards, in the one green thing in the chapter.
- **The Drift's ferns**: pitched **0.34 rad**, four per tree, on every island the
  player walks. 0.62 rad is the number the palm-frond note gave, and 0.62 is
  **still inside a tenth of a radian of face-on to this camera** — that number is
  right for a LEAF (a thing you see the top of) and wrong for a BLADE (a thing
  you see the edge of). Blades want ~1.25–1.30.
- **Göreme's vines**: 1.05 wide by 0.44 tall — a flat hexagon in the dirt.
- **Göreme's terrace walls**, first cut: two courses of 0.30 on a 0.9 m
  footprint is a twenty-metre plank laid on the ground. Three courses, 0.58
  through, every stone rotated a little.
- **The Sahara's fallen fronds**, avoided by rolling them ~1 rad onto their edge.

And a NEW form of it: **a sphere with four rings has a flat cap.**
`SphereGeometry(0.5, 6, 4)` squashed to 0.62 of its height photographs as a
hexagonal plate — which is how a moss *cushion*, drawn specifically to avoid the
disc failure, arrived at the same picture from the other direction. Use the
nudged icosahedron (`iceG.rock`, 20 triangles, no flat face anywhere) for any
lump that is meant to be a dome.

## FOUR MORE MEASURED DEFECTS WORTH REMEMBERING

- **A head does not cast its own shadow.** The Sahara's crowd is 174 people at
  108 triangles a body and 72 a head, all casting, under a sun very nearly
  overhead — so 12,528 triangles were drawn a second time to lay a shadow
  *inside* the one the shoulders were already laying. Off, and the frame is
  bit-for-bit identical.
- **4,320 palm fronds casting is not dappled shade.** The shadow map cannot
  resolve a 40 cm frond at that range, so every palm laid a two-metre black
  STARFISH on the sand and thirty overlapping read as damage. Trunks and
  leaf-base crowns still cast; the grove keeps its shade and loses the noise.
- **A camera eight metres up meets a nine-and-a-half-metre canopy.** The Drift's
  Crown — where the chapter ENDS, at a nine-metre lantern with a bench beside it
  — had a 13 m tree exclusion and 12.9 m trees. Same note chapter 16's doline
  got. 24 m of clearing, and the wood on the two islands that are a SHOT is
  capped below the lens.
- **Scatter recycling must respect the player's furniture — including the
  ground.** A 210-piece airfield wrapping on an 80 m box around the animal was
  put down *inside* islands. The wind-step is now REFUSED rather than the rock
  teleported (a stone that eddies at a rim reads as weather; a stone that
  vanishes reads as a bug), and the wrap tests the far side before taking it.

## WHAT ACTUALLY FIXES A LOW INSTANCE COUNT

Iceland was the worst number in the census: **7 instances per 1,000 m² against a
median of 46**, over 82,000 m² the player walks the whole of. Two things were
wrong and only one of them was the count.

1. **Sample INSIDE the thing you are looking for, and RETRY.** The first cut took
   one sample per clump and dropped the clump if the ground was the wrong kind.
   A band is a rectangle and a ground is a stripe, so four grounds in five threw
   away most of their budget: 554 planted against a budget of 3,000. Eight
   attempts at a centre fixed it in one line.
2. **Many small clumps, not a few big ones.** Forty clumps of up to twenty-two
   over a fifty-metre band is six dense islands and forty metres of bare green
   between them — photographed standing in the lava field, an empty plane with
   scenery in one corner. Three times as many clumps of a third the size covers
   the same budget and covers the GROUND.

Final density, instances per 1,000 m²: Drift 28.8→222.6, **Iceland 7.0→58.9**,
Quay 38.9→106.3, Göreme 15.0→123.7, Sahara 83.4→138.4.

**And scatter is batched PER CELL, on a grid.** That is a culling decision, not
bookkeeping: one instanced mesh spanning four hundred metres is inside the
frustum from everywhere, so the world pays every frame for moss it cannot see.
It is also, incidentally, most of the "draw objects" target.

## WHAT WENT IN

- **Drift**: cloud banks (opaque — see below), a 210-piece airfield of rock and
  turf that never landed, root curtains under every island, a third rank of
  horizon islets, drystone walls, ground cover, column stone-circles and
  spirals, **six travellers who are all waiting for the breath to come round**
  (the wind-reader at the arch rewrites her own lines off the live `driWindAng`
  and the vane beside her turns), and the ending: after the lantern takes, the
  twenty-six islands on the horizon light their own lamps one at a time,
  furthest first, over twenty-two seconds.
- **Iceland**: moss cushions, lupin stands, tussock, sinter crust, erratics,
  driftwood, ablation stones; **vörður** (the cairn line from the last house to
  the glacier, which is the most useful object that could be added to that
  chapter), turf houses, fish-drying racks, a basalt colonnade, three flocks of
  sheep that shuffle out of your way, and two more locals with the things that
  are new.
- **Quay**: dry sclerophyll forest on all thirteen headlands, the apron dressed
  (date palms, benches, bins, timetable pylons, the chain line, the concourse
  awning), Manly's Norfolk pines, four more grabbable props (6→10), and a
  mini-wow that is not a task — **eighteen cockatoos off a headland** when the
  boat passes close with way on, or when you shout at them.
- **Göreme**: talus fans off every chimney (the chimney positions had never been
  recorded outside `gorBuildValley`, which is *why* the floor was bare), vines
  and terrace walls through Love Valley, poplars, pumpkins, scrub; three more
  locals at the three places the chapter goes that had nobody.
- **Sahara**: the brief asked for VARIETY, not more scatter. Camel-thorn, dead
  acacia, nomad windbreaks, bone, gravel lag, tyre tracks, barchan horns, a
  telegraph line; the palmeraie's **seguia** and pisé plot walls and drying
  racks; a half-buried **ksar** as the one landmark in the middle of the plain;
  the **khettara** — thirteen shaft mouths with spoil rings, dead straight
  across the hamada, which is the LINE that a world you cross needs; four wall
  towers, an olive grove, and six trades in the souk instead of thirty-two
  identical booths.

Audio in all five, positional the only way this engine does it (the biome
computes the volume — the Sahara rule): the turn of the breath, the columns and
the camps in the Drift; sheep, racks and sea-on-basalt in Iceland; the terminal
and **cicadas on the headlands** in the Quay; the dovecote and the poplars in
Göreme (multiplied by the same `sky` fall-off the balloon ambience uses).

## TWO THINGS THAT MEASURED WRONG BEFORE THEY MEASURED RIGHT

- **A cloud is not a window.** The Drift's banks were one merged mesh of ~280
  squashed spheres in a transparent material with `depthWrite` off. Three sorts
  transparency PER OBJECT, and that is one object — so photographed from the
  Crown looking north the weather was half a dozen enormous washed-out
  parallelograms lying across the frame with the islands showing through.
  Opaque and flat-shaded it sorts itself for free.
- **A cumulus is wider than it is tall.** 25 m of height with 5–8 spheres up it
  puts 3–5 m between centres against radii tapering 9→4; they stop overlapping
  half way up and you photograph a ZIGGURAT of hexagonal plates. Half the
  height, twice the spread, spacing always under the local radius.

## MEASURED AFTER (before → after)

| | tris | cast % | draw objs | instances | geoms | locals | props |
|---|---|---|---|---|---|---|---|
| Drift | 82,976 → **203,714** | 72→21 | 125→214 | 1,508→11,754 | 98→178 | 2→8 | 9 |
| Iceland | 121,418 → **198,648** | 84→49 | 147→252 | 570→4,824 | 126→161 | 6→8 | 10 |
| Quay | 83,189 → **200,905** | 65→39 | 232→247 | 3,118→8,533 | 178→184 | 10 | 6→10 |
| Göreme | 115,338 → **205,350** | 82→54 | 150→335 | 588→4,844 | 129→168 | 7→10 | 11 |
| Sahara | 122,788 → **195,394** | 91→59 | 192→336 | 7,850→13,032 | 168→177 | 10 | 11 |

**All seventeen chapters still in the frame-time band**: median 16.5–16.8 ms,
p95 17.4–19.7, one draw call each. `qa/fuzz.js` clean everywhere (no NaN, no
void falls, no console errors, no `lastError`). `qa/kine.js` maxTele 0 on four
of the five, 0.33 on Iceland's snowcat, no bodies out of world.
**`qa/audit-solid.js`: Iceland 6 → 0.** `node qa/audit-tasks.mjs` 0 blockers
over 199 tasks. Pointers unchanged. `qa/audit-locals.js`: all 44 locals across
the five chapters speak.

**Missed**: the draw-object targets on Iceland (252 v 328), the Quay (247 v 321)
and the Sahara (336 v 376). Those numbers come from the 4.00-objects-per-1,000 m²
median times a large land area, and the honest way to reach them in a world whose
buildings are deliberately merged is more per-cell batching, which was taken as
far as it earns its keep.

**And the scatter is seeded from `rand()` at BUILD time**, so every page load
builds a different world and the triangle count moves ±10 k between runs. Any
number in this file is one measurement, not a constant.

Related: [[capy3-world-size-audit]], [[capy3-solid-or-drawn]], [[capy3-the-picture]],
[[capy3-fourth-pass-sixteen-seventeen]], [[capy3-the-locals]], [[headless-qa-harness]],
[[capy3-quay-is-two-places]], [[capy3-drift-air-and-gravity]]
