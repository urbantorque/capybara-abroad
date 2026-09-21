---
name: capy3-fourth-pass-fourteen-fifteen
description: "The pass over capy3 chapters 14 and 15 on 23 Aug 2026: a headline task that could not be completed, a marquee frame with nothing in it, and the one API no chapter had ever called"
metadata: 
  node_type: memory
  type: project
  originSessionId: f269e55a-7738-498c-ad19-3d3e648097a7
  modified: 2026-08-22T22:16:13.183Z
---

Done 23 Aug 2026 over Manly (14) and the Pantanal (15). Manly had had one deep
pass ([[capy3-second-pass-twelve-thirteen-fourteen]]); the Pantanal had had two.
The shape of this one was different again from all of them.

## THE HEADLINE TASK OF CHAPTER 14 COULD NOT BE COMPLETED

`move-flags` — *"Move the flags, and take the beach with them"*, the chapter's
name, the largest consequence any single button press has in this game — tested
**"twenty of the twenty-two bathers are within twelve metres of the flag point"**.
That was written when every bather stood on dry sand round the poles. The second
pass then put two thirds of them IN THE WATER (1.5–13 m seaward of a waterline at
z 24) while the flag drop clamps the poles to z 26–34. **Measured at rest: ten of
twenty-two are inside twelve metres and the other twelve never can be.** Silent,
no warning, and `qa/audit-tasks.mjs` cannot see it because the id is completed
somewhere in the file.

**The test has to be a question about each actor's OWN target**, not about the
landmark: every bather is within 1.5 m of where the new flags put it. Verified by
playthrough — grab, carry 29 m, drop, and it fires.

**A landmark getter returns a shared scratch and it broke the TEST, not the game.**
`game.manly.flags()` hands back `manV3b`; the probe held the reference across 90
ticks and the hint arrow rewrote it, so the walk target moved 19 m and the whole
first three runs "failed". Third time this codebase has paid for it. Snapshot on
read — in probes as well as in code.

## `game.say()` HAS NEVER BEEN CALLED BY ANY CHAPTER

npc.js has published `say(x, y, z, text)` since the locals were written and
main.js documents it as "biomes call game.say() from their update". `grep -l
"game.say(" src/*.js` returns **main.js and nothing else**. Same class as the
eleven Pantanal landmark getters and `dusk()`: a published API with no consumer.

It is the missing half of the locals. `lines` is a shuffle bag and cannot know
anything; `say` is a line about what is happening NOW, from a point. Eleven of
them now across the two chapters — the lifeguard shouting about the rip you are
in, the road crew about the plank you are standing over, the cattleman counting
your followers — behind one per-key cooldown and one shared `sayCool` so there is
one voice at a time. Bubbles are real DOM in `#hud`; verified by innerText.

## A MARQUEE FRAME WITH NOTHING IN THE MIDDLE DISTANCE

Chapter 15's crossing is swum with the lens at the waterline. Photographed from
that camera the frame was **one flat olive plane, edge to edge**, plus thirteen
egrets lying on the water like paper aeroplanes.

- **A wading bird cannot stand on 4.5 m of channel.** All thirteen were placed on
  the river's own z line — measured bed under every one: **−4.20 m** — and drawn
  with the FLIGHT model squeezed to 48 % in x. You cannot get a standing bird out
  of a flying one with a scale (the gentoo-pitch lesson). Its own 60-triangle
  model: vertical body, two long legs, S-neck folded back, wings closed.
- **The fix for the birds was the fix for the emptiness.** Eleven SNAGS down the
  crossing — a dark half-submerged trunk, a broken limb, a jam of hyacinth on its
  upstream face — four metres either side of the swim line so the way through
  stays open. The egrets stand on those, which is where an egret on that river
  actually is.
- A snag shows a hand's breadth of itself. The first cut lay 7 m cylinders flat
  on the surface in `panDead` (0xb6a894, three stops brighter than the river):
  eleven pale scaffold planks floating in the marquee.
- **The flood is a MIRROR and it never changed at sundown.** `panDusk` ran the
  sky, the grade, the lilies, the fireflies and the fazenda's windows; the forty
  thousand square metres of water the chapter is about stayed four-in-the-
  afternoon olive. One line — tint the sheet material's `.color` toward
  `panSkyDusk` at 0.42 — and it needs `grainOwn` or Venice's tide goes orange too.

## THE GRASS LOOP NEVER GOT PAST ITS OWN CAP

`for (seed = 0; seed < N && n < N; seed++)` with 3–7 tufts a seed does not make N
seeds — the seed counter and the INSTANCE counter are the same number, so it
stopped at about N/4. The comment said "nine hundred seeds"; the build laid ~350,
all `rand()` over the whole map. Measured **34–69 tufts per 1600 m²** — one every
25–45 m². The campo was a lawn again.

