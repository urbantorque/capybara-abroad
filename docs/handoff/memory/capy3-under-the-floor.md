---
name: capy3-under-the-floor
description: "The four ways \"the capybara is below the ground\" happens in capy3, and the six probes that measured it wrong before one measured it right"
metadata: 
  node_type: memory
  type: project
  originSessionId: fb26bf48-6839-4e7d-b0e6-13a3adeeef81
  modified: 2026-08-30T06:16:13.271Z
---

Reported by the user 30 Aug 2026 from screenshots of Cali and Marrakech.

**There is no single "sinking" bug. There are three, plus a missing safety net.**

1. **A drawn walkable surface that is in neither terrainHeight nor a collider.**
   Cali: `caliRoadY` is a separate function from `caliTerrain`, and `caliTerrain` is
   what the biome publishes as `terrainHeight`. The Puente Ortiz approach blends the
   ROAD to the 1.03 m deck over |z| < 24 while the deck's collider stops at |z| = 13 —
   eleven metres of ramp, on the main route between the two halves of the chapter,
   drawn 0.64 m over the animal's head. Fixed by emitting a collider FROM THE RIBBON
   ITSELF wherever `caliRY[i] - caliTerrain() > 0.10`, so a road later routed over
   something else cannot acquire the bug again.

2. **A long flat plate laid on curved ground.** Sahara's ripple field is 2252 quads
   fifteen metres long, each placed at the terrain height of its own CENTRE. On a dune
   face that is a plank on a hillside: measured, **3.99 m** of pale plate standing over
   the sand, in the same colour as the sand, so it reads as ground. Fixed by fitting
   each plate to the chord between its own two ends AND then dropping it by the worst
   amount it still stands proud along its length — it can then only ever be at or under
   the sand. 3.99 m → 0.56 m worst, nothing above 0.6 m at all.

3. **Ejected downward out of a solid, permanently.** Get inside a static box and the
   contact equation pushes you out through the nearest face, which under a floor is
   DOWN. `capyVOID_Y` is −3 m, so the automatic rescue never fires; what is left is a
   stalemate — the soft-floor backstop asks for 3 m/s of rise every frame, the contact
   push puts it straight back, and the animal stands under the pavement with
   `grounded === true` and a permanent 0.85 m/s of upward velocity going nowhere. R
   ("put me back") is a rescue you have to know about. Fixed with a stalemate detector:
   gap > 0.22 m for 0.45 s with the body not moving → the same teleport the void rescue
   does. **And the rescue has to move you sideways too**, because straight up is back
   inside the thing that put you there — `navBlocked` first, then a golden-angle spiral
   for repeat firings, because `makeSolidIndex` deliberately reports a deck as NOT
   blocked ("walk on it") and a deck is exactly what is usually overhead.

**SIX PROBES MEASURED THIS WRONG BEFORE ONE MEASURED IT RIGHT.** Every one looked
authoritative:

- Raycasting down from `y + 60` finds the ROOF, not the floor. Cast from just above
  the animal's crown.
- **The raycaster ignores `object.visible`**, and every biome shares one coordinate
  space, so standing in Cali the ray hits Hanoi, Sahara and Monaco at overlapping
  heights. Walk the ancestor chain for `visible === false`.
- `.filter(vis)` passes the INTERSECTION record, not the mesh — `visible` is undefined
  on it, so nothing is filtered and the top hit is the capybara's own back, giving a
  uniform 0.74 m "sink" in all nineteen chapters including the clean one.
- Water surfaces are legitimately above the bed; skip them or every river is a bug.
- A biome's largest meshes are the walkable ones. Scenery standing ON the ground is
  not a sink, and a bbox test on a MERGED biome mesh is meaningless.
- **Writing `body.velocity` every frame to drive a walk-through test overrides the
  contact solver's separation impulse** — it walks through everything, including walls
  that are solid. Setting `input.x/z` and hand-ticking does not move the animal at all.
  Only real keyboard events under playwright drive it honestly.

**Monte Carlo's "walk through some objects" is UNREPRODUCED.** 190 chest-height
candidates, 34 spread evenly and walked into: zero got past the drawn face. Most of the
190 are the terrain mesh disagreeing with `terrainHeight` by up to a metre on a 45°
hillside, which is [[capy3-lattice-not-element-size]], not a missing wall.

Related: [[capy3-solid-or-drawn]], [[capy3-put-me-back]], [[capy3-lattice-not-element-size]],
[[headless-qa-harness]], [[capy3-shared-space-leaks]]
