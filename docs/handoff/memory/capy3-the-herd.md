---
name: capy3-the-herd
description: "capy3 chapter 15 (the Pantanal): followers as a trail rather than a flock, and why a floating raft has to be reported in terrainHeight"
metadata: 
  node_type: memory
  type: project
  originSessionId: dcc928c7-6698-466c-a306-96ba0ca82238
  modified: 2026-08-20T10:59:03.121Z
---

Built 20 Aug 2026. Fifteen places and the animal had never been anywhere it is FROM,
which is the joke the whole game runs on and only works because somewhere exists where
it would not be a joke.

**A FOLLOWER LINE IS A TRAIL, NOT A FLOCK.** Wheek near another capybara and it joins
with an `order`; each follower steers to where the PLAYER ACTUALLY WAS
`2.6 * (order + 1)` metres ago, read off a ring buffer sampled every 35 cm. No
flocking, no separation force, no steering behaviour — and therefore it cannot pile up,
cannot orbit, cannot oscillate and cannot walk through the termite mound the player
just went round. Nine matrices, about forty lines. **A follower that is behind must
RUN** (speed scales with the gap, capped at 8.5 m/s) or the line stretches on the first
sprint and never recovers.

**A FLOATING PLATFORM HAS TO BE REPORTED IN `terrainHeight`, NOT ONLY AS A COLLIDER.**
This is the bug that cost the most here and it generalises to any biome. capybara.js
decides whether the animal is swimming from `isOverWater`, and `isOverWater` reads
`terrainHeight` — so a capybara STANDING ON A RAFT over two metres of water was being
told it was in the water. The task could not be completed at all. `panTerrain` returns
the mat top while the mat is within `panMAT_SOLID` (0.14 m) of the waterline; past that
it stops being ground and you are swimming, which IS the mechanic.

**A RATE IS METRES PER SECOND.** The mats' sink rate shipped without its `* dt`: 18 m/s,
so the whole mechanic fired and finished inside one frame and the meadow simply was not
solid. Symptom from the player's side is indistinguishable from "the feature does not
exist".

**WATER OF VARYING DEPTH WANTS VERTEX ALPHA.** A single `opacity` cannot describe a
sheet that is 2.5 m deep in the middle of a bay and 8 mm at the edge of a channel.
three.js reads a **vec4** colour attribute as colour AND alpha (`USE_COLOR_ALPHA`), so
the sheet fades out where it gets thin. The alternative — pushing dry vertices under the
ground — leaves a visible one-cell RAMP round every shoreline.

**AND THE 22 CM OF SLACK IN `isOverWater` IS LOAD-BEARING AGAIN.** A third of this
chapter is under two inches of water and two inches of water is a thing you WALK
THROUGH. If `isOverWater` were true wherever the flood is drawn, the animal would swim
at 2.6 m/s across half the map. Draw the water everywhere it is; call it water only
where it is deep.

Body budget: the Transpantaneira is drawn every 4 m and COLLIDED every 12. One static
box per drawn segment was fifty bodies on its own and put the chapter at 185.

Related: [[capy3-the-middle-rung]], [[capy3-external-forces-on-the-capybara]],
[[capy3-things-that-are-simply-there]], [[headless-qa-harness]]
