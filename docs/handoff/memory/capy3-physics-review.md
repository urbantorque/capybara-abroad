---
name: capy3-physics-review
description: "The 4 Sep 2026 physics/camera/mechanics review — what the two player complaints actually were, and the three instruments that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7a666abe-b1b9-4e02-9f39-68135c09c341
  modified: 2026-09-04T02:40:27.036Z
---

Run 4 Sep 2026 after the player reported *"structures you can walk through"* and
*"the capybara sinks a bit too much into terrain"*. Five read-only audits, four of
them measured under `playwright-cli`. Output: **`ROADMAP-PHYSICS.md`** (seven
batches X1–X7 plus a shelf) and the five findings files in
**`qa/audit-2026-09-04/`**. Nothing in `src/` was touched.

**THE CONTACT MODEL IS CLEAN AND THIS CLOSES OFF THE EXPENSIVE FIX.** mass 30,
three r-0.34 spheres, gravity −24, stiffness 1e7 → static penetration
m·g/k = 7e−5 m, and the body reads y = 0.340 on flat ground to 3 dp in every
chapter. Every visible sink is render-side or collider-vs-picture. Do not go
looking at contact materials again.

**The sink is three things that ADD:**

1. **The landing spring is unstable below 13.5 fps.** `capyLandVel +=
   (−capyLand·capyLAND_K − capyLandVel·capyLAND_C)·dt` uses the raw frame dt with
   no sub-stepping, while the pop spring beside it IS sub-stepped. c = 27 → the
   damping term flips sign for dt > 2/c = 0.074 s. `game.tick` clamps dt at 0.1,
   so it rings instead of exploding: model local Y alternates −0.05 / −0.81 in
   nine chapters, 0.76 m peak to peak. **This is also why every sole measurement
   in every probe shows a ±0.30 alternation — it is the spring, not the ground.**
2. **Six chapters draw the ground on one lattice and collide it on another**
   (rio, kyoto, pantanal, manly, iceland, antarctic, cali, göreme). The earlier
   note saying rio and iceland divide exactly is WRONG — rio is 330/70, iceland
   460/86. A finer picture over a coarser collider cuts the chord under every
   crest, so the animal reads sunk on rises and never floating.
3. **The slope pose drops the model 0.25–0.31 m computed from the analytic law**,
   not from the facet the body rests on, so it adds to (2) instead of cancelling.

**Three surfaces, three answers.** `capyGroundY` returns the law; the body rests
on the heightfield facet; the player looks at the drawn mesh. The pose, the
stuck-rescue, the camera and the shadow each pick a different one. That mismatch
is the root of the Kyoto Uji teleport loop (rescue measures law, fires every
0.45 s while walking) and it is why the Pasto plaza rescue never fires (its
"not moving" test is a frame-to-frame delta and the limit cycle moves 0.13 m).

**The walk-through complaint is mostly PEOPLE, not buildings.** `addLocal` builds
each local with mass 0 and **no `type`** → cannon defaults STATIC; the shuffle
and retrieval then write `body.position` directly; `aabbNeedsUpdate` is raised
only inside `Body.integrate`, which returns early for static. So a local that has
walked away from spawn keeps its spawn AABB for ever and is walk-through until it
returns (measured in Hanoi: passed clean through at 0.24 m). One-line fix:
`aabbNeedsUpdate = true` after each position write.

**Three force bugs, all measured:** slip multiplies the STEERING TARGET not just
the cap (`slipSpeed = topSpeed·(1 + slip·1.65)`), so ice is an accelerator —
19.6 m/s sprint UP an 18° glacier, and snow at 0.18 is 30 % faster than paving.
`launch()` never spends the coyote window the jump block spends, so the grip
damper deletes the horizontal of every geyser/cable/throw in 7 frames (Strokkur
measured: 1.19 m/s → 0 in five frames). And the Sahara storm's continuous shove
compounds airborne: a standing hop lands 22 m downwind at 23 m/s.

**Camera:** the flight rig is gated `inPasto && condor.mounted` while
`condorHost()` accepts any chapter publishing `thermals` — and Rio does. So Rio's
condor flies under the ground rig. `agl` and the shadow box carry the same
`inPasto` assumption on adjacent lines.

**THREE INSTRUMENTS THAT LIED, all of which look authoritative:**
- `qa/px-ground-b3.js` reports kowloon −15.7 m mean and cali −144 m worst. Both
  are **20 m strips of collider past the last drawn ground** (kowloon draws to
  z 100 and collides to 120; cali draws to 150, collides to 170, bounds to 221),
  not lattice error. Real bug, wrong name.
- Every `soles` figure in every walk/pose probe carries the ±0.30 landing ring.
  Only the settled, standing, 60 Hz rows are worth reading.
- The controls sweep's odd rows (antarctic walk 1.76, monaco run 3.62, cali run
  4.94) may just be an obstruction at the spawn. Do not fix any of them until
  they reproduce away from the spawn point.

**Harness note added:** this repo's Bash tool intermittently hangs for minutes on
this machine when playwright chrome instances are left open; close every
`-s=` session (`close`, never `close-all` while other agents run) and prefer the
Grep/Read tools over shell `grep`/`cat` when it starts.

Related: [[capy3-under-the-floor]], [[capy3-lattice-not-element-size]],
[[capy3-external-forces-on-the-capybara]], [[capy3-solid-or-drawn]],
[[capy3-slip-and-sky]], [[capy3-the-second-flier]], [[headless-qa-harness]],
[[capy3-instruments-that-cannot-hold-a-line]]
