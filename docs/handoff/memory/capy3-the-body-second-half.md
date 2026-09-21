---
name: capy3-the-body-second-half
description: "D8 — the climb pose, three kinds of carry, the star's face, the crowd's arm, the herd's legs, and the flail that never flailed"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60501ba9-888e-42ec-bf5f-6720ba5e13a0
  modified: 2026-09-03T10:31:13.617Z
---

D8 (3 Sep 2026), area 2's five remaining items — the last batch of
ROADMAP-DELIGHT, whose shelf is now empty. Contract section **THE BODY, SECOND
HALF — D8**; instruments `qa/d8-body.js`, `qa/d8-shots.js`,
`qa/d8-climbshot.js`, `qa/d8-herdshot.js`, `qa/d8-faceshot.js`,
`qa/d8-gestshot.js`, and **`qa/crop.cjs`** — a dependency-free PNG
crop-and-magnify. Follows [[capy3-wires-not-systems]] and [[capy3-world-life]].

**THE BUG WORTH REMEMBERING: THE FLAIL NEVER FLAILED.** The carry pose ran on
`capyLegPhase` — the GAIT's phase — and forty lines above it the gait, seeing an
animal that is not moving, damps that same variable toward zero at λ 6 every
frame. Two writers on one channel, and `+14·dt` against `−6·w·dt` has a
CONSTANT fixed point: w = 14/6 = 2.33 rad. Measured, the four legs reach 0.45,
−0.21, −0.68, −0.52 within half a second and never move again — nineteen
versions of a rigid capybara being carried off at a slight angle, under a
comment reading "flail, don't stand serenely". **A pose that borrows another
pose's phase variable will be quietly dominated by that pose's own filter.**
Give it its own. Same family as [[capy3-springs-are-clipped]]'s two-writers
trap on `mesh.scale`.

**A DECLARED VARIABLE IS NOT A DRAWN ONE.** `capyClingT` was declared "s spent
on the current hold, for the pose" in v31 and read by nothing; what a clinging
animal got was the AIR TUCK, because clinging sets `grounded = false` and that
is what not-grounded means everywhere else in capybara.js. Grep for the
declaration comment, not for the feature.

**A CARRIER HAS TO SAY HOW IT HOLDS YOU.** `carriedBy.hold` — `arms` (the
gardener, flail for the whole two seconds), `talons` (the condor, 1.2 s of
flail then a hang with a 0.31 Hz sway), `ride` (Palawan's manta, no flail at
all, four legs braced). Before this, riding a manta ray drew a capybara
pedalling the open water. **Look for verbs that share one state flag between
carriers of completely different kinds.**

**One channel, one function, but not one FUNCTION for two shapes.** The
capybara's face reuses `npcFace`'s constants and its asymmetric damping (15 in,
3.2 out) and deliberately not its code: the crowd has one eye node and a fringe,
the capybara has two beads in two rotated sockets. Same argument `localsChat`
makes about `chatStep`. And the brows go IN THE EYE SOCKETS so they inherit each
eye's outward yaw — two bars on the skull drift off the eyes as the head turns.

**`sayBubble` is the one place every human line goes through**, so a per-speaker
clock belongs there and should be set to `slot.life` — the bubble's own length —
rather than to a second hand-tuned constant that would drift from it.

**D2's cadence law generalises.** π·v/stride out of the animal's own speed, with
stride = 2·hip·sin(swing). The Pantanal herd's fixed 8 rad/s bob was right at
one speed out of a 1.05–8.5 m/s range. **Put the bob on the same clock as the
feet** — a body rising on a different beat from the feet is what "sliding" looks
like.

**AND DO NOT REPORT A TAUTOLOGY AS A MEASUREMENT.** D2's skate ratio is right
for the player, whose speed comes from a solver. For the herd the cadence is
DERIVED from the speed, so the ratio is 1.000 by construction and proves
nothing. Report footfalls a second instead — a number that can be held against
the one it replaced.

**FOUR CAMERA TRAPS IN THE PROBES** (all in [[headless-qa-harness]]'s family):

1. `frameShot` always looks at the ANIMAL, so photographing a PERSON means
   standing the capybara PAST them with the lens on the far side.
2. The first climb shot fired after the probe released the key: a photograph of
   a capybara standing on a bin. Screenshot WHILE the thing is happening.
3. `input.camYaw` is the bearing from the animal TO the camera and nothing
   published the animal's own facing — `animAudit().yaw` does now.
4. Some of this game is 2 cm across. `qa/crop.cjs` (nearest-neighbour, no
   dependencies) is how a 7 cm brow bar gets sited: 0.064 above the eye puts it
   on the brow crest, 0.050 overlaps a 9 cm bead, 0.060 is right.

Related: [[capy3-render-pose-heuristics]], [[capy3-faces-and-bodies]],
[[capy3-external-forces-on-the-capybara]], [[capy3-the-herd-anywhere]],
[[capy3-sounds-people-make]]
