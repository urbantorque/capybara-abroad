---
name: capy3-the-punctuation
description: "P4 — one chime for seven meanings, four silent payoffs, and the two AudioParams that must have exactly one writer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T12:06:44.654Z
---

Batch P4 of `ROADMAP-POLISH.md`, 2 Sep 2026, commit `abeebf0`. Contract section
**THE PUNCTUATION — P4**. The last of the four polish batches.

## THE STINGERS, AND WHY THEY COST NOTHING

`chime` was the payoff for a mini, an act break, a record at par, a personal
best, a near miss, a find, an incident, a chapter done AND the finale — nine
pitches — and it is an ambient bell in five ladders. A personal best and a plaza
bell were the same sound.

`musSting(kind, k)` builds a short figure from `musCurChord` through
`musLiftNote`, exactly as `musSwell` does. **No new synths**: it borrows the
chapter's own lead instrument, so it is in key by construction and a record in
Kyoto is a koto. `sysMUS_STING` holds five shapes (record, act, done, keep,
wear) as chord-degree lists.

**Velocity is `0.115 * vel`, which is the lift's own note velocity.** Authored
against the table it joins, not against its own envelope — the exact mistake R9
made with six ambient voices that were 5–10× too loud.

Every sting returns 0 and falls back to `chime` when no chord is sounding, so a
muted or not-yet-started score is unchanged.

## TWO AUDIOPARAMS THAT MUST HAVE EXACTLY ONE WRITER

This is the load-bearing lesson of the batch and it came up twice:

1. **`musBassGain.gain`** already had one per-frame writer on a 1.5 s constant.
   The chase-onset pulse is a TERM in that expression (`musChaseHit`), not a
   second `setTargetAtTime` — a separate write would be dragged back before it
   was audible.
2. **`musOutLP.frequency`** is written every frame by `sysSubSet`, *including
   while paused*. The pause card's filter lid is therefore a term in that same
   expression (`if (pauseShown && m > sysDUCK_HZ) m = sysDUCK_HZ`). My first cut
   set it from `musDuck()` and it was lifted again on the very next frame.

Corollary: the duck GAIN got its own node (`musDuckG`) rather than leaning on
`musVol`, because `musVol` is the player's fader. New node, one writer, graph
says what it does.

## THE WATER

No submerged state existed at all. One low-pass between `acSfxBus` and master
catches dry + room return + ambient bed + weather in one place; the score gets
its own, taken **less** far down (1400 Hz vs 620) because it is not diegetic.
Room send rises by `sysSUB_WET` too — water makes a space longer as well as
duller. Frequency is interpolated **exponentially** (`open * (closed/open)^t`);
a linear ramp from 20 kHz spends most of its travel in an inaudible octave and
then slams shut at the end.

Driven by `max(subT, capy.diving)`: the LENS under the surface (what the picture
grades on, null in chapters with no `sysSUB` row) and the VERB. A dive in a
chapter with no underwater grade still has to sound like one.

## A ROOM IS NOT ALWAYS A CHAPTER

`sysROOMS` was keyed by biome. A biome may now publish `room()` returning a key
into it; a key that is not a row falls back to the chapter, so a typo cannot
invent a space. Three authored: `basilica`, `salon` (the quietest send in the
game — a casino is built so nobody hears the next table), `deepcave`.

## THE AUDITS THAT MADE IT MEASURABLE

- `hud.mixAudit()` — the four AudioParams read off the graph. Asserting on
  `pauseShown` or `capy.diving` proves the game knows what is happening, not
  that anything reached the sound.
- `hud.stingAudit(kind)` — fires one figure, returns its note count. With the
  AudioContext prototype patched to count `create*` calls, that is the only
  thing about a Web Audio figure observable from outside.

## THREE PROBE DEFECTS

1. **A picker key is a one-based index** ([[headless-qa-harness]] trap 15) and
   it bit TWICE in one run: `Comma` is Antarctica (17) and `Period` is Monte
   Carlo (18), so the Monaco and cave room tests measured the wrong chapters.
   Caught only because `roomAudit` reports the room KEY and it read `antarctic`
   under a heading that said monaco. **Always return the biome/key in every row.**
2. **The casino floor is at y 28.** Teleporting to a point that had just passed
   `inZone('casino')` at ground height dropped the animal into the harbour, so
   the test that passed at search time was false on arrival. Place at
   `api.terrainHeight(x,z) + 1.5`.
3. **A search box has to contain the thing.** `monCASINO` is at x 118; the first
   sweep looked between −80 and 80 and reported no zone at all.

Verified: `audio2` green across 13 chapters with the score running; 19/19 soak
clean, 0 NaN, 0 errors, 0 record orphans.

Left as spill: flight/slide air, `sfxPurr` on the loaf, the Drift's two-line
ladder, and the `force`/volume-1.0 audit — additions to a mix that now has the
structure they would sit in, not defects.

Related: [[capy3-the-mix]], [[capy3-sounds-people-make]], [[capy3-the-chase]],
[[capy3-pad-and-card]], [[capy3-the-subject]], [[headless-qa-harness]]
