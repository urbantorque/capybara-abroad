---
name: capy3-drift-air-and-gravity
description: "The numbers and the three traps behind capy3's ninth biome, the Drift — per-biome gravity, wind as a reference frame, and why the cloud has to be thirty metres down"
metadata: 
  node_type: memory
  type: project
  originSessionId: f7b0200d-c544-489a-b819-7d8b17bd2ac3
  modified: 2026-08-18T22:29:14.509Z
---

Built 19 Aug 2026. The Drift is floating islands over a cloud sea at a third of a gravity.
Four things about it were measured the hard way and none of them is guessable.

**1. GRAVITY IS SET ON THE WORLD, AND MUST BE PUT BACK.** `onEnter` writes
`game.world.gravity.y = -8.6` (against −24 everywhere else) and `onExit` restores it. Doing it
to the world rather than per-body is what makes dropped props float too. Leaving it unrestored
would make the Opera House steps unclimbable in a way nobody would ever diagnose — the
regression test is: switch drift → sydney → drift → iceland and assert −24 / −8.6 / −24.

**2. WIND IS A REFERENCE FRAME, NOT A FORCE.** capybara.js adds `game.drift.wind()` into
`platVX/platVZ` — the same channel the Quay ferry's deck uses — for an airborne animal. Every
other implementation is wrong: a force or a velocity write gets eaten by the controller's speed
cap (7.45 m/s relative), which is exactly what the cap is for. As a frame it is free of the cap
for the same reason the deck is, the airborne bleed damps toward the AIR (which is what drag
does), and world velocity is continuous across the frame you land on. **A column must shelter
you from it** (`driShelter`, wind × 0.2 inside): eight seconds of climb against 2.75 m/s of
drift is twenty-two metres and the shaft is ten wide, so measured, the lift quit at 74.7 m —
below the island it exists to serve.

**3. MEASURED JUMP REACH AT g = 8.6** (capyJUMP_V 6.0 + 0.2 s of 15 m/s² sustain):

    tap                4.7 m apex is WRONG — held hop apexes 4.4 m, hangs ~2.1 s
    held, at a run     15.5 m in calm       21 m downwind      10 m upwind
    held + one puff    23.7 m in calm       32 m downwind      15 m upwind

A gap that also CLIMBS collapses those numbers: landing four metres up cuts the usable flight
to 2.2 s and 22.6 m even downwind with a puff. The chapter's headline 25 m crossing is only
possible because the far side is **twelve metres lower**. Design gaps against the landing
height, never against the plan distance.

**4. THE CLOUD IS THE WATER, SO THE WORLD SITS THIRTY METRES OVER IT.** `capyFLOAT_Y` is a
constant (−0.42) and `wantSwim` is hardcoded at `y < 0.2`, so the waterline cannot be moved:
the islands have to go up instead. The first cut had decks at y = 0 and the drop off the spawn
island was eighty centimetres — the task "step off the end of the jetty" was a puddle.
`isOverWater` answering TRUE for every gap is load-bearing: it switches OFF capybara.js's
analytic floor backstop, which is what makes a hole a hole. And the recovery bloom has to make
its own patch of cloud **stop being water**, or the buoyancy spring pins the animal to the
waterline and no amount of lift moves it.

Also: islands must never overlap in plan (`driIslandAt` is single-valued and everything
resolves to it), and the jetty must not point at the next island — it did, and its eleven
metres of free bridge deleted the chapter's opening gap.

Related: [[capy3-progression-chain]], [[capy3-slip-and-sky]], [[capy3-visibility-metrics]],
[[capy3-biome-build-gotchas]]
