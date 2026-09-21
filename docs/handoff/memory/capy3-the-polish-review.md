---
name: capy3-the-polish-review
description: "2 Sep 2026 seven-agent post-release review, ROADMAP-POLISH.md's seven areas and four batches, and the three live measurements that shaped it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-01T22:06:30.296Z
---

Written 2 Sep 2026 after R1–R10 closed `ROADMAP-RELEASE.md`. Seven read-only
review agents (first hour, gameplay depth, feel/bugs, picture, audio, frame,
writing) plus three live measurements produced **`ROADMAP-POLISH.md`**: seven
areas, four 2–3 h batches (P1 subject, P2 pad and card, P3 the chase, P4 the
punctuation) and a sized shelf (P5 faces, P6 through-line, P7 drawn payoff, P8
under the hood). Nothing found is a crash or a wall; all of it is legibility.

**The three things measured live, and what they cost to measure:**

- **Canopies occlude the animal and the rig cannot see them.** Sydney at rest,
  (0, 51.5): two `environment` `SphereGeometry` fig canopies on the eye→capy
  ray at 7.7 and 11.4 m, `game.camInfo.clear` 0.80, animal off-frame for 20 s.
  `sysCamRayHit` is physics-only and canopies have no collider. A three.js
  `Raycaster` against `scene.children` ALSO returns hidden chapters (it does
  not honour `visible`) — filter by a registry, never the scene.
- **`sysCamRayHit` has no npc/local/kinematic skip** (verified in code; the
  climb ray has the ignore list it needs). Crowd pump not yet measured.
- **`biome.switchTo(name)` is a debug switch that bypasses the arrival**: the
  frame after it is the card mid-crossfade, the camera unsettled, and in
  Antarctica the eye under the deck. Never judge a chapter's picture from it;
  enter through the picker (reload → click the tile).

**Two blocker-class findings in code, both confirmed by grep:** slide is
`ControlLeft/Right` with `preventDefault` only on Space/arrows, so Ctrl+W
while sliding closes the tab (Chrome will not let it be cancelled — the legend
must move, to C); and `padPoll` knows Start/Back and nothing about `jrShown`,
so a pad-only player is stuck on the departures board R5 fixed for touch.

**Findings I would not have guessed:** `chime` is the payoff for seven
different things AND an ambient bell in five ladders; the pause card leaves
the band at full level (`musTick` gated only on `ac.state`); records are
invisible until 100 % (guarded by `done >= ids.length` in both the picker and
DONE HERE); the incident is never counted or saved; nine "be there when"
tasks ride 54–205 s clocks the paper never states; the in-card calm switch
does not reach `hitstop()` (main.js reads reduced-motion once at boot into a
private `calm`); minimum HUD text is 8.5 px; 41 % of the bundle is comments.

**Why:** the release pass fixed doors, saves and walls; what a stranger feels
next is whether they can see the animal, whether a pad works, and whether the
loop they are meant to chase has a number on it.
**How to apply:** start P1 with the idle-occlusion soak and the 19 picker
rest shots as the baseline; the roadmap names the spill for every batch
because R4/R8/R9 all ran long on the same 2–3 h estimate.

Related: [[capy3-the-closing-four]], [[capy3-the-release-review]],
[[capy3-the-resting-lens]], [[capy3-solid-or-drawn]], [[capy3-first-three-chapters]],
[[headless-qa-harness]], [[capy3-the-mix]]
