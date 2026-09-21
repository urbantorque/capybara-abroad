---
name: capy3-the-airlight
description: "v48 — light in the air, the falloff that had no distance term, and the chapter that measured as a dead row and was not"
metadata:
  type: project
---

Ran 30 Aug 2026 after [[capy3-exposure]], on "do the light in the air next".
Commit `299a5d6`. Architecture is in **CONTRACT.md ➜ "THE AIRLIGHT (v48)"**.

**THE SECOND THING THE DEPTH TEXTURE PAID FOR.** The spill lights surfaces; the
air between the lens and them has no fragment, so it was drawn as nothing. Only
the composite can do it, because only the composite knows how far the air in
front of a pixel goes. `shared.js` now exports `spillUniforms()` — the LIVE
uniform objects, not copies — so one ranking a frame feeds both the surfaces and
the air and they cannot disagree about where the lamps are.

**A PROXIMITY FALLOFF IS NOT A SCATTERING FALLOFF.** First version asked only
"how close does the ray pass to the lamp", using the spill's own reach ramp.
Measured: **99.8% of the Mong Kok frame, mean +64 of 255** — a wash over
everything. It had **no dependence on how far away the lamp was**, and the camera
stands ten metres from a cluster whose reach is twenty, so every ray in the frame
passed inside that radius and scored identically. **The spill gets away with a
reach ramp because it measures from a SURFACE POINT, which is bounded; a view ray
is not.** Reusing a solved falloff in a new geometry is the trap.

The fix is the actual integral, `(1/dmin)·[atan((tMax−b)/dmin) − atan(−b/dmin)]`,
two atan per light. It falls with perpendicular distance, falls with the lamp's
distance from the lens, and accounts for how much of the segment lies near the
lamp — so a ray stopping at a wall in front of a lamp collects almost nothing.
**Cost came in at or below the ±0.1 ms noise floor** (Sydney, k exactly 0, read
−0.018), because `uSpillOn` is a coherent branch and `uSpillN` bounds the loop to
live slots.

**THE CAVE MEASURED AS A DEAD TABLE ROW AND WAS NOT.** Swept at its arrival
frame it read **0.00 at every strength** — indistinguishable from a published row
with no call site, which is the failure named in [[capy3-payoff-batch-one]]. The
chapter has **826 emitters**; the doline mouth simply has none within reach. Ten
metres from the brightest, the same value gave a peak of +216.

**Every visual pass in this game has been verified from the nineteen arrival
frames, and for a term keyed on local light sources that method returns a
confident false negative.** The probe that settled it (`qa/airlit-cave.js`) finds
emitters *the same way `sysSpillScan` does* — so it cannot disagree with the
system under test about what a lamp is — then teleports the animal and **ticks 90
frames**, because the pool is written from a live frame and `post.render()` alone
would rank against where the animal used to be.

**STRENGTHS WERE AN ORDER OF MAGNITUDE OUT BY GUESS** (0.20–0.34 authored;
0.02–0.04 correct). Third pass in a row where the first guess at a strength was
wrong by 4–20x — see [[capy3-the-leaf]] and [[capy3-exposure]]. **Sweep the
number; do not author it.**

Four rows: kowloon 0.030, monaco 0.035, iceland 0.028, cave 0.030. Switch is
`game.state.noAirLight` and it cuts. 16.5–16.8 ms median in all nineteen, 0
errors, `qa/fuzz.js` 19/19 clean.

**Still open from the same review:** shadow penumbra does not vary with caster
distance (`sysBIO_SH_RAD` is one number, 1.0 for seventeen chapters), and Son
Doong still has no leaf term because its vegetation is merged with the rock.

Related: [[capy3-exposure]], [[capy3-the-leaf]], [[capy3-the-depth-pass]],
[[capy3-presence-batch-two]], [[capy3-payoff-batch-one]]
