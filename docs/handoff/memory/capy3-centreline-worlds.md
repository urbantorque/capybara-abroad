---
name: capy3-centreline-worlds
description: "The polyline-centreline pattern behind capy3's chiva road and Uji river, and the traps in laying one through built content"
metadata: 
  node_type: memory
  type: project
  originSessionId: c6464407-3e34-4176-9162-c866ef1e3cc8
  modified: 2026-08-19T02:47:35.548Z
---

Both marquee moments built on 19 Aug 2026 — the Cali chiva's route and the Kyoto Uji run — are
the same construction: **ONE POLYLINE, and everything derived from it.** Resample at a fixed
spacing, smooth with `[1,2,1]` passes (pin the endpoints and any reach a fixed structure
crosses), accumulate arclength, then read position / heading / grade / curvature / width off
`s`. The drawn surface, the collision, the hazards, the vehicle's pose and the flow field all
come from the same table, so they cannot disagree. It is worth reaching for again.

**Author switchbacks in POLAR COORDINATES about the hill.** The Cali flank is an ellipse
centred on Cristo Rey; knots are `[bearing°, ellipse radius]` and the road is sampled ALONG the
arc. Chording between two points on the same contour cuts inside it, so the middle of every
traverse runs up the fall line — measured, that route peaked at a **74% grade**. Sampled along
the arc, the same five knots peak at 8.9%, with nothing tuned by hand.

**Hazards are authored as fractions of the RUN, not of the whole feature.** The Uji is 391 m
and the run is the last 215; keying boulders to the river put a 2 m rock twelve metres past the
put-in.

**A hazard test needs BOTH an arclength gate and a lateral extent.** A signed-distance-to-plane
test is exact and untunnellable at 7 m/s, and it is also infinite: the chiva's route doubles
back, so a cable strung over the riverside road took the player off the roof twenty metres away
on a different street. Gate on `|w.s - vehicleS| < 14` and on lateral distance.

**Laying a channel through built content — the four traps, all hit:**
- Cut the channel LAST in `terrain()`, after every shelf, or a shelf blend erases it.
- Force the bank to `waterY + 0.6` inside the corridor. Kyoto's Uji town shelf sits below the
  river's surface, so without a levee the drawn water ends in mid-air.
- A ribbon's winding: downstream x across = (0,-1,0), so the obvious index order normals the
  surface at the riverbed and it is back-face culled. **The river renders as a road.** It is
  invisible in code and unmistakable in a screenshot.
- Check what is already there. The Uji's return leg ran through four rows of matcha terraces
  and the chiva was parked inside a house at (20,33) — both had been true for months, invisible
  because both were static boxes that only ever had to hold a capybara up.

**Sell the speed.** A capybara on a featureless surface with the banks 15 m away and a chasing
camera has no visible speed at all. 120 instanced foam streaks advected by the real flow field
(and floating barrels doing the same) fixed it outright — and because they ride the field they
also DRAW the fast line and pile into the eddies, so the player can see the racing line instead
of learning it by being punished.

Related: [[capy3-reference-frames]], [[capy3-biome-build-gotchas]], [[capy3-visibility-metrics]]
