---
name: capy3-the-dark
description: "capy3 chapter 16 (Sơn Đoòng): the wheek as a torch, and the four ways drawing the inside of a mountain goes wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: dcc928c7-6698-466c-a306-96ba0ca82238
  modified: 2026-08-20T10:59:26.797Z
---

Built 20 Aug 2026. Sixteen chapters and the game had never turned the lights off — it
has been night four times and every one of those is a night with a SKY in it.

**THE NEW VERB IS A KEY THE PLAYER HAS HAD SINCE CHAPTER ONE.** Press Q in the dark and
a pulse of light goes out from the animal: one `THREE.PointLight` whose `distance` grows
outward and whose intensity has a HARD ATTACK and a long tail (a light that fades UP is
a torch; a light that arrives all at once and goes is a noise), plus an expanding ring
on the floor. Cooldown 1.05 s, so it is a rhythm. Bound to `capy:wheek` and nothing
else — CONTRACT.md, ONE VOICE: a capybara has one mouth and the context decides what the
noise means.

**`daylight()` IS THE CHAPTER'S ONE NUMBER.** 0 in the passage, 1 outside and under the
hole in the roof, 0.85 at the exit slot. systems.js reads it for the fog near AND far,
the hemisphere, the ambient, the sun and the grade's threshold, so a hundred and seventy
metres of mountain has exactly three places that do not look like the inside of one.

**FOUR THINGS THAT MEASURED WRONG:**

1. **A floor and a roof is not a cave, it is a canyon with a lid on.** No side walls
   meant the eye went past the edge of the floor mesh and out into `scene.background`,
   which under the doline is pale blue daylight. A wall of sky at eye level inside a
   mountain.
2. **A shaft of light must be ADDITIVE.** A translucent cylinder at 0.17 over a nearly
   black background renders as a solid tan slab, because 17% of white on top of nothing
   IS a wall. Light does not occlude, it adds — and it is far brighter at the hole than
   at the floor, which is what a vec4 vertex alpha down the cylinder is for.
3. **A roof needs a hole and PlaneGeometry cannot have one.** Hand-author it: emit
   quads only where the roof is there, wound so the normals point DOWN, because you are
   underneath them. Same family as the Uji's riverbed rendering as a road.
4. **A very low bloom threshold on POINT sources shows the quarter-res grid.** At
   bloom 0.95 / threshold 0.20 / radius 1.5, every cluster of glow-worms grew a visible
   SQUARE LATTICE of quarter-res texels across the dark. 0.62 / 0.26 / 1.35 keeps the
   spill and loses the lattice. The threshold also has to go UP under the shaft, not
   down — the Cappadocia rule.

**AND `climbHold` REACHES OUT AS WELL AS IN.** Chapter 11 established that the band must
reach THROUGH the wall (the cling pulls the animal in and the collider stops it half a
metre further). The other half had never been paid for: the Great Wall's collider is 8 m
deep, so its outer face is 4 m from the middle and a capybara pressed against it has its
CENTRE another 0.7 m out. A band of ±4.2 never fired at all — the animal walked into the
wall and stood there. ±6.5.

The glow-worms are the map, and it works because of entomology rather than level design:
Arachnocampa hang over water because that is where the insects are, so following the
dots gets you to the river whether or not you have understood anything else.

Related: [[capy3-chapters-ten-eleven]], [[capy3-the-picture]], [[capy3-controls-one-voice]],
[[headless-qa-harness]]
