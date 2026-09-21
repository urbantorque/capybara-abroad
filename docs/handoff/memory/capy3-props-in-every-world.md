---
name: capy3-props-in-every-world
description: "What it took to give chapters 3-17 real rigid-body props, and the three shared-module gates that had to move first"
metadata: 
  node_type: memory
  type: project
  originSessionId: aa9f40a9-cf42-418f-b027-9d3788c21c1e
  modified: 2026-08-21T14:21:27.431Z
---

Until 22 Aug 2026, `physScatter()` (boot, Sydney) and `physScatterPasto()` (first Pasto
entry) were the only two prop scatters in the game. Chapters 3–17 had **zero dynamic
bodies** — every table, stool, crate and mug in them was static geometry. Adding
`physBIOME_SCATTER` + `physScatterBiome(name)` on `biome:enter` needed three other things
fixed first, each of which silently produces "nothing appears" rather than an error:

1. **`physSpotOk` asked Sydney.** It read `physGame.env` for `isOverWater` and
   `navBlocked` whatever biome was live, and rejected everything outside Sydney's box
   (`z −8.6…68, x ±68`). Abroad that rejects every candidate point and the scatter places
   nothing. Same shape of bug as the old `physSurfaceY`.
2. **InstancedMesh groups were keyed by geometry alone.** `physInstByKey` is claimed by
   whatever biome capture tag is live when the FIRST prop of a type is made — so a bin
   scattered in Venice joined Sydney's bin mesh, which Venice has set invisible. Body
   present, solid, grabbable, nothing drawn. Key is now `geoKey + '@' + biome`.
3. **`physCrowded` iterated all props across all biomes.** Biomes share one coordinate
   space, so a Sydney prop parked at (x,z) blocks a legal spot in Venice. Gate on
   `arr[i].biome !== physLiveBiome()`.

Detector that proves it end to end: for each biome, count props where `p.biome === name`
AND `p.body.id` is in `world.bodies` AND the instance's mesh (and every parent) is visible
AND `p.instIdx < mesh.count`. Attached-but-not-drawn is the failure mode that looks fine
in every body count.

Related: [[capy3-shared-module-blindness]], [[capy3-shared-space-leaks]], [[capy3-quay-is-two-places]]