Two changes, and the second pays for the first:

1. **A blade of grass is TWO triangles, not twelve.** The function's own note
   already said "a blade is a box whose two narrow faces nobody can see" and then
   went on drawing the box: four of the six faces of a 0.04 × 0.16 blade are four
   centimetres wide and edge-on from every camera in this game. A quad on a
   `DoubleSide` material is the same picture for a sixth of the cost. Same for the
   reeds (4.5 cm square section). `panVCL()` is the leaf material; nothing that is
   not a leaf may use it.
2. **Seeds off a JITTERED GRID**, so they cannot pile up in one corner and cannot
   starve another. 1 250 tufts → **4 600**, for less than the boxes cost.

Also: the grass height cap was 2.2 m against a fazenda hill that runs to 3.1, so
the one piece of high ground anybody walks up — house, corral, mango tree — stood
on bare plaster.

## BUGS, IN THE ORDER THEY COST THE MOST

- `move-flags` (above).
- **Thirty gulls on seven ledges.** `((i * 3) % (manPerch.length / 3)) * 3` walks
  a 21-entry list in steps of three: gcd(3,21) = 3, so only indices 0,3,6,9,12,15,18
  are reachable. Four or five birds stacked in exactly the same place on the first
  parapet corner of each shop, and fourteen recorded perches never used once.
  `i % n` is the whole fix (plus an offset for the second lap, or you get doubles).
- **The sandbar was 22 of its 26 metres under water.** `lerp(0.75, bed, smooth(sd/r))`
  from the middle out puts the top above the waterline only where
  smooth(sd/r) < 0.75/4.95 — sd < 3.3 m of a 13 m feature — while the sand COLOUR
  is painted over the whole ellipse (that test is on sd alone, not on height). And
  the eight jacarés hauled out on it were dropped by `rand(-11,11) × rand(-4,4)`:
  eight 3.4 m animals in twice their own area, floating flat in a heap. It is a
  PLATEAU now (flat to 0.55 r, the drop in the outer 45 %) and they are a LINE
  along the two long edges, evenly spaced, all pointing much the same way.
  Populated is not arranged.
- **Reeds rooted three and a half metres under the river.** `panRIVER.z1 + 0.4`
  looks like the bank and is not: the river's blend runs to 1.6 half-widths. The
  wall of reeds that gives the marquee its SIDES was mostly submerged. Walk out
  from the edge until the bed comes up into the band a reed grows in.
- **Cattle on the causeway.** The campo retry tested the water and nothing else,
  and a nelore is DRAWN at `panBedH` — the ground the embankment stands on, 1.25 m
  under the deck. A white loaf sunk to the shoulders in the road, in the opening
  frame of the chapter. Penned ones could also walk out: seeded up to 10.5 m from
  the middle of a 13 m ring and then stepping 8.5 m from where they were seeded.
- **The shark-net buoys did not float** — seven spheres pinned at y = 0.25 in the
  one chapter whose water is a FUNCTION (measured surface there: 0.37, amplitude
  ~1.5 m). They are the only object out the back and the only scale the open water
  has. Own instanced mesh, moored, leaning into the face.
- **The surf-club ramp was a ladder** — seven treads at 0.72 m of rise against an
  animal that steps 0.40, so the "flat roof you can see the whole beach from" cost
  seven hops. Fourteen at 0.36.
- **The zebra crossing was painted the colour of the road** (`manPromenade` on
  `manPromenade`). Nine faint shadows.

## THE ARRIVAL, AND A CROWN BELOW THE LENS

Manly's spawn frame was **two black cones with a capybara between them**. Two
causes, both the same family as the cave's arrival:

1. The Norfolk pines ran `x = -56 + i * 11.2`, which puts a tree at **exactly
   x = 0** — the beach's centreline, the spawn, and the sightline of every shot
   down the middle of the chapter. Ten trees at `-50.4 + i * 11.2` clears it by
   5.6 m either way. (And the pine-cone task walks the same row: two copies of
   that arithmetic is a tree you can rattle from four metres away.)
2. The lowest whorl was at `manPROM_Y + 3.2` with a **3.4 m radius**. The rig is
   7.6 m over the animal and the promenade is 2.6, so every pine put a dark green
   slab across a third to a half of the frame from the moment you stepped onto the
   front. Bare ringed pole to 8.4 m, canopy above — which is also what a street
   Norfolk looks like, because the council takes the bottom four whorls off.

## THE EQUIPMENT WAS DRAWN AND NOBODY WAS USING IT

