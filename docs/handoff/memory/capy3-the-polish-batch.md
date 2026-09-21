---
name: capy3-the-polish-batch
description: "Running /polish's core batch on 28 Aug 2026 — the four phases that landed, the two targets that could not be met honestly, and the four instruments that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 997b3bf7-5fd5-4882-87a7-7fdc44e32b7b
  modified: 2026-08-27T18:16:23.976Z
---

All four phases of `/polish` CORE ran on `audit-fixes`, 28 Aug 2026:
`af6a7ae` floor, `9788147` rim, `e05060d` ambience, `3bf1107` instruments,
`39277a0` final numbers. Supersedes the "batch has not been run" line in
[[capy3-polish-pass]].

**The near octave needed three things, not one.** A single value-noise octave at
an amplitude big enough to measure reads as SQUARES — smoothstep has zero
derivative at the cell boundary, so a lawn comes out quilted. It took: a second
octave at 2.17x in a rotated frame, a **domain warp of the near sample by the
base octave** (`gnq += gn * 3.0`, two multiplies, no extra hash — this is what
actually killed the quilt), and a per-octave `fwidth` fade to nothing at half a
cell per pixel, which is Nyquist for a smoothstep value noise.

**The SD 12 target is not reachable with grain and the batch's own acceptance
list forbids reaching for it.** Sydney landed 4.30 → 8.31 and Venice 8.58 →
10.35; getting to 12 needs peak-to-peak swings near 40% of the diffuse, and at
that amplitude the field stops being ground and becomes noise you can name. The
number came from Rio, and **Rio gets there with a graphic on the floor, not with
grain** — floor graphics are what the batch deliberately left out. The honest
signal is the colour count, which roughly tripled everywhere (Palawan 5 → 25,
Sydney 13 → 41, Kowloon 101 → 156) and is not amplitude-limited.

**Several chapters' real walking surface is on the WHISPER material, not the
ground one.** Kyoto's Gion lane, Rio's promenade and Manly's Corso are merged
into the machiya/building mesh and drawn with `*VC()`. The first sweep opted in
only `*VCG()` and photographed as a completely flat lane. Rule that came out of
it: dedicated ground material → full strength; shared with walls, props or birds
→ about a third, because props.js has already written down what a field scaled
for a road does to a half-metre object.

**The rim went the opposite way to the plan, twice.** Exponent 2.5, not 4 — at
the fourth power Mong Kok wore a pale band with a hard inner edge, which is an
outline reached from the bright side. And the **bright chapters want MORE, not
less**: the prediction reasoned about the ground, but the rim is on the ANIMAL
and its visibility is contrast against the animal's own interior, so the same
figure is half the lift at noon. It lives in `mat()` (every Lambert comes
through it) with two shared uniforms driven from the hemisphere at full chroma
lerped 40% to white; `grain()` re-injects it because `Material.copy()` still
does not carry `onBeforeCompile`.

**Four instruments lied and cost a run each.** See
[[capy3-instruments-that-cannot-hold-a-line]] — these belong with those.

1. **Peak amplitude on the master bus measures nothing.** The score plays
   underneath at peaks of 0.13–0.40; seven of seventeen new voices came back
   with a *negative* lift. Measure the **graph** instead: patch
   `AudioContext.prototype.createOscillator` and `AudioNode.prototype.connect`
   and count across the synchronous `sfx()` call. This matters because `sfx()`
   wraps every generator in a try/catch that swallows the error on purpose, so a
   voice that throws on line one is silent AND invisible.
2. **The name is only on the call stack.** `new Error().stack` inside
   `createOscillator`, regexed for `/(mus|sfx)[A-Z]\w+/`, is the only
   name-resolved audio counter available headlessly. The bundle keeps its
   function names.
3. **A digit pressed on the title card starts the game in that chapter; the same
   digit once it is running does nothing.** Two full 11-minute runs soaked five
   of six chapters in Sydney under the right chapter's name. Anything before the
   digit (Enter, a mouse click) starts the game and eats it.
4. **`qa/pol-soak.js` needs 300 ticks of nothing before it asks for a chapter**,
   and must record the chapter it ENTERED separately from the one it ended in —
   the fuzz triggers real travel, which is not a failure.

`qa/pol-crawl.js` is the aliasing instrument and it **needs a positive control**:
nudge the camera by one pixel's worth of far-field motion (6 cm, not 1 cm — 1 cm
is too small to expose anything) and compare RMS change against the band's SD.
With the fade compiled out Sydney's far ground answers 0.591; with it in, 0.437.

Related: [[capy3-polish-pass]], [[capy3-the-picture]], [[headless-qa-harness]],
[[capy3-things-that-are-simply-there]]
