---
name: capy3-deck-is-not-a-wall
description: The camera occlusion ray treated the ferry you are steering as a wall — and what a sweep of all 19 chapters says about the boom cut generally
metadata: 
  node_type: memory
  type: project
  originSessionId: 23f9586c-2de7-4da3-a043-f344b918961e
  modified: 2026-08-29T12:10:24.558Z
---

**THE BUG (29 Aug 2026, v38).** `sysCamClear` in systems.js skips three things when it casts
the boom's occlusion ray: the capybara's own body, `capy.carriedBy`, and heightfields/planes.
Its own comment says "a boat, a raft or a floe is a floor rather than an obstruction" — and it
only ever implemented the `carriedBy` half of that. **Nothing declares a ferry.** You walk onto
it and stand on it, and a KINEMATIC hull is `mass === 0`, so it sails straight through the
`b.mass > 0` gate and is treated as solid.

Measured at Circular Quay, at the wheel, full ahead: the rig asked for **21.0 m** of boom, the
ray hit MV Wheek's own wheelhouse **0.84 m** out, `camInfo.clear` was **0.090**, the boom was
cut to the `sysCAM_CLEAR_MIN` floor and the eye sat **4.69 m** from the animal, 1.86 m up. The
entire voyage — the Bridge, the Opera House, the Freshwater, four hundred metres of harbour —
was played from inside the boat's own superstructure. Antarctica's tender did the same at the
tiller. So did simply STANDING on either deck. After: clear 1.000, eye 23.8 m back, 10.5 m up,
26.3 degrees.

**The channel is `capy.rideBody`** — the plain cannon body of whatever deck you are on:
* capybara.js's contact sweep captures it (`other.type === CANNON.Body.KINEMATIC`), taken
  BEFORE the two velocity gates, because a ferry lying alongside is stationary and still must
  not be a wall. Latched on its own timer (`capyRIDE_HOLD` 1.2 s) so a hop across the deck does
  not re-cut the boom, cleared by `launch()` and by grounding on anything static.
* **The two helms must set it themselves.** `capyUpdate` returns early when `capy.atHelm` — see
  the note over that return — so the contact sweep never runs at the wheel. `quayTakeHelm` and
  `antTakeHelm` assign `g.capy.rideBody` alongside `atHelm`. Any future helm must do the same.
* systems.js reads it as `sysCamSkipC`, the third skip.

**WHAT THE 19-CHAPTER SWEEP SAID (and it is not what it looks like).** `qa/camsweep.js` spawns
in each chapter, walks a square, and samples `game.camInfo`. The boom is cut in a lot of frames
— quay, kowloon, venice, manly, pasto, sydney, antarctic all between 16% and 65%, bottoming on
the 1.9 m floor in five of them. **Do not read those percentages as a defect.** Two findings:

1. **The occluders are WALLS, not ceilings.** A probe that classified hits as "above the eye
   line" said 100% above and that was the detector crying wolf: a hit 0.6 m up a vertical
   tong-lau wall is "above". A flat-boom candidate cast at 30% and then 5% of the rig's pitch
   was materially better in **0%** of cut frames in quay, kowloon, venice, sydney, cave and
   antarctic, and 4% in pasto. A whole "duck under the awning" feature was written, measured,
   found to fire essentially never, and **removed**. The pull-in is the right answer here.
2. **`camsweep.js` DOES NOT HOLD A LINE.** Three identical runs gave quay cut% of 51.4, 17.6
   and 87.8 — the walk path is not repeatable, so a ±35-point swing is the noise floor. It is
   fine for "does this chapter cut at all" and worthless as a before/after. An apparent
   "51.4 → 36.7 improvement" from the duck was pure noise. Same family as
   [[capy3-instruments-that-cannot-hold-a-line]]. The helm measurement, by contrast, is
   deterministic (park at `quay.boat.helm`, press E, hold W) and repeats to the centimetre —
   that is why it is trustworthy and the sweep is not.

Related: [[capy3-carriers-that-drop-you]], [[capy3-reference-frames]], [[capy3-lens-and-wall]],
[[capy3-the-resting-lens]], [[headless-qa-harness]]
