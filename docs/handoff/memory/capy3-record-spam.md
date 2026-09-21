---
name: capy3-record-spam
description: "The per-frame game.record() bug, the four remaining instances found in biomes 11-12, and the flush-on-the-edge shape that fixes it"
metadata: 
  node_type: memory
  type: project
  originSessionId: a7e9819f-9d20-4cd3-8ae5-7d5c12a5ac71
  modified: 2026-08-29T00:17:24.092Z
---

Found 29 Aug 2026 on a scheduled deep review of biomes 10-14 (venice, kowloon, palawan,
goreme, manly). Four live instances of a bug class this repo had already found and fixed
twice — the Pantanal cowbird and Göreme's `three-winds` — and nobody had grepped for the
rest of them.

**`game.record(id, value)` toasts AND chimes on every improvement** (`recordValue` in
systems.js, and only once a previous best exists — which is why it is invisible on a first
visit and deafening on a second). Handed a value that CLIMBS while an attempt is open, and
called every frame, it fires a personal best sixty times a second.

Measured with a wrapper counting calls and strict improvements, hand-driven ticks:

| site | calls | improvements |
|---|---|---|
| palawan `first-dive` — one 7 s dive to a 10 m seabed | 372 | **272** |
| palawan `sea-turtle` — 14 s alongside her | 750 | **749** |
| palawan `cathedral` — 12 s breath hold | 600 | **599** |
| kowloon `bamboo-climb` — 40 m of bamboo | not measured, same shape | |

That is ~1,600 toasts and chimes in forty seconds of ordinary Palawan play, on any second
visit, over the top of the chapter that is teaching its own new verb.

**THE SHAPE THAT FIXES IT** is `gorFlushPeak`'s, and it is worth copying verbatim:

- bank the peak of the CURRENT attempt in its own variable (not the session's best —
  `record` keeps that itself, so filing per attempt loses nothing);
- file it once on the edge that ENDS the attempt (surfacing, the grace expiring, leaving
  the zone, letting go of the wall);
- **and call the same flush from `onExit`**, or an attempt interrupted by travel is thrown
  away. That is the half that is easy to forget.

`palFlushDive` / `palFlushTurtle` / `palFlushBreath` in palawan.js and `hkFlushClimb` in
kowloon.js. After: 1 call, 0 improvements, at the end of the run. Proved with a differential
(`git stash push -- src/palawan.js`, close-all, re-open, same script).

**GREP FOR THE REST BEFORE ADDING ANY NEW ONE:** `grep -n "\.record(" src/*.js` and ask of
every hit whether the second argument can increase between two consecutive calls.

Also fixed in the same pass: kowloon's bakery queue used `damp` on a heading that switches
between −π/2 and π, so the served customer took the 270° way round twice per serve, for ever.
`dampAngle` — the seventh instance of that one. See [[capy3-fifth-pass-thirteen-fourteen-fifteen]].

Related: [[capy3-fifth-pass-ten-eleven-twelve]], [[headless-qa-harness]]
