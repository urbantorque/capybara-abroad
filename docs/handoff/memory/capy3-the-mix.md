---
name: capy3-the-mix
description: "v41 — the score was composed but never produced; the six mix changes, and the five things that measured wrong"
metadata: 
  node_type: memory
  type: project
  originSessionId: c0d3bf3b-f213-45d7-9820-ba8eb21d585e
  modified: 2026-08-29T20:11:57.238Z
---

Ran a deep audio review on 30 Aug 2026. The finding that framed everything: capy3's
score is **beautifully composed and had never been produced**. Nineteen palettes,
twenty-eight modelled instruments, six band arrangements, a voice-leading pad that
never repeats — and mono, on a grid, in one room, forever. Every change in v41 is
mixing or performance. **Not one chord, root, next-table, dwell, tempo, riff or
instrument model moved.** See CONTRACT.md "THE MIX PASS (v41)".

**The six, all in `src/systems.js` §5/§5b:**

1. `noiseBuf` — the noise floor was **1.2 s of MONO**, and it is every rain, wind,
   surf, crowd, cricket and ambience voice in the game. Now 6 s, and there are
   **two** buffers (see the trap below).
2. `musWide` — the pad, shimmer, choir and lift were all dead centre. One ensemble
   bus: two modulated delays (16–23 ms, ±3 ms on slow incommensurate LFOs) panned
   hard apart under the dry centre. `sysMUS_ENS_TRIM` pays back the +1.4 dB in one
   place so nineteen chapters' balance is untouched.
3. `musIR` — pre-delay, eight early reflections, a tail that darkens, and a density
   build.
4. `musRoomLoad`/`musRoomSet` — the score now has **a room per chapter, read out of
   `sysROOMS`**, the table the sfx have used since v16. Two convolvers cross-faded
   on the border; the one being left is *disconnected from the send* so a chapter
   never pays for a room it is not in.
5. `musFeel`/`musVel` — every struck note was on the grid to the sample. Triangular
   scatter + a per-role pocket (bass late, comping early, **pulse-keepers barely
   move** — that asymmetry is the whole trick).
6. `musBreathStep` — the score never stopped. Now it thins for 9–13 s every 78–146 s.

**FIVE THINGS THAT MEASURED WRONG FIRST** — and note that #4 and #5 were only found
because the A/B was run at all. Both looked completely correct in the source:

1. **`erSpan = secs * 0.024` PINNED EIGHTEEN OF NINETEEN ROOMS AT THE CEILING.** The
   music rooms only span 3.45–6.5 s, so any straight proportion of them saturates.
   The one number that says how big a place is said the same thing everywhere, and
   only an offline measurement showed it. `(secs - REF) * K + BASE` gives 33–85 ms.
2. **ONE STEREO NOISE BUFFER WOULD HAVE COST EVERY PLACED SFX ITS PAN.**
   `StereoPannerNode` uses a *different algorithm* for stereo input: at pan 0.5 a mono
   source lands 0.38/0.92 and a stereo one lands 0.71/1.22, because the panner may not
   throw away an incoming left channel. ~40% off the positional cue of every
   noise-based effect. Hence `noiseSrc()` (mono, everything placed) **and**
   `noiseWideSrc()` (stereo, the beds, which are not anywhere).
3. **THE DARKENING TAIL DOUBLED AS A FADE.** A one-pole `y = ky + a·x` with `a = 1-k`
   loses level as `k` closes; the RMS-preserving term is `a = 0.4842·sqrt(1-k²)`, and
   0.4842 is exactly the number that makes `k = 0.62` come out at the old 0.38 so the
   head of every tail is bit-for-bit unchanged.
4. **THE ENSEMBLE FED THE REVERB SEND, AND WAS THEREFORE WORTH NOTHING.** Sydney measured
   corr 0.559 without it and 0.564 with it — no change, three minutes each arm. A
   convolver REPLACES the stereo image of its input with the image of its own IR, and
   this score is ~2/3 wet, so widening the reverb input buys nothing and smears its
   attack. Moving the taps to the DRY PATH ONLY (send takes the pad clean) moved it to
   0.483 / side 0.226 → 0.264. **The trim moved with them, so the wet level is
   bit-for-bit pre-v41.**

5. **`sysROOMS.wet` USED RAW MADE SON DOONG 3.4 dB LOUDER.** 0.094 master RMS vs Sydney's
   0.045 — 2.06× where before v41 it was 1.22×. Two leaks: that column spans 0.04–0.42 (a
   factor of ten, right for a footstep, absurd for an hour-long bed), **and a longer tail
   is louder at the same send even with `normalize = true`** — normalize scales the
   impulse, but sustained input into a 6.5 s tail sums twice as much of its own history at
   any instant. Fixed by compressing the spread (`sysMUS_WET_BASE/_SPR`, ±1.4 dB) and
   dividing by `sqrt(sysMUS_WET_REF / secs)`. Final: 1.54× Sydney, send 0.81–1.01.
   **Which room and how loud are different questions.**

**HOW TO MEASURE ANY OF THIS AGAIN:**

- `node qa/v41-ir.mjs` — rebuilds the IRs offline and prints pre-delay, ER span, ER/tail
  ratio, head and tail brightness, RT60, per chapter. **Zero-crossing rate is a fine
  brightness proxy** and needs no FFT. Run after touching any `sysIR_*`.
- `qa/v41-rooms.js` — one reload per chapter through the **title picker**, a
  `ChannelSplitter` + two `AnalyserNode`s on `game.music.bus`, reporting L/R
  correlation and side energy. **`game.music.bus` was added for this**; there was no
  handle on the AudioContext from outside at all.
- `qa/v41-arm.mjs off|on` — the A/B. `git stash` does **not** work for an audio
  differential here: the old build has no `music.bus`, so the probe has nothing to
  attach to and the whole arm reads "no bus". The armer switches off the three mix
  changes *in place* and leaves the hook, which is a cleaner isolation anyway.

**A TRAP THAT COST A TEN-MINUTE RUN: `KeyJ` + a digit DOES NOT TRAVEL.** `jrTravel`
returns immediately unless `jrDepart` is set, and `jrToggle` opens the read-only book.
A nineteen-chapter sweep came back with `biome: "sydney"` in all nineteen rows and
looked like a room system that never switched. **The title card takes a picker digit
directly** (`sysPickFromKey` → `startGame`), so a per-chapter sweep is one reload per
chapter and that is the only keyboard route in. Cross-check `game.biome.current` in
every row — that is the only reason it was caught. Same family as trap 15 in
[[headless-qa-harness]].

Related: [[capy3-sounds-people-make]], [[headless-qa-harness]], [[capy3-the-lens]]
