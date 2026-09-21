---
name: capy3-the-wall
description: "R6 — mercy that saturates, and the three ways a difficulty measurement lies to you"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1945dbd8-cc52-47cc-a02f-21d96d647160
  modified: 2026-09-01T13:16:41.906Z
---

Batch R6 of `ROADMAP-RELEASE.md`, committed 1 Sep 2026 (`e11c2f7`). The salsa
floor in `cali.js` was the game's one true wall: 114 ms window, eight
consecutive, one miss to zero, no assist. Rio's samba column is the comparison
that proves it was the outlier — 0.24 beats and a target of 6 against Cali's
0.19 and 8.

**The rule, and the two things it deliberately does not do.** `caliWindow()`
returns `caliBEAT_WINDOW * 1.15^min(caliMercy, 4)`; `caliMercy` increments only
in the *miss* branch, only while `!caliDanceDone`, and resets to 0 the frame the
target lands. The target never moves and nothing is drawn.

1. **It does not count being knocked off the floor.** `caliDANCE_DROP` lapsing
   the combo is already documented as not a punishment; a mercy that rewarded
   standing in the road would measure the wrong thing.
2. **It stops existing at the tick.** `salsa-dance` is one of the twenty
   measured records and the floor keeps scoring for ever afterwards — a combo
   set through a 200 ms window is not the same number as one set through 114 ms.
   **Any invisible assist on a mechanic that also files a record has to switch
   off at the door, or the record stops being comparable between players.**

## Measuring difficulty: three ways the instrument lies

1. **ONE RUN PER CONDITION CANNOT TELL A WORKING ASSIST FROM A LUCKY SEED.**
   Attempts-to-clear has a geometric tail. The first baseline gave 9 attempts at
   σ=90; a second run of the same seed gave 5, and a third condition gave 2 both
   before and after. The fix: dump the dancer's **raw achieved offsets** (a
   property of the dancer, not the code) and replay them through both rule sets.
   The cooldown and one-step-per-beat gates depend only on *when* an act fires,
   so the set of judged acts is identical before and after — only the verdict
   changes, and a replay is exact. It matched the live run in 5/5 conditions.
2. **AN i.i.d. BOOTSTRAP OVER THOSE OFFSETS UNDERSTATES THE DIFFICULTY** — it
   said mean 3.3 attempts where the sequence said 19.3. The frame grid drifts
   slowly against the beat grid, so consecutive offsets share a bias and bad
   beats arrive in *clusters*; clustering is exactly what makes an eight-in-a-row
   hard. Resample by **circular shift of the whole measured sequence** (134
   realisations, real errors in real order), never by drawing singles.
3. **SAMPLING STATE AFTER THE FRAME READS THE RESET, NOT THE VALUE.** The probe
   read `mercy()` after `raw(dt,r)`, and reaching eight resets it inside the same
   frame that scores the eighth step — so every clear reported a 114 ms window
   and looked like proof the assist did nothing. Sample before the frame.

Also: **the ceiling had never once executed.** Across ten paired runs the
highest mercy reached live was 2, so levels 3, 4 and the cap were code nothing
had run. A σ=160 dancer walks the ladder — 131 → 151 → 173 → 199 ms — and clears
on the fifth. *A cap is not verified by the code being three lines.*

Results: σ=60 identical to the frame before and after (83% of those dancers earn
no mercy at all); σ=90 within-3-attempts 65% → 86%, p90 7 → 4; σ=120 mean 19.3 →
3.8 attempts.

## The condor was measured and left alone

Four scripted pilots on `thermal-peak` (`qa/r6-condor.js`), the steepest thing
in chapter 2. **The zero-input row is the calibration and the reason to believe
the rest**: `pasto.js` already records that an unsteered bird "never came closer
than 95.4 m" to the caldera, and hands-off reproduced it at 80.8 m. A pilot that
does nothing but point at the volcano clears it on the second ride; an
average-input one on the first, in 47 s. **No change** — which is what the
batch's conditional asked for.

The reason it is not a wall is worth keeping: **the flight model already carries
this batch's idea.** The flap fires automatically below 5.4 m/s of airspeed, so
the save arrives whether or not the player knows `input.honk` is bound to it in
flight. It never is taught — the mount toast says "hold on" — which is a
legibility note for R8, not a difficulty one, because neither pilot fails.

A hand-driven `g.tick` loop of that many frames blows the ~20 s execution-context
limit in one `page.evaluate`; the probe is a state machine on `window.__r6c`
pumped 2000 ticks a slice.

Related: [[capy3-the-thumb]], [[headless-qa-harness]], [[capy3-the-release-review]],
[[capy3-instruments-that-cannot-hold-a-line]]
