---
name: capy3-catch-all-state
description: "The capy3 NPC bug where a state machine's catch-all rung names the state its first rung is timing, so the timer resets every think and can never expire"
metadata: 
  node_type: memory
  type: project
  originSessionId: 86e0d10e-7c57-4cdd-92c0-e6e37cbbccaa
  modified: 2026-08-20T03:23:03.374Z
---

Found 20 Aug 2026 by measurement, not by reading. Two of Pasto's four kinds had it and it
had been shipping since the chapter was written.

`paThink`'s per-kind chains are written as: *in the resting state and the timer is up → move
on; in the transit state → arrive; **anything else → go to the resting state***. The last rung
is a catch-all and it NAMES THE RESTING STATE — so a record that is in the resting state and
whose timer is NOT yet up falls past the first two rungs and lands on the third, which calls
`paSet(rec, restingState)`, whose whole job is to zero `stateT`. The brains are staggered
(three records per frame), so the timer was reset about ten times a second and could never
reach six.

    farmer      st === 'work'  → timer pinned at 0.0 → three farmers stood on their spawn
                points for an entire session. Never walked to a different coffee bush, ever.
    churchgoer  st === 'pray'  → the OTHER failure of the same line: the catch-all sends a
                praying churchgoer DRIFTING on the next think, so the 6–15 s of praying the
                first rung carefully times never happened once.

The fix in both is one clause: `else if (st !== 'return' && st !== <resting>)`. The vendor is
the counter-example that was always right — its fidget uses `rec.fidgetAt`, sampled once, and
its chain has no catch-all at all.

**THE SIBLING BUG, SAME FILE, EIGHT SITES: `rec.stateT > rand(2.5, 7)`.** That reads as a dwell
of two and a half to seven seconds and is not one: the threshold is REDRAWN on every think, so
the first low sample wins and the distribution collapses onto its own floor. Measured on
tourists before and after: idle dwells went from n=3 samples spanning 3.35–4.63 s (mean 3.84)
to n=11 spanning 2.95–7.15 s (mean 5.30, median 5.27) — i.e. from "everybody moves on the same
beat" to the variety that was authored. `npcDwell(rec, t, a, b)` draws once per state entry;
`setState` and `paSet` clear it, and firing clears it for the two callers that reset their own
timer instead of changing state.

**The detector for both is the same and it is cheap:** soak a biome for 40 s with the capybara
parked far away, and for every NPC record the set of states it visited and the distance it
travelled. Anything that visited ONE state and moved < 1 m is either scenery (the seated
patrons, the busker) or a bug. `qa/npchealth.js`.

Related: [[capy3-shared-module-blindness]], [[headless-qa-harness]]
