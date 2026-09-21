---
name: capy3-the-waters-edge
description: "D5 — the shore term, the contact rings, the wet smear, and the eight seconds a chapter takes to arrive"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60501ba9-888e-42ec-bf5f-6720ba5e13a0
  modified: 2026-09-03T03:29:52.522Z
---

D5 (3 Sep 2026, commit "D5: the land met the water at a polygon join"). Five items,
all landed. Contract section **THE WATER'S EDGE — D5**; instruments `qa/d5-shore.js`,
`qa/d5-glow.js`, `qa/d5-wet.js`.

**`shore` is an option on `grain()`, not a mesh.** Every grained fragment already
carries `vGrainW`; the waterline is one shared uniform (`shoreTick`, written by
`sysDressFrame` from the live biome's `waterLevel`). `uShoreY - vGrainW.y` gives a
soak, a depth tint and an animated lace for zero draw calls and zero new programs.
It is `venWet` generalised — Venice had had it privately since chapter 10 with a
*static* rim line, which is why its foam count read zero.

**Four things that measured wrong, and they generalise:**

1. **`biome.switchTo` does not arrive at a chapter, it starts arriving.** The grade,
   airlight and hemisphere damp in over ~8 s. A probe settling for 3 s measures the
   PREVIOUS chapter's atmosphere, and it looks exactly like a feature decaying:
   twelve consecutive A/B samples with camera and animal stationary read 0.88 down
   to 0.01. Settle ten seconds in any picture probe. See [[headless-qa-harness]].
2. **A probe that moves `waterLevel` is measuring the floating props.** It also moves
   buoyancy, the swim threshold and the underwater camera; the first run read 0.42 %
   of the frame in MANLY, which has no shore term at all. `game.shoreAudit(y)` is a
   render-only override so it cannot. Same family as [[capy3-instruments-that-cannot-hold-a-line]].
3. **A blown/lit luma count cannot hold a line in a chapter with a big flat sky.**
   Hanoi read 21.2 %, 8.8 % and 19.4 % lit across three runs, two of them the same
   code. Only trust it where the threshold itself moved.
4. **In Antarctica the waterline is the DARK half.** A white lace on snow under the
   game's highest bright-pass threshold is invisible — the albedo ceiling again, see
   [[capy3-fourth-pass-sixteen-seventeen]]. Deep soak, whisper of lace.

**Two shader lessons.** A thresholded value-noise field is a QUILT, not foam: warp it
by `gn` (already computed, free) and rotate the second octave, the same fix `near`
needed. And a `fwidth` distance fade at coefficient 1.0 switches an effect off at the
range you actually look at it from — 1.8 band widths, not 1.

Also: rain contact rings live in `weather.js` (12, one draw call, 6–10/s in a 6 m disc
round the ANIMAL, landing on the animal's foot height when it is on a deck); the spill
gained an anisotropic falloff on wet ground (`_spillANISO` 2.4, behind a uniform
branch, bit-for-bit `length()` when dry) — see [[capy3-presence-batch-two]]; and
`EMIT_OVER` 1.45 with `matEmit`/`emitSet` in shared.js puts emitters past white so a
chapter's bloom threshold stops having to hunt for its own lamps (Göreme 0.46 → 0.78,
`wide` 0.58 → 0.42).

Related: [[capy3-the-picture]], [[capy3-the-lens]], [[capy3-exposure]],
[[capy3-wires-not-systems]]
