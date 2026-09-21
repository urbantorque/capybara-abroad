---
name: capy3-sleep-on-it
description: "N4+N5: the nap as a fourth reading of capyRestT, and the camera drift that was erased forty lines later by the same feature at a shallower tier"
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c28ee5-fd4b-4f8e-b699-73fd732dbf2e
  modified: 2026-09-08T14:46:36.155Z
---

Built 9 Sep 2026, ROADMAP-NEXT item 3. Code: `capybara.js` THE NAP,
`systems.js` THE NAP LENS / SLEEP ON IT. Instruments `qa/n4-nap.js`,
`qa/n4-shot.js`, `qa/n5-orbit.js`, `qa/n5-nap.js`, `qa/n5-rio.js`,
`qa/n5-frame.js`, `qa/n5-cap.js`.

**A FOURTH TIER NEEDED NO NEW GATE.** Settled, the calm, the loaf (6.5 s) and
the nap (26 s) are four readings of ONE number, `capyRestT`. The calm and the
graze each shipped twice with the wrong one of stillT/restT; a fifth busy list
would have been a third chance at it. Measured: loaf at 6.8 s, nap beginning at
26, full by 33, asleep again ~12 s after a wake.

**THE POSE IS FOUR CHANNELS THAT ALREADY EXISTED** — head +0.340 rad, ears
+0.325, model −0.045 m, breath 0.28 → 0.20 → 0.125 Hz. **The eyes needed
nothing new at all**: `capyFacePose` already takes a 0..1 "how closed", so a nap
is `Math.max(capyBlinkK(), capyNap)` — a blink that does not end.

**"ANY KEY WAKES IT" CANNOT COME FROM `capyRestT`.** A wheek, a grab that finds
nothing and opening the journal are all invisible to `capyBusy` and all three
are a player saying they are still there. `capy.wake()` is its own channel, and
`sysWake()` must be at the TOP of the keydown handler — four branches below it
return (title, album, ledger, pause card), so a wake placed after any of them
does not fire while somebody is reading, which is the one case that matters.

**`capyWakeT` IS ALREADY THE BOAT WAKE ON THE WATER.** The obvious name for the
hold-off timer would have silently stopped the rings spawning. It is
`capyNapWake`. Same shape as the B15 clash.

## The lens, and the finding worth remembering

**A DRIFT WRITTEN INTO `camYawTarget` WAS ERASED FORTY LINES LATER BY THE YAW
TIDY-UP.** Measured: twelve minutes of writing every frame, and the rendered
lens turned **0.003 rad and moved 4 cm**. The tidy-up ("put the camera behind
the animal once the player has stopped") is the SAME FEATURE AT A SHALLOWER
TIER — same trigger (`camIdleT`), same number, and it runs first. **A damper
against a constant drift does not lose; it wins at a fixed offset**, which
renders as a lens that looks slightly wrong and never moves. The deeper tier
takes the target and the shallower one stands down. Never write the orbit into
`camYaw` behind the tidy-up's back: that is a second writer on the rig's input.

**THE ORBIT NEEDED NO NEW CLIPPING PROTECTION** — measured before it was built,
as the roadmap demanded. 24 bearings × 19 chapters: cut in **10** chapters,
worst 0.257 (Rio 19/24 cut, mean 0.646; Venice; the Quay). That is
`sysCamClear` working. Three minutes of real sleeping in the worst three: 45%
of frames cut in Rio and **the eye never once within a metre of the animal**.

## The photograph

**`albAdd` BLITS AT 288×180 AND THE NAP LENS PULLS THE BOOM OUT**, so the shot
is composed 1.8 s early through `frameShot` and held. Two things were needed:
 - **`near: true`** lets a framed shot go below `sysCAM_MIN` (7 m, an
   INTERACTIVE floor) down to 3 m. Exactly `sysSHOT_DIST_MAX`'s argument from
   the other end; touches nothing else (no caller asks under 9.5 m, and the boom
   CUT renders at `sysCAM_CLEAR_MIN` 1.9 daily).
 - **A RAISE IS AN ANGLE, NOT A HEIGHT** (P1 again). With the boom at 3.18 m and
   `shotW` 1 the animal was still HALF OUT OF THE BOTTOM OF THE FRAME: the rig
   looks at a point above the animal chosen for a nine-metre boom. `raise` is
   the channel and **no shot in the game had ever passed one**.

**IT MUST RENDER BEFORE IT READS, IN ONE JS TURN**, like `photoShoot` — no
`preserveDrawingBuffer`.

**THE ALBUM NEEDED A TAG BEFORE IT NEEDED ANYTHING ELSE.** `albAdd(place, cap,
tag)`: tagged rows have their own cap (8) and are evicted first when the album
is over its global 36, so a hand-taken picture is safe by construction.
Measured: 18 nap shots over 28 minutes settle at 8 and never grow, 53 KB.

**The people reacting to a sleeping capybara was already built** — B7's
photograph gesture fires at a nap exactly as at a loaf.

**Probe note:** a wake test must not press **J**. The journal PAUSES the game
and `paused` skips every module except systems.js, so capybara.js is not ticked:
`restT` frozen at 43.8 for five samples and the nap unchanged, which reads
exactly like a dead wake channel. Use Q. And an evaluate longer than ~30 s dies,
so a 28-minute soak is seven of them.

Related: [[capy3-the-perch]], [[capy3-the-subject]], [[capy3-the-resting-lens]],
[[capy3-the-lens]], [[headless-qa-harness]]
