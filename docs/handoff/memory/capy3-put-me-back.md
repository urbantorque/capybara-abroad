---
name: capy3-put-me-back
description: "capy3's stuck-rescue, and why 'the last place I was grounded' is worth nothing in the only case it exists for"
metadata: 
  node_type: memory
  type: project
  originSessionId: 86e0d10e-7c57-4cdd-92c0-e6e37cbbccaa
  modified: 2026-08-20T03:23:47.555Z
---

Built 20 Aug 2026. Thirteen worlds of hand-authored geometry, a solver, a step-up assist and a
climb: props had a fall-rescue and the capybara had a fell-out-of-the-world floor, but a
capybara stuck INSIDE the world had no answer at all except reloading the page — which, since
the save keeps the checklist and not where you were standing, also costs the walk back.

Hold `R` for `sysBACK_HOLD` 0.55 s. Nothing is undone: no task, no record, no clock. Being
stuck is not a mistake anybody should be charged for.

**THE OBVIOUS IMPLEMENTATION IS WORTH NOTHING.** "Remember the last grounded position" puts the
animal straight back into the gap it is trying to leave — a wedged capybara IS grounded, and it
is grounded THERE. The evidence that a place is escapable is that the animal was MOVING through
it, so a breadcrumb is only dropped above `sysBACK_SPEED` 1.2 m/s, every `sysBACK_EVERY` 1.4 s,
and the rescue takes the OLDEST of `sysBACK_KEEP` 3 — about four seconds of walking back up the
road rather than one step. Measured in Sydney: walked z 22 → 42.8, rescued to z 28.

Nothing is stored while swimming, diving, climbing, carried, at a wheel or on the condor: every
one of those is a state whose height or heading is solved by something else, and a crumb from
inside one is a crumb inside a wall. The rescue itself refuses while `transBusy` or mounted,
and clears `capy.carriedBy` first — otherwise the frame after the teleport drags the animal
straight back into the gardener's hands.

**AND THE TRAIL BELONGS TO ONE WORLD.** Every biome is authored in the same coordinates, so a
crumb dropped on the Corso is a point inside a basilica once Venice is attached. Cleared on
`biome:enter`, along with the hold and the latch. Same rule as everything else in
[[capy3-shared-space-leaks]].

`teleportCapy` already existed and does the whole job — body, previous/interpolated transform,
velocity, force, torque, the render mirror, the camera rig and the shadow follow. The rescue is
a 120 ms white blink rather than the travel fade: this is a stumble being tidied up, not a
journey, and `sysFADE_OUT` + `sysFADE_HOLD` would make it feel like one.

Related: [[capy3-the-paper]], [[capy3-shared-space-leaks]], [[capy3-external-forces-on-the-capybara]]
