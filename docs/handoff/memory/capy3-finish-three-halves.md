---
name: capy3-finish-three-halves
description: "F3b — the scrape whose gate was a tremolo, why a break is eight bars in Cali and sixteen in Rio, and the crossing defect that was the grid and not the tempo"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3438c0a0-f668-4a46-aecf-4e1f8f98ae17
  modified: 2026-09-06T01:36:08.787Z
---

Batch F3b (`1f32038`), 6 Sep 2026: the three items `ROADMAP-FINISH.md`'s F3
shipped in part, finished. CONTRACT.md carries the F3b section at the top.
See [[capy3-finish-two-and-three]].

**THE ONE THAT MEASURED WRONG: `grounded` IS NOT CONTACT.** The slide scrape's
first cut gated on `capy.grounded` and came out as a **tremolo** — at 7.4 m/s a
sliding body reports contact on **every other frame**, so the gain was
commanded between 0.26 and 0.0001 thirty times a second. Measured over four
real slides: on flat lawn `capySlideAir` is **0 for every frame of the slide**
(all the chatter is in `grounded`), and the only non-zero airtimes — 0.10,
0.13, 0.27 s — were the run crossing the Opera House podium edge, a real hop.
**That chatter is the whole reason `capySLIDE_AIR` exists.** Any sustained
voice gated on ground contact must read the accumulator the movement code
already forgives its own chatter with, not the flag. Publish the accumulator,
not the boolean, so a reader cannot re-introduce it.

**A PARAMETER MOVING IS NOT A NODE BEING HEARD.** Every other check in this
batch would have passed on a Web Audio node that was created, driven and never
connected. The proof is an analyser on `game.music.bus.out` (the master, where
everything audible is summed): master RMS **0.0686 running → 0.0798 sliding**,
and sliding *removes* the footfall voice, so the whole rise is the new one.
Do this for any new sustained voice.

**A BREAK'S PERIOD IS MEASURED IN TIME, NOT BARS.** Rio's paradinha is every
sixteen bars because a samba bar is 0.909 s (14.5 s a break). Cali's is every
**eight**, because a salsa bar is 2.4 s and sixteen would be 38 s — and eight
is a whole montuno phrase, four two-bar chord cells. Copying the modulus
across would have been copying the wrong invariant. What drops in salsa is the
**campana and the tumbao** (the campana IS the timekeeper of the band); clave
and congas carry, montuno vamps over. Verified by bucketing audio-node
creations by `barIndex % N`: 36–39.5 a bar against 29 on bar 7.

**THE CROSSING'S DEFECT WAS THE GRID, NOT THE TEMPO.** The roadmap said "two
tempos overlap"; the real fault is that the palette swap inside the held white
does not touch `musBarAt`/`musBarAnchor`/`musBarIndex`, so the **destination's
band inherits the departure's bar line and phase**. Holding the scheduler
under `transBusy` is only half — the other half is `musBarAt = 0`, because
after the loop `musBarAt` can be a bar plus a look-ahead in the future (2.4 +
0.7 s in salsa) and would survive the whole 1.28 s crossing without
re-anchoring. `musBeatLen = 0` with it: `game.music.beats()` publishing -1 is
the honest answer while there is no band, and every consumer already gates on
`music.playing` (cali.js, capybara.js) or watches for a stalled clock
(kowloon.js). It is bit-for-bit what `musTick`'s own no-rhythm path already
did. Cali→Rio: held at 152 ms, still held through the swap at 1220 ms,
re-anchored at 1591 ms on samba's own 0.4546.

**A PROBE THAT DRIVES THE ANIMAL MUST CHECK IT MOVED.** The airtime probe
turned with `KeyD` between runs, drove into the harbour on run 1, and reported
five slides that never happened as five clean results. Movement is
camera-relative, so a different KEY is a different heading; record entry speed
and position and discard runs that never reached `capySLIDE_MIN`.

Instruments: `qa/f3b-scrape.js`, `f3b-air.js`, `f3b-break.js`,
`f3b-break-rio.js`, `f3b-cross.js`, `f3b-rms.js`, `f3b-soak.js` (rv-long with
`KeyG` in the driver). `game.hud.mixAudit()` gained `scrape`/`scrapeG`/
`scrapeF`; `game.musAudit()` gained `beatLen`/`barAt`/`busy`.

Related: [[capy3-finish-two-and-three]], [[capy3-finish-batch-one]],
[[capy3-the-finish-review]], [[capy3-the-mix]], [[capy3-the-feel-pass]],
[[headless-qa-harness]]
