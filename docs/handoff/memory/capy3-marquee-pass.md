---
name: capy3-marquee-pass
description: "L5 (13 Sep 2026) — nineteen marquees each a notch higher; the four-way rule (a verb, a number, a second go, a frame), the gen-2 record rows, and six things the instruments said"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0226d491-c28d-448f-9b11-fb2f48593d58
  modified: 2026-09-12T17:38:07.033Z
---

The marquee pass on capy3 (branch lift-pass, commits L5-1..L5-4 + closeout,
13 Sep 2026). Asked for: score each chapter's marquee /10 on depth, wow,
interest, then lift each a notch to an average of 8+. CONTRACT.md's top
section is the record; ROADMAP-LIFT5.md the plan and the before-table.

**The rule that made nineteen lifts cheap:** a marquee is lifted by giving
it one of four things it lacked — a VERB (the manta's leap, the chiva's
sidestep, the pho horn, calls in rhythm, hoops in the drop), a NUMBER you
can be better at (the leap in metres, the landmark chain, the river gates as
seconds), a SECOND GO (pho run, jetpack, heli lap, lantern relit, every tide
higher), or a FRAME (slowmo + frameShot + `game.sparks`/`game.firework` +
swell at the moment). Scores went 6.8 → 8.1 by the same reading.

**Records whose unit changed carry `gen: 2`** in RECORDS (the-manta,
fragata-ride, aurora); startGame's restore drops a saved figure whose gen
differs (the save carries `recg`). The key must stay the wow task's id.

**`game.sparks` / `game.firework`** (systems, after confetti): the world
answering, biome-neutral; `game.sparksLive()` for probes. Additive squares
over 1.0 read blocky at size > 0.5 — spray wants 0.24–0.3 and a blue-white
under 1.5; shells 1.3–1.5 and n 44–56.

**What the instruments said:**
- The condor's tuck is a run, not a plunge: 20–21 m/s at 4–6 m/s sink from
  85 m. A "dive" threshold at 24 never fires; 19.5 / vy −4 is where only
  the tuck goes.
- A landmark link needs a "pass" gate (seconds aloft + came down from
  height) or the mount spot is a free link.
- The chiva's roof carry drifts a passenger across a corner (lx +1 → −0.6
  over 16 m); a probe that pins lateral must nudge, not zero velocity, or the
  animal falls off the back.
- A floating capybara's `depth` never reads > 0.2 at the surface; end an
  air-time record on `y <= water + 0.3` on the way down.
- The orca pod goes back to patrol if the boat is north of z −40 — force the
  escort only after ~7 s of full ahead from the berth.
- The escort's seconds ticked the orca marquee; the run resets the clock.
- Sydney's forecourt finds eight people within 26 m on a fresh file, so the
  "calls wider per note" only shows when the quay is emptier.

**Harness idioms this pass:** stepped flights with `g.tick(1/60,false)` and
`Q.lift(dy)` (teleport the bird+passenger up) make a two-minute condor
flight a second of wall-clock; `g.condor.summon()` twice (the second lowers
it) then E-loop to mount. The per-chapter hooks added: `palawan.mantaForce/
mantaAudit`, `hanoi.cubSet`, `env.encoreAudit`, `cali.chivaSet/roofPlace/
wireList`, `pasto.rideAudit`, `rio.chainAudit`, `quay.helmDebug/whaleAudit`,
`kyoto.runAudit`, `iceland.auroraForce/auroraCall/auroraAudit/auroraAge`,
`drift.lanternDebug`, `venice.tideAudit`, `kowloon.heliHome`,
`cave.colRings`, `monaco.raceDebug({lat,passed,dist,podium})`.

Related: [[capy3-fourth-lift]], [[capy3-the-big-ones]], [[headless-qa-harness]].
