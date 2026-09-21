---
name: capy3-third-pass-fifteen-sixteen-seventeen
description: "The third pass over capy3 chapters 15, 16 and 17: a ceremony that happened behind the camera, a chapter whose arrival was a lawn, and the wrap that threw every floe out of the world"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8a002496-1801-4896-ab76-95fe7c5e5867
  modified: 2026-08-21T07:52:34.234Z
---

Done 21 Aug 2026, a third pass over the Pantanal (15), Sơn Đoòng (16) and
Antarctica (17) — six weeks after [[capy3-second-pass-fifteen-sixteen-seventeen]]
found "things published and never consumed". This one was different again.
That pass fixed the WIRING; everything worked. This pass is about **what is
actually in the frame**, and the diagnostic is not a grep — it is a screenshot
taken from the camera the moment is played on.

## The pattern: a thing that works and cannot be seen

Three of the six worst findings are moments that were correctly implemented,
correctly triggered, correctly timed — and outside the frustum.

**THE EGRETS OF THE CROSSING WERE FLOWN BEHIND THE CAMERA.** Chapter 15's
marquee is swum southward down the river; the flight was launched at
`panRIVER.z1 + 16`, sixteen metres NORTH of the bank you go in at, so for
eleven seconds it was behind the lens every single time. And moving it south
would not have fixed it either: **the rig is 7.6 m up at 45 degrees, so the top
of the frame is about 20 degrees below horizontal — anything four metres in the
air is out of shot the moment it is more than ten metres ahead. A flight of
birds across the sky is not a thing this camera can photograph at all.** The
answer was to stop flying them past: thirteen egrets STAND in the shallows down
the length of the crossing and go up one at a time as the animal swims at them,
each about four metres ahead, dead centre. The flush is the picture, and the
flush is a thing the player caused.

Same family: chapter 16's shaft of daylight had `alpha = 0.025` at the floor,
which is below the threshold of anything, so standing in the marquee there was
no column to stand in; and chapter 17's snow petrels — put in expressly "to
give the glacier a SIZE" — were flown at an ABSOLUTE height of 9–26 m round a
ring that reaches x = −164, where the ice cap is thirty-three metres thick.
Measured: **seven of the twenty-six were inside the glacier at any moment.**

## THE ARRIVAL IS A SHOT AND IT HAD NOT BEEN LOOKED AT

Sơn Đoòng's first frame was thirty-four trees and sixty ferns over 4 600 m² —
one tree per 135 m². Photographed from the spawn it is **a flat green field the
size of the screen with three cones on it**. The chapter's whole argument is the
contrast between the last green for two hundred metres and the dark; the green
was a lawn.

Ninety-six trees at four storeys now, with buttresses, 240 understory pieces,
fallen logs, boulders and lianas off the arch — and two things that are not
taste:

1. **The camera is only ten metres up, so a crown above fifteen metres puts a
   flat dark slab across the frame every time you walk under it.** One emergent
   in fourteen; the density is bought in the two storeys BELOW the lens.
2. **A wood with no way through it is a wall.** A winding corridor from the
   spawn to the mouth that nothing tall grows in — which is both the path and
   the reason the black hole in the cliff is the first thing you see.

Antarctica had the same disease with no trees to hide it: three huts, a mast and
four thousand penguins standing on two hundred thousand square metres of
undisturbed plaster. Outcrop, sastrugi and a strandline of stranded growlers,
plus a hand-placed **signpost** at the landing (the second most Antarctic object
there is) and an upturned Zodiac.

## Two rules learnt about scattering into a mostly-empty world

- **SAMPLE INSIDE THE PLACES THERE IS LAND.** Ninety-five per cent of chapter 17
  is sea; rejection-sampling the bounding box put one rock every 340 m² of the
  ground anybody stands on, which is one and a bit in the frame. Sampling the
  three domes directly is one per 45 m².
- **A MOSAIC FIELD MUST HAVE A PERIOD SHORTER THAN THE FRAME.** The first cut of
  the cave's forest-floor colour ran at 0.041 rad/m — a hundred and fifty metres
  of period over a clearing thirty metres across — so it was very nearly
  constant everywhere the camera ever is and drew nothing at all.

And the corollary, which cost two rounds: **a linear `clamp` ramp has a CORNER.**
`clamp(-mos * 1.4, 0, 1)` across the campo drew a forty-metre band of near-black
green with a hard straight edge, which reads as the shadow of something that is
not there. `smoothstep` at half the weight.

## THE BUG THAT COST THE CHAPTER EVERY FLOE IT HAS

`qa/kine.js` found it in two seconds and nothing else would have: a pan sitting
at **z = +553**, four hundred and thirty metres past the northern edge of the
world.

The floe wrap teleports the body 480 m north when it reaches the shelf. The next
line differenced the NEW target against the OLD one — the carrier rule, correctly
applied — and handed the body `482 / dt`, **twenty-nine thousand metres a
second**, which cannon integrated for one step. So a pan that reached the shelf
was moved to the top of the bay and then flung another 480 m straight out of the
map, where it stopped for the rest of the session.

**The wrap is the one frame where "difference against the previous target" is
wrong, because there IS no previous target** — it is a new object in a new place,
standing still. Zero the velocity, write both targets, `continue`.

It is invisible for four minutes and then it is the whole chapter: the leopard
seal lives on floe three, and 'haul out on a floe' and 'ride one down the
channel' are both on that chain. (cave.js's log wrap already did this correctly —
it overwrites the velocity with zero after setting it. Check every wrap.)

