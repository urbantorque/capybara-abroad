---
name: capy3-the-lift
description: "capy3's marquee-moment payoff — why a celebration in a generative score has to be built out of the score, and the one-per-chapter rule"
metadata: 
  node_type: memory
  type: project
  originSessionId: 154f62c3-cf4e-4dab-9e76-bcb5605fc33c
  modified: 2026-08-19T21:48:02.105Z
---

Built 19 Aug 2026. Before it, all ninety-one ticks were identical: 'steal a hat' and 'bring the
sky down' both got one `sfx('tick')`, twelve scraps of confetti and a rounded toast.

**A STINGER IS THE ONE THING THAT CANNOT BE DONE HERE.** The score is generative, never stops,
and wanders through eleven palettes in different keys. Any fixed celebratory phrase is in the
wrong key roughly half the time and reads as a notification rather than as music. So the
celebration is made OF the score:

- three voices at MIDI 79/84/88 (an octave and a twelfth above the pad), pushed into
  `musVoices` so `musSetChord` voice-leads them like everything else — **they cannot be out of
  key by construction**;
- a rising arpeggio built from `musCurChord`, the chord that is ACTUALLY SOUNDING, so it
  resolves into the harmony instead of across it;
- the pad's own bus/filter/bass leaning in underneath.

It is per-place for free — Kyoto's D minor pentatonic in Kyoto, Mong Kok's A minor vamp in Mong
Kok — with no per-biome code at all.

**Two things that were nearly bugs:**

1. `musPad.gain` and `musFilt.frequency` have exactly ONE writer, the 0.3 s block in `update()`,
   which re-derives them from the live palette. Scheduling the lean-in from `musSwell()` looked
   right and lasted 300 ms before being overwritten. Fold it into the single writer and read the
   envelope there.
2. `sfxGap.cheer` is 3 s because Rio, Marrakech and Hong Kong all fire ambient cheers — so the
   once-a-chapter payoff could land inside somebody else's ambience and be dropped SILENTLY.
   `sfx(name, {force: true})` exists for exactly this and nothing else.

**Exactly ONE task per chapter carries `wow` in TASKS** (the value is the caption the banner
prints). Eleven rows in ninety-one, and the scarcity IS the mechanism — a second one in a
chapter halves what the first is worth. If a better set piece arrives, MOVE the flag.

`completeTask` pays it out, so the `silent` restore branch (which returns before the whole
celebration block) already means reloading a finished file does not fire eleven banners —
verified: 13 tasks restored, 0 place cards, 0 toasts.

`game.music.swell(k)` is published for the other half: set pieces with a BUILD, where the tick
lands at the end and the moment starts half a minute earlier. It takes the max of the live
envelope, so calling it every frame HOLDS the swell (iceland.js does this for the twelve
seconds the aurora is climbing). Every other set piece ticks at its own climax and needs
nothing.

**THE SECOND HALF, 20 Aug 2026: ONE GESTURE IS NOT THIRTEEN GESTURES.** The bed above is right
and is unchanged — the three sustained voices are "the room got bigger", which every marquee has
in common. What was wrong is that the FLOURISH was identical too: nine triangle plucks climbing
at 115 ms, whether the moment was a condor over Galeras or the Adriatic arriving in San Marco.
By the fourth chapter the player has learnt it and stopped hearing it.

Each of the fourteen `sysMUS_PAL` rows now carries a `lift: {inst, shape, n, gap, oct, vel, pan,
up, dn}`. Still built from `musCurChord`, so it still cannot be in the wrong key; played on the
PLACE'S OWN instrument (`musLiftNote` dispatches koto/mallet/bow/glass/quena/violin/pluck — the
five band palettes whose `lead` is 'none' name one explicitly). Six shapes in `sysMusLiftDeg`:
up, soar (gaps LENGTHEN — a bird that has stopped flapping), arch (closes, for the one palette
with real cadences in it), cascade (Kyoto's river and the Erg's dune are the two moments that go
DOWN), fan (both shores at once — Manly and Hong Kong), swell (gaps shorten; Rio only).

**Three bugs found doing it, all the same family — a formula only ever tested at n = 9:**

1. `musSwell()` scheduled a fresh arpeggio ON EVERY CALL, and iceland/goreme/palawan call it
   sixty times a second for twelve seconds to HOLD the envelope. ~700 overlapping runs, on the
   two palettes whose voices ring for ten seconds, during the quietest moments in the game.
   `musLiftArpAt` now gates the figure to once per moment; the envelope hold is untouched.
2. velocity `0.115 - i * 0.008` goes NEGATIVE at fourteen notes and silently truncated every
   figure longer than that. A velocity ramp must be proportional to n, not a fixed decrement.
3. octave stacking. Capping the octave COUNT is not enough: the chord tables span MIDI 33..82
   between them, so the same stack is a different note in each. The ceiling has to be stated in
   PITCH — `musFold(..., sysMUS_LIFT_LO, sysMUS_LIFT_HI)`, 60..96 — or Palawan's eighteen-note
   shimmer lands at 8 kHz. Measured, not guessed.

**And `swell` had two more customers than this note claimed.** It said "every other set piece
ticks at its own climax and needs nothing", which was true of eleven and false of two: Venice's
tide takes ninety seconds to cover the square and Hong Kong's far shore lights a tower per beat,
and both were doing it in silence. Both now hold the swell across the build, gated on being in
the square / above y 20 — a flood watched from the Rialto is weather, not a moment.

Related: [[capy3-progression-chain]], [[capy3-chapters-ten-eleven]], [[headless-qa-harness]]
