---
name: capy3-the-glimpse
description: "B2 of ROADMAP-FUN: the arrival lens that turns to the marquee, its four gates, and the roadmap item that was already built"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T01:09:48.755Z
---

**B2, 7 Sep 2026**, branch `character-pass`. Item 1a and item 1c of
`ROADMAP-FUN.md`.

**The glimpse (`sysGlimpseShot`).** The arrival shot turns onto the chapter's
marquee and holds it for the length of the place card. Frame one is still the
authored spawn heading — `camYaw` is assigned on the teleport line and the rig
DAMPS toward a `frameShot` request rather than snapping — so the lens swings
over the first second. Where the authored heading already frames the marquee,
the shot is left exactly as F1 wrote it.

The raise arithmetic, solved not tuned. Eye at `cos(p)·dist` from the animal on
the far side from `yaw` and `sin(p)·dist` above it, look point at animal +
`raise`; for a target `rise` up and `D` out:

    raise = s + c·(rise − s)/(D + c),   s = sin(p)·dist,  c = cos(p)·dist

**FOUR GATES, AND EACH ONE IS A FRAME THAT WAS MEASURED AND REJECTED:**

1. **the bearing** (20°) — the obvious one.
2. **the look-point RAISE** (0.8 m). A bearing-only gate is not a gate: it
   exempted Sydney, Pasto and Sơn Đoòng, whose marquees are dead ahead and 11,
   71 and 42 m UP, and all three measured at NDC y > 1 — off the top edge. The
   figure is 0.8 rather than the 1.6 the geometry gives because **`sysCAM_FLOOR`
   clamps the eye's HEIGHT**, which tilts the real axis down relative to the
   model and carries the subject up the frame.
3. **the sight line** to the marquee, pulled 15 % short so the question is "is
   the way there clear" and not "is the surface of the thing solid".
4. **the boom.** The eye stands on the OPPOSITE side from the marquee, so a
   clear view forward says nothing about it.

Without 3 and 4 the frustum count is BETTER — 18/19 against 14/19 — and Kyoto's
first frame is a shop window at three metres, because the Uji is 78 m away
behind a row of shopfronts and the lens dutifully swung onto it. **"In the
frustum" is not "you can see it", and an instrument that only counts can be
improved by making the game worse.** Judge from the PNG.

Measured (`qa/arrive-see.js`, 2.2 s into the 3.60 s shot): in the frustum
8/19 → **14/19**; unoccluded 2/19 → 4/19. The five that still miss — Kyoto,
Rio, Iceland, Hong Kong, Hanoi — are where the glimpse correctly DECLINES.

**Item 1c was already built, and wrong about its own premise.** It claimed
"none of those clocks is phased to your arrival". All five chapters whose
marquee rides a clock re-phase it in their own `onEnter()` against an authored
constant: Venice `venTIDE_START` 0.055, Cappadocia `gorPhase` 0.06, Hong Kong
`hkPhase` 0.06, Palawan `palPhase` 0.10, Hanoi `hanTRAIN_GAP2 × 0.30`. First
window 81 / 67 / 76 / 48 / 32 s after arrival — SOONER than the item's
150–210 s target. All five re-phase on EVERY entry rather than latching on
`seen[]` as the item asked, which is the better rule and is written down in all
five chapters. Nothing was changed.

What genuinely did not exist: `nextIn` has published the countdown since P3 and
`todoParLine` renders it **on the clue under the TOP row — which is exactly the
row a clocked marquee never is**, because it sits in act two or three. The
countdown is on the marquee signpost now.

Related: [[capy3-what-the-place-is-for]], [[capy3-visibility-metrics]],
[[capy3-the-number-and-first-frame]], [[capy3-finish-batch-one]]
