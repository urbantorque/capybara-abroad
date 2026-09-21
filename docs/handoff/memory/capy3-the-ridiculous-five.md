---
name: capy3-the-ridiculous-five
description: X1–X5/N1/L1–L10 (11 Sep 2026) — five vehicle/boss marquees on the parked-at-the-helm pattern; the notoriety ladder made legible; what each toy had to learn
metadata: 
  node_type: memory
  type: project
  originSessionId: 2fb1f952-10b8-48b0-92a5-c0aa28996afa
  modified: 2026-09-11T12:22:27.595Z
---

Five marquees became vehicles or a boss: THE GRAND PRIX (Monaco, a rail
racer), THE HELICOPTER (HK, rings over the harbour), THE JETPACK (Marrakech,
fuel hops to the minaret), O GRANDÃO (Pantanal, a three-round boss inside
the crossing), THE PHO RUN (Hanoi, a free-driving Cub on the four lanes).
The notoriety tiers (a rumour…a natural disaster) now move the chain's rungs
and are announced on a card with the one thing they change (`sysNOTO_DOES`).

**Why:** the user asked for "ridiculous" over-the-top marquees, each unique,
and for the five banded ratings to have a purpose the player can see.

**How to apply:**
- The vehicle pattern is the tender's: module-owned position/velocity,
  `capy.atHelm = true` (the helm pose), write `capy.body`/`capy.group` every
  frame, publish `rideYaw()` + `rig()` for the chase camera (systems reads
  any live biome's `rideYaw` now), and let go in `onExit`. Debug hooks take
  `{take:true, x,y,z}`.
- A floor test needs the sign of vy (`y <= floor && vy <= 0`), or a burn
  from standing never takes off. A lap is a distance, not a seam crossing.
- The chase camera clips: put grids on open straights, sit above awnings
  (Hanoi 7.5 m @ 32°), give open cabins low sills — the lens is behind and
  above; the helm-pose model hangs ~0.7 m below the body position.
- `game.slowmo(scale, s)` is the cheap "held beat"; `game.confetti(x,y,z,n)`
  is exposed for modules; the chain's amber comes from `npc:march`.
- The march is OWED (`marOwed`) when the go rung is refused for `gest` —
  the incident card's line blocked every fresh-save marcher at four.
- `qa/w1-condor.js` is flaky under load (the grab at 1 m altitude drops);
  run it twice before believing a failure.
- See [[capy3-the-big-ones]] for W1–W5 and [[capy3-the-mix-measured]].
