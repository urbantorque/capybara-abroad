---
name: capy3-the-stale-list
description: "X9 — the roadmap's own \"what is still open\" was three-quarters wrong, and the drawn ray had never learnt the filter the physics ray has"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1cd09aae-9ae1-4c12-8402-6022ae8c2dc8
  modified: 2026-09-05T07:34:43.360Z
---

Batch X9 (5 Sep 2026, commit `7314a6b`) took the four items `ROADMAP-PHYSICS.md`
listed as unfinished. Three closed, and **not one was the job it was written down
as** — each had been recorded from an instrument nobody had audited.

**The open list itself was the first finding.** "What this review did not finish"
was written 4 Sep about that session; X8 copied it forward as "what is still
open" without checking the repo. By then X5 had shipped four commits against item
1 and X7 had closed half of item 2. **Re-derive an open list from the repo before
working it** — a carried-forward closing paragraph is a false comment that sets a
whole batch's agenda. Same class as [[capy3-the-shelf-cleared]]'s shelf entries
and the X8c reachability sweep.

**THE DRAWN RAY NEVER LEARNT WHAT THE PHYSICS RAY KNOWS.** X5's fault 4 taught the
solver ray to skip HEIGHTFIELD and PLANE, because you walk *up* a slope rather
than stopping at it. Nothing applied that to the drawn ray — **and the drawn ray
is the half that nominates candidates** — so every hillside, road ribbon and
merged relief mesh in the game reads as a wall at chest height, and so does the
underside of any overhang. The filter (`qa/px-x5-norm.js`): cast at ankle, chest
and head and take the **world normal**. A wall is the same distance at all three
with `ny` near 0 (Kowloon's control: 1.50/1.50/1.50). Göreme's top candidate read
`ny -0.98` — a ceiling 3 cm over the animal's head.

Two more rig faults, both worth remembering:
- **Place by dropping and settling, never at `terrainHeight`.** Terrain is the
  SEABED under any pier, deck or pontoon. Kowloon's candidate settles 5.16 m
  above the terrain datum — on the pontoon — where the old rig walked it along
  the harbour bed underneath. Report that offset in every row.
- **A probe that settles the animal must re-read where it settled.** walk4 cast
  from the original x/z with the settled y, so on any slope the rays started
  where the animal was not.

**A central difference of a piecewise-constant function is not a gradient.**
`px-hooks.js` had the Drift's `slopeAt` stub down as a defect: 0.72 measured
against a published 0. Split by island, the interior gradient is exactly 0 over
275 samples and all the disagreement is 23 *rim* samples averaging 67.97 — cliffs.
**The refinement test is the cheap tell: halve the sample spacing and see whether
the answer converges.** This one walks 5.31 → 5.25 → 5.11 → 6.27. The stub was
right; the instrument was wrong. Related: [[capy3-instruments-that-cannot-hold-a-line]].

**Measured, for the camera:** the V eye raise is worth 5.05° of pitch standing,
4.71° swimming, and **nothing submerged** — −0.47° and a boom that moves 0.000 m,
because the underwater rig has already pulled the boom 11.90 → 5.25 and owns the
lens. Only a *pinned* animal can resolve a camera change; see [[capy3-the-lens-and-the-wall]].

**Still open, and it is the owner's:** no chapter has been played end to end by a
person. An instrumented pass is not a substitute — it shares every blind spot
with the probes above, which is how a 0.72 that was a cliff, a control that was a
hillside and an animal on the harbour bed all survived review.

**X9b closed both debts X9 created** (commit `62b6a5c`), and added two instrument
rules worth more than the findings:

- **A before/after pair around a key press, taken while the subject is moving,
  measures the movement.** The dive read +7.65° of pitch with V held and nearly
  went in as a reversal of X9's own finding. A diving animal is descending, so
  the lens moves anyway. Same dive twice on the same clock, once with the key and
  once without, attributes **−0.09°** to it. **Any control measurement needs a leg
  where the control is not pressed**, and both legs must reach the same state
  (here, 1.72 m of descent) or they are not comparable.
- **`page.keyboard.press` can be missed entirely** — down and up ~10 ms apart
  against a 16.7 ms frame, against an input flag assembled once per tick. E read
  as "the dive does not latch" until it was held for 800 ms. Hold, then poll.

**The re-rank result:** 99 audit samples → 59 gone, 17 wall, 23 explicitly
not-walls. **Of the 40 that still have geometry in front of them, well over half
are hillsides, ceilings, foliage or the animal standing inside the thing.** Named,
the residue is three faces: Pasto's bunting posts (22 cm, left open deliberately —
`pastoBox` is a merger push that cannot carry a collider), a Kyoto mesh, and a
32 m slab at the Cave's z −200 that is worth a look because an unsolid face at the
end of a chamber is a way out of the mountain.
