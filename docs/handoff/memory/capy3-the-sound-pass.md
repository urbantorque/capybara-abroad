---
name: capy3-the-sound-pass
description: "S1b, S2 and M1 — the flock, the beds, the arrival phrase, and the four instruments that lied about them"
metadata: 
  node_type: memory
  type: project
  originSessionId: f24204dd-387e-401f-8434-cfc9585dc5c6
  modified: 2026-09-06T14:09:19.585Z
---

6–7 Sep 2026, commits `3ec97d6` (S1b+S2) and `33795ba` (M1), after
[[capy3-the-mover]]. **`ROADMAP-AUDIO.md` is now closed — A1 through A6 all
built.** Contract sections: *THE SOUND PASS — THE REST OF THE WORLD, AND THE
FLOCK* and *— THE PHRASE, THE SKY, AND THE SECOND VOICE*.

## THE THINGS WORTH KEEPING

**A FLOCK IS PURE MOVEMENT, AND THE MOVEMENT IS NOT IN A VOICE — IT IS THE
DIFFERENCE BETWEEN VOICES.** `game.wingburst` puts a wing-clap at each of 6–14
instants, each placed where the birds actually are at that instant, with its own
panner. No handle, nothing to update, nothing to clean up. **It costs ONE voice
slot, not fourteen**, because what makes mud is a burst of UNRELATED starts and
these are one gesture — measured: three bursts of twelve, 0 voice drops.

**`game.flock` WAS THE OBVIOUS NAME AND IT WAS TAKEN.** `flockOffer`,
`flockSfx`, `flockKinds`, `flockAt` are the HERD (capybaras that follow you).
Grep the whole vocabulary before naming a public API in this file.

**A RHYTHM IS THE THING THAT SURVIVES A KEY CHANGE.** The arrival phrase is
long–short–short–long plus a contour (chord degrees 0→1→2→1), never pitches —
which is why it is one idea across 21 palettes and 12 different instruments and
cannot be out of key. Same construction as the lift and the stings.
**It fires 550 ms after the teleport, not on it**: the palette is set by the
`biome:enter` handler, so a figure fired on the teleport frame is built from the
chord of the chapter being LEFT.

**AN ANSWER IS NOT A HARMONY.** A6's second voice replies a chord tone below, a
beat later. Two voices together are a thicker pad; a voice that replies is a
second musician. 14 palettes have one; the five bands and the title get `null`,
because a band already is the second voice.

**THREE THIN TABLES KEYED BY PALETTE INDEX** (`sysMUS_2ND`, `sysMUS_PHRASE`,
`sysMUS_SKYCUT`) rather than 21 new keys inside `sysMUS_PAL`. That table is the
composition; keeping the layers out of it puts "what answers what" on one screen
and moved nobody's `pal` number. Needed `musPalN`, set on the same line as
`musPal`.

## THE FOUR INSTRUMENTS THAT LIED

1. **`biome.switchTo` DOES NOT RELOAD MODULES.** A page opened before an edit
   reported six chapters of new movers as missing — six confident false
   failures. **The tell is `builds` not moving.** Reload between editing a
   chapter file and probing it.
2. **`oct` IS SEMITONES IN THE STING TABLE AND SOMETHING ELSE IN THE LIFT ROW.**
   The Quay's phrase was authored `oct: 2` copied from its own `lift`, which
   means a TONE there; all four notes fell outside the chord. **1 of 21 failed
   and 20 passed** — exactly the shape of error that survives a listen.
   `hud.phraseAudit(n)` computes the notes without playing them and checks PITCH
   CLASS (a fold may change the octave and may never change the note), so all
   21 sweep in a few hundred ms instead of four minutes of chapter switching.
3. **A SHOWER IS A DICE ROLL ON A 56–130 s TIMER**, so a probe that arrives and
   looks measures a dry chapter every time. `game.weather.set(name, {rain:{odds:1,
   peak, hold, gap}})` + `rowOf(name)` is the hook (`qa/wx-fuzz.js` pays for this
   same lesson). **AND FORCING IT ON IS ONLY HALF — THE FORCING PARAMETERS ARE
   PART OF THE EXPERIMENT.** At `odds: 1` it still read 0.000 in five chapters and
   A5's rain terms went into the contract as never observed above zero. They were
   fine. `wxEnvelope`'s `rise` is **0.22 of the WHOLE hold**, so the `hold: 90` I
   passed bought a 20-SECOND ATTACK and the probe looked 4 s into it. `hold: 14`
   plus a sampler (`qa/rain.js`) resolves the term exactly: `skyCut` = 180·rain to
   three chapters' worth of decimals, `skyVel` = 1 − 0.08·cloud to four.
4. **A SINGLE-QUOTED BASH HEREDOC KEPT EATING THE PATCH SCRIPTS.** Three
   failures on content with apostrophes and backticks. Write the script with the
   file tool and `node qa/_x.cjs` it; and note that a path inside JS is NOT
   MSYS-translated (`fs.readFileSync('/tmp/x')` becomes `C:\tmp\x`) even though
   the same path as a CLI arg is.

## WIRED

Movers: Sydney's van + floatplane, Hanoi's three nearest scooters, Monte Carlo's
silver car (S1a); the Freshwater, both bondes, the Kowloon bus (S1b). Beds:
Hanoi's ring road, Manly's break, the Uji, the Antarctic colony, Rio's parade.
Flocks: Sydney's figs, Pasto's vencejos, Venice's pigeons, Marrakech's storks
(wired at the muezzin RUNG in systems.js, because the anchor table has already
resolved the minaret's point and a second copy of it is a second thing to fall
out of step), Antarctica's colony, and Kyoto's heron as a single `spread: 0`
wingbeat.

**The Freshwater has since been heard** (7 Sep, `qa/freshwater.js` +
`qa/freshwater3.js`): gain 0 outside `far`, monotonic inside it, peaking 0.220 at
11 m; Doppler **1.0256 closing / 0.9756 leaving at 8.32 m/s** against a predicted
1.0249 / 0.9763, and **exactly 1.0000 while she sits at the wharf** — which is the
sample worth having, because it says the term is driven by relative velocity and
not by proximity. **Probing her needs a poll until `speed > 2`**: she is on a route
with STOPS, and a heading derived from one short sample catches her dwelling often
enough to park the ear 200 m up a track she was never on and produce a clean,
plausible flyby with no approach in it.

Related: [[capy3-the-mover]], [[capy3-the-sound-review]], [[capy3-the-mix]],
[[capy3-the-lift]], [[capy3-two-runs-one-tree]], [[headless-qa-harness]]
