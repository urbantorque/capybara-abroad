---
name: capy3-the-sound-review
description: "The 6 Sep 2026 audio-direction review — eight findings, ROADMAP-AUDIO.md's six no-regret items (mover, axes, flock, arrival phrase, sky, second voice), and HANDOFF-AUDIO.md"
metadata: 
  node_type: memory
  type: project
  originSessionId: f24204dd-387e-401f-8434-cfc9585dc5c6
  modified: 2026-09-06T12:58:04.276Z
---

Ran 6 Sep 2026 after the character pass (`ee4a0b2`), as a code-and-instrument
audit (nothing was listened to). Wrote `ROADMAP-AUDIO.md` (review + roadmap)
and `HANDOFF-AUDIO.md` (per-team work order); neither committed. Published
as the "Capy3 Sound Review" artifact.

**The framing finding: the score was produced (v41) and the WORLD still
stands still.** Every sfx is a one-shot whose StereoPanner value is set once
at birth (`sfx()`, ~`systems.js:15750`); no handle, no `stop()`, and
`playbackRate` appears once in the audio code — **there is no Doppler
anywhere**. The only continuously-positioned sound in the game is the Cali
band (`musPlaceTick`, `systems.js:15404`): gain by distance, LP
`780 + 19220(1−t)²` with `t = over/62`, pan via camera-right, `setTargetAtTime`
0.16/0.20. That placer is the template for everything spatial.

**Eight findings, short:** F1 one-shots only; F2 pan is one axis (camera
right — no behind, no above); F3 the movers are silent or misplaced (Hanoi's
240 scooters have NO engine voice in `sfxTable`; Rio's bonde is an ambient
`tram` rung from the random ring; the condor arrives at `gull` volume 1.0
mono, `condor.js:1477/1492`; Monaco's car only hisses for its rider); F4 a
flock cannot scatter (the flush is two one-shots at the canopy); F5 no
continuous PLACE sounds at all — no surf line, river, crowd, traffic; the only
running sounds are the placeless weather bed; F6 the score reads eight
signals and not `game.weather` (17 moods, zero musical consequence) nor
per-chapter progress; F7 no melodic through-line — the 3.6 s arrival is a key
glide; F8 diegetic music is Cali only (deliberately left off the roadmap).

**The six items:** A1 `game.sfxMover` (handle, ≤4 live by delivered gain,
park not stop, Doppler `c/(c−v_r)` clamped ±12 %, on `acSfxIn`; "a mover that
does not move is a placed bed"); A2 `sysSfxBack`/`sysSfxUp` + ONE filter
inserted only past thresholds 0.3/0.35 so the common graph is bit-identical;
A3 `wingburst` — motion through many one-shots inside ONE `sfx()` call (one
voice slot, a panner per flap on a moving centroid); A4 the arrival phrase —
**a rhythm is what survives a key change** (long-short-short-long, degrees
0→1→2→1, via `musLiftNote` like the stings, in key by construction); A5 the
sky — three terms in the single writer; A6 `musChapProg` + per-palette
`second` voice gated at 1/3 done.

**Useful counts established:** ~144 `sysAmb` rungs; ~40 `sfxTable` voices;
~50 `mus*` instrument synths; 21 palettes (19 chapters + title 18 + Monaco 19
+ Hanoi 20); voice ceiling 12 starts/165 ms; ladder levels 0.05–0.20; NPC
default 0.34.

**Two harness facts worth keeping:** the ambience ladder is switched by
`bio === '<name>'` string compares at ~`systems.js:30607–31243`, not by
`isActive`/`case`, so a per-biome rung count needs that pattern; and there is
still no `game.weather = {` literal — it is `game.weather = api` at
`weather.js:1172`, with the accessors listed at 1137–1139.

Related: [[capy3-the-mix]], [[capy3-the-punctuation]],
[[capy3-sounds-people-make]], [[capy3-things-that-are-simply-there]],
[[capy3-the-lift]], [[headless-qa-harness]]