Manly's Corso had a queue rail with no queue, four café tables with nobody at
them, six benches nobody sat on, a bus shelter nobody waited in, a lifeguard tower
with nobody in it, and a volleyball net with a ball beside a local saying *"we are
two down"*. Every piece of furniture on the front was drawn and unused — the
Cappadocia crew argument, one storey down. Twenty-nine merged figures
(`manPutFigure`, five poses: stand / sit / lean / reach / stride), into the town's
own merger, ~3 200 triangles and no extra draw call. **The test each one had to
pass was that it is USING something this file already drew.**

Also: `manGrass` had been in the palette since the chapter shipped and was never
used — two hundred metres of paving with nothing living on it. A verge is a
continuous strip of turf with things growing OUT of it; the first cut scattered
0.32 m boxes up to two metres long and photographed as green foam blocks.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **The sound of a surf beach is not the wave you are standing in.** The one
  rationed splash fired off `manWave` at the CAPYBARA's position, so watching a
  two-metre set unload forty metres away the chapter was silent but for gulls.
  Sample the break at four points across the bay and hold a BED on `hiss` (1.2 s
  throttle), level and pitch both functions of the break. Same argument that moved
  the spray off the observer.
- `manBigNear` has run the sky, the grade and the score since the chapter shipped
  and never made a sound. One low note as the wave of the set crosses the bar, on
  an EDGE, plus a `music.swell` proportional to it.
- **`cheer` is on a 3 s throttle shared with three chapters' ambience.** The one
  cheer the player is owed — twenty people watching a fifty-metre ride land — has
  to pass `force: true`. There are eleven `force` calls in the whole game.
- Sixteen people standing in the same water as a task called 'go under the white
  water, not over it', and not one of them ducked. One comparison and a metre of y.
- The bathers turn to the HORIZON when a set stands up; they turn to the RIDER
  once the water has somebody. One aim point (`manBathAim`) does both.
- A wrack line is nearly the colour of wet sand and lies ALONG the tide line.
  White foam + teal bluebottle + 2 m pieces at free rotation photographed as
  coloured paper scattered over the beach.
- **A yard apron must be probed per patch.** Two slabs drawn at `hy` — the height
  of the fazenda's SUMMIT — over ground that falls 2.6 m inside its radius hung
  three metres in the air twenty metres out, and filled the lower half of the
  approach frame with flat brown. Eighteen small patches on their own ground is
  both the fix and the better picture.
- The jabiru's nest had two chicks and no adult on it (the one adult is at the
  foot of the tree fishing). A tuiuiú pair splits it — one fishes, one stands on
  the rim with its bill down its own chest for an hour.
- The dusk soundscape: the birds stop and the frogs take over within ten minutes
  of sundown in that place, and the ambience was four-in-the-afternoon for the
  whole of the chapter after the crossing. Gated on `dusk()`, same positional
  argument as the Sahara's medina.

## MEASURED AFTER

Triangles **Manly 50 462 → 71 678 (+42 %)**, **Pantanal 174 112 → 213 304 (+23 %)**
— and the Pantanal number understates it badly, because the quad swap gave back
about 25 k that was spent again on 3.5× the grass, 7-stem reeds, 210 understory
palms, 90 → 150 termite mounds with real silhouettes, the crossing, the yard and
the campo litter. Frame time **16.7–16.8 ms median / 17.9 p95** in both, unchanged
(vsync). Bodies 91 → 97 / 87 → 91. Locals 8 / 7, unchanged.

`qa/fuzz.js` clean on both (no NaN, no void falls, no console errors, no
`lastError`). `qa/audit-tasks.mjs` 0 blockers over 199 tasks. Kinematic sweep
clean, map marks 7/7 and 6/6 resolve, `node build.mjs` OK with no collisions.
A three-minute real-clock audio soak per chapter with the score and ambience
running: zero console messages. Verified by playthrough: `move-flags` fires (it
could not before), `gather` reaches nine, `the-crossing` fires with dusk at 0.95,
`caiman-nap` still fires on the rebuilt sandbar at body y 1.61 over a back at 1.27.

**A prop "sunk under the terrain" report that counts `game.props` without
filtering by biome measures every chapter's props against the live chapter's
`terrainHeight`.** Cost twenty minutes; props.js spawns correctly.

Related: [[capy3-second-pass-twelve-thirteen-fourteen]], [[capy3-the-sea-has-a-shape]],
[[capy3-the-herd]], [[capy3-the-locals]], [[capy3-third-pass-fifteen-sixteen-seventeen]],
[[capy3-clone-eats-the-shader]], [[capy3-world-size-audit]], [[headless-qa-harness]]
