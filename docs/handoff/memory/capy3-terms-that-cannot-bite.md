---
name: capy3-terms-that-cannot-bite
description: "Three capy3 terms that were correct code and measured as doing nothing, and what the controller shape has to do with it"
metadata: 
  node_type: memory
  type: project
  originSessionId: d64d47e9-349d-4ec8-b5fe-04884a377f9c
  modified: 2026-09-10T12:36:31.439Z
---

From the depth Tier 4/5 pass, 10 Sep 2026. Three separate terms in three files
were written correctly, ran every frame, and moved the thing they were aimed at
by essentially zero. The cause is the same each time and it is worth recognising
on sight: **what the term is applied to, versus what shape of controller is
already fighting it.**

## 1. A cross-current against a bang-bang seek (pantanal, D4.13)

`panUpdateHerd` steers each follower toward its trail point at speed `sp`
REGARDLESS OF DISTANCE — `k = min(1, sp*dt/d)`. That is bang-bang, so any offset
smaller than `sp*dt` is closed on the very next frame. A 0.84 m/s current applied
to the follower's POSITION therefore holds a standing offset of about `flow*dt`,
which is nothing: measured, the line was strung over **16.09 m with the river and
16.14 m without it**. Raising the drag from 0.62 to 0.95 changed nothing, for the
same reason — the controller is not proportional, so the term cannot accumulate.

**The fix was to move the term onto the TARGET.** The trail is where the leader
WAS, and in moving water that place has drifted since; the tail aims at the
oldest point so it drifts furthest. Bow went to **9.36 m against 0.01 m cut.**
The physical story got better at the same time as the number did, which is
usually the tell that the new place is the right one.

## 2. A brake law borrowed from the wrong system (hanoi, D5.9)

Hanoi's follow term first reused the capybara brake's linear `(gap - 1.5) * 1.6`
on the reasoning that a jam should decay at the rate of the thing that caused it.
Two riders piled up at **0.0 m and 0.1 m** behind a pinned machine — inside it.
A linear cap asks for zero speed only once the gap is already gone, and a
follower damping at 2.2/s carries 2.7 m through the standoff. `sqrt(2*a*room)` is
the real braking-distance law and it reaches zero AT the standoff, not past it.
Also: make the brake quicker than the throttle, or the jam snaps instead of
clearing.

## 3. A lateral push into the middle of a torus (palawan, Tier 5)

See [[capy3-something-eats-something]]. Right force, wrong point.

## The recognition rule

Before believing a new term is dead, ask what else writes the same quantity in
the same frame and what SHAPE that writer has:

- a **bang-bang seek** (moves at a fixed speed toward a point) erases anything
  smaller than one frame of its own speed — put your term on the point instead
- a **damp toward a target** is proportional and will hold a steady offset, so a
  term applied to position survives there
- a **cap/min** (`vWant = min(vWant, x)`) is fine, but check whether the thing
  you are capping is even reached

And measure against the term's own absence, always — two of these three read as
"the feature is broken" for an hour before the control run said the code was
fine and the PLACE was wrong. Related: [[headless-qa-harness]] traps 40 and 41.
