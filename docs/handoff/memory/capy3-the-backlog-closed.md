---
name: capy3-the-backlog-closed
description: "How capy3's pacing backlog was closed — the rule that made sixteen ordinary tasks cheap, the one that could not be built, and the seabed that was 39% of a chapter"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0d9d93bf-3b1a-496b-8e3d-9b485c4f7c0a
  modified: 2026-08-20T13:34:36.496Z
---

Closed 20 Aug 2026, the session after [[capy3-the-middle-rung]] measured it. **185 tasks over
sixteen chapters, and `qa/pacing.mjs` now prints "nothing. every chapter is in the band" — inside
20-35 min at 60, 75 AND 90 seconds a task.**

**THE RULE THAT MADE SIXTEEN NEW TASKS CHEAP: use something the chapter has already drawn and
never used.** Every one of them was already in the world. Kyoto's six stepping stones, described
in their own comment as *"the only dry way aboard"* and never asked for. The Arcos da Lapa's deck,
which carried the comment *"where the tram runs"*, had NO COLLIDER at all and no way up. Rio's
kiosk counter, drawn and not collided. The snowcat, built as a pacing fix and never given a line.
Ninety palms with nothing on them. The Drift's weathervane — the chapter's only instrument, and
the reason `long-gap` is a puzzle about WAITING rather than a jump that sometimes works. The
campo's cistern head. The calli. Victoria Harbour. The Star Ferry's horn. The jetty. The beach
fire. Two of Göreme's five launch crews. Two needed new geometry and neither needed twenty lines.

**AND THE ONE THAT COULD NOT BE BUILT IS WORTH MORE THAN THE FIFTEEN THAT COULD.** 'Come up
underneath an island' in the Drift is IMPOSSIBLE: every island footprint answers `driTerrain` with
the island's TOP, so capybara.js's analytic ground backstop levitates anything below it straight
up. Measured — teleported twelve metres under the Shelf, the Anvil and the Arch, the animal
arrived on all three upper surfaces inside a frame. **The keels are drawn and they are not a
place.** It became 'Let the cloud hand you back', which is the chapter's own safety promise and
had never once been said out loud.

**THE SEABED WAS THIRTY-NINE PER CENT OF PALAWAN.** The chapter was 145,639 triangles against a
130k ceiling and it was not the reef and not any prop (the manta is 672, four tenths of one per
cent — measured by hiding it at a fixed camera). It was a FLAT 150 x 190 grid: two-metre cells
over the whole 300 x 380 m, 57,000 triangles, most of them on the abyssal plain where the floor is
one number. **The fix is to WARP the grid, not shrink it** — Pasto's monotone squeeze, k = 0.5,
pulling vertices into the middle. 96 x 122 warped is 1.6 m through the middle (FINER than what it
replaced), 6 m on the plain, 23,424 triangles, and s = ±1 maps to itself so the mesh still ends
where the world does. 112,495 now.

**FOUR MORE AMBIENT MOVERS** (see [[capy3-things-that-are-simply-there]]): Pasto's vencejos round
the bell tower (they scatter when the bell goes and take fifteen seconds to forgive it), Cali's
five cometas over San Antonio, Iceland's arctic fox — which STOPS AND LOOKS rather than running,
because that is what they do and a white thing bolting into the dark is a worse picture — and the
Drift's skein, which exists to give the void a size. **Cappadocia got none on purpose:** balloons,
eleven horses, a chase truck, a hundred and sixty pigeons and five crews. Adding to the busiest
chapter in the game is padding, not life.

**THREE BUGS, ALL FOUND BY A PROBE THAT PRINTED TWO THINGS SIDE BY SIDE:**

1. **Two accessors, one scratch vector.** `gorme.envelope()` and `gorme.mouth()` both returned
   `gorV3b`, so a caller holding one while asking for the other got the same object twice. Caught
   by printing them together and getting the same three numbers.
2. **A crossing whose lane is chosen when it ENDS starts in the wrong place.** The Drift's skein
   picked its height, heading and lane at the end of each pass, so the FIRST pass ran at whatever
   the initialisers said — y 0.6, through the cloud sea, along z = 0, under an archipelago that
   starts at 30.
3. **A QA harness can fail a task that works.** `the-calli` measures a 36 m crossing of the maze
   from wherever you entered — and the campo is INSIDE the maze rectangle, so testing the well
   first banked a from-x of −54 and the crossing could never be measured. The task was right and
   the test was wrong. Check that before touching the code.

Related: [[capy3-the-middle-rung]], [[capy3-things-that-are-simply-there]],
[[capy3-world-size-audit]], [[headless-qa-harness]], [[capy3-biome-build-gotchas]]
