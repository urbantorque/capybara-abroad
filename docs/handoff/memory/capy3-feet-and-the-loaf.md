---
name: capy3-feet-and-the-loaf
description: "R4 of the character pass: toes, an ankle that needed a new shin, and the measured fact that the loaf's rear legs were 14.6 cm inside the lawn"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T10:10:49.755Z
---

Built 6 Sep 2026, closing C2 after [[capy3-the-hull-and-the-head]]. Code:
`capybara.js` THE FOOT (R4), THE SHIN (R4), THE ANKLE BAND (R4), THE LOAF SITS
ON ITS HOCKS (R4). Instruments `qa/r4-pre.js`, `qa/r4-foot.js`, `qa/r4-band.js`,
`qa/r4-ar.js`. Budget 1 356 tris becomes 1 436 on the same 35 meshes. Left
uncommitted with R1-R3.

**MEASURE A POSE AGAINST THE DRAWN GROUND, NOT AGAINST THE CONSTANTS.** The
roadmap said the loaf left the rear feet "outboard of the rump". They were not
outboard at all (foot back -0.564 against a rump at -0.626). They were **14.6 cm
UNDER THE LAWN**, with 13.4 cm of shin under it, because the loaf drops the model
14.5 cm and the rear legs trailed down into the hole. `qa/r4-pre.js` gets this by
transforming every vertex to world and subtracting the live biome's own
`terrainHeight(x, z)` under it: one number per part, and it is the difference
between a pose that is written and a pose that is drawn. **Add a sink column to
any probe that measures a limb.** After: 0.005 / 0.006 m, soles on the lawn.

**A `CylinderGeometry` CANNOT CARRY A BAND.** `heightSegments` 1 means vertex
rings at the two ends and nowhere else, so a vertex colour meant to change 6 cm
off the ground has no vertex to change at. Raising `heightSegments` buys one
wanted ring and three unwanted ones at 48 triangles a leg. A hand-authored tube
with exactly the rings the shading needs (sole, ankle, top) and no top cap is
28 triangles against the cylinder's 24. Same family as the pad in
[[capy3-the-hull-and-the-head]]: **the shading decides the topology.**

**THE LEG TAPERED THE WRONG WAY AND NOBODY SAW IT UNTIL THE FOOT HAD A SHAPE.**
`CylinderGeometry(0.078, 0.10, ...)` is radiusTop then radiusBottom: the shin
was 20 cm across at the ankle on a foot 14.5 cm wide. Invisible while the foot
was a slab; with toes cut in, the shin's bottom cap swallowed them from behind.
0.100 to 0.068 puts the ankle inside the footprint. **A detail added at one end
of a part audits the part it attaches to.**

**AN ANKLE IS WHAT MAKES A FOLDED LEG SURVIVE HAVING TOES.** The foot takes the
leg's own loaf rotation straight back off (`feet[i].rotation.x =
-legs[i].rotation.x * capyLoaf`), so the sole stays flat through the fold.
Without it a leg at 1.234 rad is an animal on its heel with its new toes in the
air. Both loaf angles were then re-derived rather than nudged: with a level foot
the sole is 0.175 m under the hip, so `0.295 cos a + 0.03 sin a = 0.15`, giving
-0.837 and 1.234.

**TWO CHECKS FOR ANY HAND-AUTHORED GEOMETRY, BOTH ONE LOOP LONG.** Signed volume
of a closed mesh (positive = every face wound outward; a foot reads 0.0011455)
and, for an open one, the dot of each face normal with its own outward radial. A
face wound the wrong way is INVISIBLE under backface culling and reads as a
modelling mistake, not a winding one.

**PROVE "no regression" WITH THE SAME DIFFERENTIAL YOU WOULD USE FOR A FIX.**
`qa/fuzz.js` showed `solverSaves` 2 from Kowloon on. Rather than argue it was
unrelated, `git stash push -- src/capybara.js`, rebuild, re-run: the baseline has
the identical 2. It is a background rate. Costs twelve minutes and it is the only
thing that turns a hunch into a fact. See [[headless-qa-harness]] trap 9.

Roadmap deviations worth knowing: the hand-off's "four notches on the front
feet" is four TOES and three notches; its `rotation.z` tuck was dropped because
the rear foot's outer edge (0.222) is already 5.5 cm inside the flank above it
(0.277), measured off the hull's own buffer.

Related: [[capy3-the-character-pass]], [[capy3-the-coat]],
[[capy3-under-the-floor]], [[capy3-springs-are-clipped]]
