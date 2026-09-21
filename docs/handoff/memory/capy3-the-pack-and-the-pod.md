---
name: capy3-the-pack-and-the-pod
description: "capy3 chapter 17 (Antarctica): a sea with a density field in it, four frictions as places, and the helm-camera bug that had chapter 3 driving backwards"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d0fb52-6acc-4b85-b275-892868be786e
  modified: 2026-08-20T18:20:24.810Z
---

Built 21 Aug 2026. `antarctic`, chapter 17, from "slippery in certain areas, and the
marquee is riding near orcas, and you are in a boat most of the time".

**THE SEA IS A FIELD, NOT A SURFACE.** `antIceAt(x, z)` returns pack density 0..1 and it is
the whole chapter: the tender's top speed is `VMAX * (1 - 0.70*ice)`, her acceleration is
scaled the same way, she grinds audibly above 0.34, and the sea mesh's VERTEX COLOUR is a
straight read-out of the same function. So the navigation aid is the picture — open water is
dark, pack is white — and the LEAD (a wandering trough of near-zero density down the middle)
can be found by looking, from a hundred metres, with nothing on the HUD. Full ahead in the
lead is 12.4 m/s measured; full ahead in the thick of it is under four. The 460 instanced
brash lumps are distributed by the same field, so near and far agree.

**FOUR FRICTIONS AS PLACES, WHICH IS ONLY POSSIBLE BECAUSE SLIP IS LINEAR IN TERMINAL SPEED**
(see [[capy3-slip-and-sky]]): rock 0, snow 0.18, iced timber 0.34, floe 0.48, penguin highway
0.66, blue glacier ice 0.93. Two runs come out of that — the highway at 8.8 m/s and the blue
tongue at 10.6 — and both have a grippy way back to the top, which is the Iceland rule.

**FIVE THINGS MEASURED WRONG BEFORE THEY MEASURED RIGHT:**

1. **A COLLISION PENALTY MUST BE A RATE.** `speed *= 0.55` inside a 60 Hz loop is `0.45^60`
   per second — a bottomless well, not a bump. The tender touched a floe at 11.2 m/s, dropped
   to 0.73 and ground along it for twenty-five seconds; steady state against the engine is
   `acc*dt / (1-k)` = 0.45 m/s. Same shape twice more (the shoreline slide, the world-edge
   clamp, which did not touch the speed at all and reported 12.6 m/s pinned against a wall
   for ever). Every one of them is `speed *= 1 - clamp(rate*dt, 0, cap)` now.
2. **A DOME HIDES ITS OWN FOOT.** smoothstep gives a rounded cap and a rounded cap is convex:
   three separate attempts at the opening shot photographed a blank white curve with a jetty,
   three huts and an orange boat all just over the brow. The profile is
   `0.86*clamp(1.12-d,0,1) + 0.14*smooth(1.16-d)` now — mostly a straight cone. **A straight
   slope shows everything on it from anywhere on it.**
3. **THE MARQUEE WAS UNDER THE WATER AND THE WATER IS OPAQUE.** Six orcas at
   `waterLevel - 0.85` break the surface for a third of each porpoise cycle, so the shot of
   the escort had none in it. On a bow-ride they run half out; escort height is
   `waterLevel - 0.34` with the dorsal always clear, patrol stays low. Their stations came in
   to ±6 m as well: the rig is 9.5 m back, so the horizontal half-width at the boat is 7.3 m
   and ±7.5 put them exactly on the frame edge.
4. **AN ORCA WILL FOLLOW YOU ONTO A BEACH IF NOTHING STOPS IT.** The pod steers to a point
   and nothing had ever asked whether the point was wet. `antToDeep()` walks three steps down
   the gradient of the land field; it runs on the pod centre AND on every animal.
5. **A ROOM THIS CAMERA CANNOT SEE INTO IS NOT A ROOM.** The bar was made a hollow hut so the
   mug could be reached; the rig is 6 m up at 41 degrees, so the shot of the counter was a
   photograph of some slate. Then it was given an awning and the shot was a photograph of a
   smaller roof. **The bar is outdoors and has no roof at all.**

**A NEUTRAL DETENT IS A GAMEPLAY FEATURE, NOT A FLOURISH.** Chapter 3's throttle runs
continuously from full astern to full ahead. Chapter 17 asks you to STOP THE BOAT (the
spy-hop), and measured, a player who holds S sails straight through zero into 3.4 m/s astern
and never triggers it. The stick now sticks at zero and you must come off it to go astern —
which is what a gear lever does, and it makes "stop" discoverable by doing the obvious.

**AND THE HELM CAMERA HAD BEEN BACKWARDS SINCE CHAPTER 3.** systems.js's sailing branch reads
`camYawTarget = capy.group.rotation.y`, and at the wheel that is the SHIP'S HEADING; camYaw is
the bearing FROM the animal TO the camera, so the rig sat dead ahead of the bow. Measured
under way: Circular Quay +20.8 m toward the bow, Antarctica +14.0 m. Both boat chapters were
driven looking backwards down the ship. The walking branch and the chiva branch both carry the
`+ Math.PI`; this one never did. One term.

**Chapter registration is now FOURTEEN places** and `qa/audit-tasks.mjs` catches five of them
— see [[capy3-progression-chain]] for the list, plus the QA biome arrays in `qa/fuzz.js`,
`qa/pointers.js`, `qa/audit-solid.js`, `qa/audit-map.js`, `qa/audit-life.js`,
`qa/audit-locals.js`, `qa/kine.js` and `qa/perf16.js`, none of which are enumerated anywhere.

Related: [[capy3-slip-and-sky]], [[capy3-reference-frames]], [[capy3-the-sea-has-a-shape]],
[[capy3-solid-or-drawn]], [[headless-qa-harness]]
