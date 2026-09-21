---
name: capy3-solid-or-drawn
description: "The capy3 audit that finds walk-through buildings, what it found in five worlds, and the two ways the audit itself lies"
metadata: 
  node_type: memory
  type: project
  originSessionId: 77c748fb-b63b-405b-88c5-6ccb693f86fc
  modified: 2026-08-20T15:44:23.371Z
---

Built 21 Aug 2026, after "I can phase in and out of structures". The complaint was real and
it was FIVE separate omissions, all of the same shape: a loop that draws buildings and does
not carry the line that makes them solid.

**THE AUDIT (`qa/audit-solid.js`).** Per biome, on a 5 m grid over the world bounds: stand at
chest height (`terrainHeight + 0.55`), cast a 2.5 m three.js ray in each of ±X/±Z, and cast
the SAME ray through `world.raycastClosest`. Drawn hit + no physics hit = you walk through it.
Then measure how tall the thing is (down-ray from `terrain + 40`) and keep only `h >= 1.6`,
which is what separates a building from a tuft of grass.

**Three filters the audit cannot do without, each of which cost an hour:**

1. **A slope read at chest height is TERRAIN, not a structure.** Drop any hit whose point is
   below `terrainHeight(hitX, hitZ) + 0.40`. Without it every hill in the game reads as a
   phase-through, because cannon's Heightfield raycast is not reliable enough to be the
   arbiter — use the biome's own analytic `terrainHeight`, never a physics ray, for ground.
2. **Skip sample points that are INSIDE a collider.** cannon reports no hit for a ray that
   starts inside a box, so an origin buried in a façade reads as "drawn but not solid" when
   it is the most solid place in the world. Kowloon's 54 hits were all this.
3. **Parity (count the up-ray crossings) does NOT work.** Sky domes, haze shells and the
   cave's own interior are enclosing surfaces, so "inside an odd number of solids" is true
   nearly everywhere. Abandoned after it reported 3123/3364 of Pasto.

**WHAT IT FOUND, and all five are the same bug:**

| world | before | after | what |
|---|---|---|---|
| cave | 278 | 61 | the wall is drawn every 8 m and was collided every 32, with only ONE of the two wobble terms and 2 m further out |
| Venice | 94 | 3 | fifty Grand Canal palazzi, 11–17 m, no collider at all — the calli loop had the line, `venBuildCanal` never got it |
| Quay | 83 | 18 | the fourteen Corso shops, the chip shop, the wharf shed |
| Reykjavik | 121 | 63 | every house in the town; the church and the hot dog stand had theirs |
| Manly | 66 | 2 | North Head and the west headland — 28 blocks, 12 m each |

Total 516 → 476, and the residue is almost entirely INSTANCED VEGETATION (Pasto's shrubs,
Cali's cane, Kyoto's bamboo, Pantanal's trees) which is deliberately walk-through, plus
Göreme's chimneys where a box inscribed in a cone leaves 0.25·r of overhang by design.

**THE EXTENTS CONVENTION IS PER-MODULE AND IT IS NOT THE SAME ONE.** `venStaticBox`,
`cavStaticBox`, `iceStaticBox`, `manStaticBox` and `hkStaticBox` take FULL extents and halve
internally; **`quayStaticBox` takes HALF**. Read the helper before adding a call. And when the
drawn box uses `rand()` for its size, hoist the size into a local and pass the SAME numbers to
both calls, or the solid thing is a different shape from the seen one.

Frame budget after adding ~180 static bodies: unchanged, 16.6–16.9 ms median in all sixteen.

Related: [[capy3-shared-module-blindness]], [[capy3-biome-build-gotchas]], [[headless-qa-harness]]
