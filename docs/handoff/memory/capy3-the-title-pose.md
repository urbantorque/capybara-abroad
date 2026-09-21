---
name: capy3-the-title-pose
description: "T1 (5 Sep 2026): the title camera pose, the wash that was a lid, and the three ways a lateral framing offset measured wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: baff573d-bbf0-4095-850d-69d7b12bdd6f
  modified: 2026-09-05T09:50:46.708Z
---

Batch T1 of `ROADMAP-TITLE.md`, committed 5 Sep 2026 as `0e1c8d2` on `master`.
Contract section **THE TITLE, BATCH ONE (T1)**. T2 and T3 are still open.

**THE POSE IS A CANDIDATE APPLIED LAST, AND IT IS RELEASED BY THE SPAWN.**
`sysTITLE_*` + `titleT`, applied after the biome rig, the dive and the framing
layer. The interesting half is how it LETS GO: `titleT = 0` lives in
`teleportCapy`'s reset list beside `camClearF` and `skyEyeT`, because a
teleport is the signal that somebody else is composing this frame. Without it a
1.6 s ease out of a 16-degree lens lies over all eighteen composed chapter
arrivals. The only start that does not teleport is a **restore into Sydney**,
which composes nothing, and that is the one case the damp exists for.

**THREE WAYS ONE FRAMING OFFSET MEASURED WRONG.** All in the two lines that
slide the look target sideways to move the animal out from behind the card:

1. **A delta subtracted from a damped value integrates.** `sysLook.x -= ...`
   after the rig's own `damp(sysLook.x, lx, 5, dt)` removes 8 % of last
   frame's offset and adds a whole new one: it converged at ~12x the ask and
   projected the animal to NDC x **2.73**. Every term in a pose block must be
   `lerp(v, absoluteTarget, w)`.
2. **NDC spans 2, not 1.** A card `w` px wide on a `vw` px window reaches
   `w / vw` either side of centre. `w / 2 / vw` is the screen fraction and put
   every window under the clamp floor — the same bug from the other side.
3. **A fixed world offset is the wrong KIND of number.** 4.6 m read as NDC
   0.42 at 1920 and **1.64 at 390** (off screen), because a narrow aspect
   shrinks the horizontal field. State the target in the frame and solve:
   `side = nx * dist * tan(fov/2) * aspect`.

**THE BLUR WENT TO ZERO AND THAT WAS NOT THE PLAN.** `.capyui-title` was one
gradient to 84 % over `blur(5px)`. The A/B (0/2/5, `qa/TW-*.png` + corner
clips) said the card's edge reads exactly as well against a crisp pine as a
soft one: the separation comes from the card's own three shadows, the scrim
they fall on and a vignette, all local. `backdrop-filter` removed entirely,
which also drops a full-screen convolution per frame. **Judge a blur by whether
the thing behind it is still worth looking at, not by whether the card pops.**

**NOBODY TALKS OVER THE TITLE CARD.** One `if (!game.state.started) return;` at
the top of `sayBubble` in `npc.js` — the door before any state is taken, so no
slot, no `gest`, no `npcSpeak`. Baseline: peak 3 bubbles, **14 distinct lines
in 30 s**. After: 0 and 0, and 26 lines in the 35 s after Enter.

**A SINGLE SAMPLE PROVES NOTHING ABOUT A THING WITH A LIFETIME.** The first
bubble check read zero on the UNPATCHED build — it looked between two lines. A
bubble lives ~2 s; the probe now watches for 30 s at 2 Hz. Same family as
harness trap 18.

**Reduced motion was free**: the drift gates on `calmOn()`, which already
follows `prefers-reduced-motion` when the player has set no preference.
Measured 0.48 m over 7 s normally, **exactly 0** under reduce.

`window.innerWidth` in the camera update is a layout read in the render loop
(`web-design-guidelines` caught it); cached as `sysVW` on resize beside
`applyDPR`. `sysCARD_W` is now read by both `.capyui-card`'s `max-width` and
the pose.

**Instruments:** `qa/title-audit.js` (the before/after shooter),
`title-measure`, `title-yaw`, `title-side`, `title-blur`, `title-verify`,
`title-bubbles`, `title-calm`, `title-restore`, `title-dist`.

Related: [[capy3-the-title-audit]], [[capy3-the-front-of-the-game]],
[[capy3-light-on-the-shelf]], [[headless-qa-harness]],
[[capy3-external-forces-on-the-capybara]], [[capy3-the-lens]]