A second one in the same function: the eddy behind the berg creeps at 10 cm/s
and the wrap was at −452, so an empty pan spent three minutes in it — measured,
**ten of the fifteen were stacked between −430 and −450 within two minutes** and
the chain of stepping stones the haul-out is built on had become a car park.
Recycle at −436 unless somebody is on it.

## Two things that were populated but not ARRANGED

- **Sixty penguins and eighty-two nests were scattered independently**, so no
  bird in the rookery was on a nest and no nest had a bird. A gentoo colony is
  nests at one neck-length with a bird on every one — that is the entire shape
  of it. The nest positions are kept and handed to the penguin builder now, the
  ring is seven pebbles rather than two discs, and a quarter of the birds
  standing between the nests are **chicks** (one `instanceColor` and a scale).
- **The cowbird did not ride cattle.** Seventeen nelore went in in the second
  pass and the bird named after them went on hopping about on the mud. It
  perches on the nearest one now — which also fixed a real bug: its perch was
  `clamp(p.x + rand(-14, 14))` with no probe, so a player standing still while
  SWIMMING sent it to a point in open water where it sat two metres under the
  surface, and `game.pantanal.cowbird()` is a hint-arrow target.

## Bugs, in the order they cost the most

- The floe wrap (above).
- **Twenty of the forty cave crickets were standing in the river.** `cavRIVER_X +
  rand(-26, 26)` with no test and a channel thirty metres wide, under a comment
  reading "on the sand beside the river". And the hop was an unbounded random
  walk — 8.5 m mean drift over six minutes, same family as the Pantanal herd.
  Home + a pull that scales with distance: 1.8 m mean now.
- **Stalactites through the floor.** Beyond the Great Wall the floor stands at
  7–12.5 m and the roof comes down to 16 near the exit, so an eleven-metre
  stalactite reached SEVEN AND A HALF METRES UNDERGROUND. The solidity probe
  found them as un-collided rock within reach of forty walkable squares, all
  past z = −150. Clamp the length to the room.
- **A 386-metre curtain across the cave mouth.** `cavRoofH` answers 400 outside
  and the roof grid runs three metres past it, so the last row of quads went
  from 14 m to 400 in one step, DoubleSide, full width. It looks like a mountain
  from outside, which is why nobody caught it.
- **The otters' telling-off was `panOtterT % 1.6 < dt`** — a window on a clock
  that advances by dt, the exact shape that made the Antarctic skua cry nine
  times per dive — and it never stopped. A volley of four and then a quiet
  reminder on a slow clock, re-armed only when you are properly clear.
- The Weddell seal and the leopard seal were both holograms. The Weddell gets a
  static box; the leopard **cannot**, because its floe is a kinematic carrier —
  so it is a second shape on the pan's own body, roughly ROUND, because the
  animal turns to watch you and the pan does not.

## Density is the whole of "visual juice", and it is affordable

Every one of the biggest wins was a count.

- **The pack: 460 → 1400.** 460 lumps over the 230 000 m² of sea that carries ice
  is one every 500 m²; measured in a 200 m box across the middle of the channel
  there were seventy-two, so full ahead into "half a metre of brash" put three
  white boxes past the camera in nine seconds. It is twelve triangles apiece.
  Paid for by dropping the sea sheet from 84×118 to 66×92 — **every term that
  sheet carries is long** (the swell 200 m, the ice field 170, the lead 44
  across), so 6.5 m cells hold all of it exactly and nothing looks different.
- **The glow-worms: a sphere is 36 triangles and a box is 12.** At 14 cm in the
  dark there is no silhouette to get wrong. 420 spheres → 960 boxes, in
  CONSTELLATIONS rather than a haze: a chain of clusters following the water is
  a thing to follow; an even spray of dots carries no information.
- **The dust in the shaft.** You cannot see air, only what is floating in it —
  260 motes at five centimetres (the first cut at 0.10 scaled to 2.2
  photographed as squares of white paper hanging in a wood). They also stir when
  you wheek in the doline, which is the only thing in the chapter that says the
  echo is a pressure wave.
- Camalote coming down the Pantanal river, and a jam of it aground on the
  upstream face of the sandbar. A river with nothing on it has no speed, no
  scale and no direction — and the marquee is taken from the middle of it.

Landed at **Pantanal 170 k / Cave 88 k / Antarctica 118 k** triangles, all at
16.6–16.9 ms median and 19–21 p95, identical to Sydney and Pasto on the same
run. Bodies 72 / 148 / 66 (Venice 153 and Kyoto 151 are the game's high-water
marks, so the cave is inside normal).

## Measured after

`qa/fuzz.js` clean on all three (no NaN, no void falls, no console errors, no
`lastError`); a 17-chapter smoke clean. Solidity **5 / 3 / 2** hits (the cave was
40 before the stalactite and breakdown fixes). `qa/audit-tasks.mjs` 0 blockers
over 199 tasks. `qa/kine.js` zero teleports and, over 22 sim-minutes, zero floes
outside the world. Locals unchanged at 7 / 5 / 6. Verified by playthrough: the
caiman still ticks at +0.66, the haul-out still floats you at +0.68 and does not
swim, the leopard seal now stops you 1.72 m from its centre, the pod still forms
up and gives back 14.3 m/s against a 12.6 VMAX, and the fazenda's windows come on
when the herd goes in the river.

Related: [[capy3-second-pass-fifteen-sixteen-seventeen]], [[capy3-the-herd]],
[[capy3-the-dark]], [[capy3-the-pack-and-the-pod]], [[capy3-world-size-audit]],
[[capy3-visibility-metrics]], [[capy3-solid-or-drawn]], [[headless-qa-harness]]
