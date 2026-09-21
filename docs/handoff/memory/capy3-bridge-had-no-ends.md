---
name: capy3-bridge-had-no-ends
description: The Harbour Bridge in chapter 3 floated at both ends and wore its pylon caps four metres above its own head — and why every audit pass missed it
metadata: 
  node_type: memory
  type: project
  originSessionId: fb26bf48-6839-4e7d-b0e6-13a3adeeef81
  modified: 2026-08-30T04:35:56.405Z
---

Found 30 Aug 2026 by the user, from the helm, at the one angle it is obvious from.

**Two defects, both pure arithmetic in `quayBuildBridge` (src/quay.js).**

1. The pylon shaft was `place(u, D*0.5+4, 0, 8.5, D+8, 12.5)` → top at y 33. The cap was
   `place(u, D+12.6, ...)` → bottom at y 37.0. **Four metres of harbour sky between a
   pylon and its own capital**, on both pylons, for the life of the chapter.
2. The deck was `S + 60` = 192 m centred on the arch, so it stopped 25 m outboard of each
   pylon and **hung there over open water with nothing under it and nothing at the end**.

**Why no audit caught either.** They are only wrong in elevation. The flat-plate detector,
the solidity sweep, the body-count and triangle budgets all pass — the boxes are correct
boxes, they are simply at the wrong y and the wrong length. Nothing in qa/ measures
"does this box touch the box above it". A screenshot from the water at eye height hides
the cap gap behind the pylon's own front face; you have to be level with the deck, or
north of it, to see it. **A structure assembled from absolutely-positioned boxes needs its
adjacency checked as numbers — top of A vs bottom of B — because no picture from the
normal camera will show you.**

**The fix, and the thing that made it expensive.** There was nowhere for the deck to land:
a down-raycast every 25 m along the bridge axis reads water (−0.5) from x −267 to x +378,
the entire width of the world. So the landfall had to be built — `quayABUT`, two bluffs
placed off `quayBRIDGE` and drawn through `quayHeadland`, which is the ONLY way a headland
becomes solid, gets ground, and gets its trees (see quayHEADS). Between them a viaduct on
stone piers, each with a `quayStaticBox` and a `quayHARD` entry, because they stand in
navigable water and the ferry would otherwise sail through all four.

**The trap worth remembering: the deck length is computed in two places.**
`quayUpdateTraffic` had its own `SPAN = B.span + 58` — the same number derived a different
way. Lengthening the deck without it would have left the whole viaduct as empty tarmac
with cars only in the middle 190 m. Both now read `quayDECK_HALF`. Same family as the
train, which the file's own comment records used to run from u −0.35 to 1.35 on a deck
that only existed 0..1: **anything that moves along a structure carries a second copy of
that structure's extent.**

Measured after: full passage berth → Manly at 10.4 m/s, `arrived: true`, `under-bridge`
and `yacht-race` complete, no console errors, no new obstruction on the rhumb line (the
track crosses the bridge at x ≈ 25, the nearest new pier is at x 117).

Related: [[capy3-quay-is-two-places]], [[capy3-solid-or-drawn]],
[[capy3-lattice-not-element-size]], [[headless-qa-harness]]
