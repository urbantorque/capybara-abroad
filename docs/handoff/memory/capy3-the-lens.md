---
name: capy3-the-lens
description: "v40, the lens pass — the five composite-pass terms, the bloom that only existed at one window size, and the two instruments that read nothing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 683589b1-3a27-447a-bbce-e2d6ef896276
  modified: 2026-08-29T15:42:27.324Z
---

Ran 30 Aug 2026, unattended, from a "deep visual review, then apply" brief. Full
architecture is in **CONTRACT.md ➜ "THE LENS PASS (v40)"**; this file is the
things that cost time. Commits `418f76c` (see the last section) and `3d5a89d`.

**The review is the deliverable, not the code.** Nineteen arrival frames
(`qa/vis-review.js` — picker digit, 7 s settle, full screenshot) produced the
same two sentences over and over, and every change came from them: **a light in
this game was a sticker, and a frame in this game had one tint on it.** Do that
before touching a shader; the first three things I would have guessed at were
not on the list.

**Five terms, all in `mainMakePost` and the three `MAIN_POST_*` shaders, all
no-ops at their default.** `wide` (a second bloom octave at an eighth, blurred
out of the finished quarter-res one), a 4-tap box downsample in the bright pass,
`shoulder`, split toning, and a vignette that also cools. Three of them are one
number per chapter in `sysLENS` next to `sysGRADES`.

**FOUR THINGS THAT MEASURED WRONG FIRST.**

1. **A SPLIT TONE IS TWO RAMPS WITH A GAP, NOT ONE MIX.** `mix(shadowTint,
   highTint, smoothstep(0.2, 0.8, luma))` has **no neutral** — every pixel gets
   one tint or the other in proportion. Sydney's lawn is 0.55 luma and two
   thirds of the frame, so it took most of the warm push and the chapter went
   olive. Shadow ramp spent by 0.45, highlight ramp starting at 0.55, middle
   untouched.
2. **THE BLOOM ONLY EXISTED AT ONE WINDOW SIZE.** The blur offset was
   `radius / bw` — the same count of quarter-res texels at every resolution, and
   a quarter-res texel is a smaller piece of the picture on a bigger monitor. So
   the halo shrank as the window grew and nineteen grade rows hand-tuned at 720
   only existed at 720. Anchored to `MAIN_POST_REF_H`, correction capped at 2x
   so the second octave's five taps cannot spread far enough to ring.
3. **AN rAF BENCHMARK CANNOT SEE ANY OF THIS.** The game is vsync-locked, so
   both arms read 16.6–17.0 ms and the number is the display. Time
   `post.render()` x 60 with a `gl.readPixels` at each end to drain the queue.
   And **the first arm of every single run was 5–10 % slow** — exactly as
   [[capy3-presence-batch-two]] wrote down. Interleave, median of five.
   Answer: **+0.009 / +0.013 / +0.021 ms** for all five terms.
4. **A PROBE THAT WALKS OUTWARD FROM THE BRIGHTEST PIXEL MEASURES THE BULB.**
   First attempt at proving the resolution fix scanned right from the peak until
   luminance crossed 0.85/0.70/0.60 and read almost no difference between arms,
   because a saturated white lamp mesh is most of that distance and its size in
   frame fractions is constant. What worked: **mean luminance of an annulus
   0.10–0.20 of frame HEIGHT out from the bulb** — the same piece of the picture
   at every size. 0.3001 / 0.2918 / 0.2871 before at 720 / 1080 / 1440;
   0.3001 / 0.3045 / 0.3057 after, and the 720 arms identical, which is the
   proof the anchor is exact.

**Also worth keeping.** `renderer.domElement` reads BLACK from `drawImage` —
`preserveDrawingBuffer` is false, so a canvas probe must call `game.post.render()`
in the same JS task before it reads. And picker digit keys are
`1..9 0 - = [ ] ; ' , . /`: `Equal` is Palawan, not Hong Kong. I mislabelled two
A/B pairs for half an hour on that.

**Tuning that came out of looking, not arithmetic.** Mong Kok 0.90 → 0.72 (at
0.90 the pink sign across the street washed out the shelves of the shop under
it) and Göreme 0.70 → 0.58 (**the ridge event ADDS bloom and `wide` multiplies
the sum**, so the moment the sun clears the rock veiled the cobbles it exists to
light). A chapter with a bloom event needs its `wide` judged on the event frame.

**THIS DIRECTORY HAD A WHOLE UNCOMMITTED PASS IN IT.** `git log` had no v39 at
all: the yacht, `musBondHeat` and `capy.dress()` — source, CONTRACT section,
README section, twenty qa scripts — were complete in the working tree and never
committed, and my edits landed in the same three files. Split by filtering the
`git diff` hunk headers by their old-line number into a patch, `git apply -R` to
get a v39-only tree, commit that as found, re-apply, commit mine. **Check
`git log` against the newest memory before starting a batch here** — the
concurrent-writer note in [[capy3-presence-batch-one]] is not a one-off.

Verification for any future pass on the picture: `qa/vis-review.js` (the
nineteen-frame baseline), `qa/lens-ab2.js` (A/B pairs), `qa/lens-perf2.js` (the
honest timing), `qa/lens-res4.js` (the annulus). Switches are `noWide`,
`noSplit`, `noShoulder`, `noVigTone`, `noBloomRef` on `game.state`, and all five
**cut rather than fade**.

Related: [[capy3-the-picture]], [[capy3-presence-batch-two]],
[[capy3-presence-batch-one]], [[headless-qa-harness]], [[capy3-the-yacht-and-the-band]]
