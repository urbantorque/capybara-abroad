---
name: capy3-finish-batch-one
description: "F1 — the first ten minutes and the arrival: the boom that is a preference, the spawn that had to move, and two roadmap remedies that were wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3438c0a0-f668-4a46-aecf-4e1f8f98ae17
  modified: 2026-09-05T15:08:50.935Z
---

Batch F1 of `ROADMAP-FINISH.md`, 6 Sep 2026. All nine must-items; CONTRACT.md
carries the F1 paragraph. See [[capy3-the-finish-review]] for the review that
produced the list.

**TWO OF THE ROADMAP'S OWN REMEDIES WERE WRONG, AND BOTH IN THE SAME WAY —
they named a fix without measuring the mechanism.**

1. **`camDist = camDistTarget = sp.dist || sysCAM_DEF` would delete the
   player's wheel on every border crossing.** `camDistTarget` IS the wheel and
   a zoom is a preference. Set only `camDist` (the current value, which is what
   the first frame is composed from) and pass the same number to `frameShot`,
   which holds it for the place card and then hands the lens back. Measured
   after: reach 9.5 at 3 s in every chapter under both default and zoomed-out,
   and back to the player's 11.94/14.87 at 12 s.
2. **Antarctica could not be fixed with a bigger `dist`.** The boom was short
   because `sysCamClear` cut it to a QUARTER against the rock behind the animal
   — a bigger request is cut by the same fraction. The spawn had to move.
   z 52 → 48: 3.68 m/clear 0.25 → 11.9 m/clear 1.00, three repeats each.

**THE MEASUREMENT THAT NEARLY WENT THE WRONG WAY.** Two probes disagreed about
whether the arrival boom was inherited. The cause was mine: one of them did
`const o = {dist: <euclid>}; for (const k in camInfo) o[k] = camInfo[k];` and
**camInfo has its own `dist` key**, so the column silently became camInfo.dist.
Never spread an instrument's fields over your own computed ones.

**FIVE THINGS THAT WERE MEASURED, NOT REASONED:**
- Monte Carlo's chicane cones were spawned with `restY = road + 0.5`, and
  `restY` is the SURFACE a prop is laid on, not a clearance. All five were in
  the air, fell (3.98 m/s, all five at once — a fall, not a car) and rolled
  onto the racing line. The "car sweeps them" story was half wrong.
- The ownership gate needs BOTH cases to be worth anything: a cone driven into
  the basin with the animal 32.6 m away must not tick (proved), and one that
  goes in after the animal stood beside it must (proved). The first control
  run was inconclusive because the cone never reached the water — a negative
  that proves nothing is not a control.
- `.capyui-g` declares `--capyui-gbg` ON ITSELF, so a token set on an ancestor
  (`.capyui-btn`) is silently overridden. Custom properties on the element win
  over inheritance. The rule has to be `.capyui-btn .capyui-g`.
- **The touch layer's `.on` class is removed on the first keydown**, so a probe
  that presses Enter to start measures a fan that is `display:none` — all seven
  buttons read 0x0. Start with a tap: click the Begin button.
- `capyui-back` is TWO controls and the leak runs both ways. Scoping the card's
  rule fixed the touch mark (−2.00 px off centre → 0.00; the cause was the
  card's asymmetric `padding:4px 12px 4px 8px`, not only the 7px glyph margin).
  The touch block is still bare and eight of ITS declarations reach the card,
  so the pill that rule describes has never been drawn. Recorded, not fixed:
  it is a visual decision on a card with three passes behind it.

**Giving several elements the SAME z-index preserves their DOM order**, which
is why one rung at 40 for all eight pieces of HUD furniture changed nothing
about their stacking relative to each other — only relative to npc.js's bubble
pool, which now declares 30.

Instruments: `qa/f1-before.js`, `f1-cam.js`, `f1-ant.js`, `f1-ant2.js`,
`f1-ant3.js` (the three-repeat A/B), `f1-mon.js`, `f1-after.js`, `f1-gate.js`,
`f1-gate2.js`, `f1-touch.js`, `f1-soak.js`.

Verified: `npm test` 10/10, 19/19 driven soak with 0 NaN and 0 errors, frame
time 16.6–17.2 ms against a 16.5–17.0 baseline, build clean at 5609.2 KB.

Related: [[capy3-the-finish-review]], [[headless-qa-harness]],
[[capy3-the-title-pose]], [[capy3-instruments-that-cannot-hold-a-line]]
