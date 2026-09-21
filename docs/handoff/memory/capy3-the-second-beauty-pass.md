---
name: capy3-the-second-beauty-pass
description: "The 10 Sep 2026 second beauty pass — the sky is 0% of the frame, most shade is a face turned away rather than a shadow, and the three metrics that were wrong before the per-pixel diff"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1204923e-d5e5-4bfe-a366-2ce1d3c432a9
  modified: 2026-09-10T00:59:28.525Z
---

Ran 10 Sep 2026 straight after [[capy3-the-beauty-pass]], from "what else would
you add, what lifts it another 30 %". Six commits on `beauty-pass`
(`ec901f0`, `6fd8601`, `0711779`, `66a28d9`, `d3f8f34`, `2fc2701`) plus docs.
Review is the second half of `ROADMAP-BEAUTY.md`; architecture is **CONTRACT.md
➜ "THE SECOND BEAUTY PASS"**. This file is what cost time.

**MEASURE THE FRAME BEFORE CHOOSING WHAT TO PUT IN IT.** A 117-ray NDC grid
over nineteen arrival frames said two things that reordered the whole list:
**the sky is 0 % of the frame in eighteen of nineteen chapters**, and 49–97 %
of every frame is inside 20 m. Three of the four ideas I opened with died on
that, including a confident one: the first pass had just given thirteen
chapters cloud shadows and only Sydney has clouds overhead, so putting clouds
in the other twelve skies looked obviously right. Nobody would ever see them.
`/presence 2` had already retired the sky from the other direction — the
camera pitch — and I did not connect the two until I measured it again.

**MOST SHADE IN THIS GAME IS NOT A SHADOW.** The shade-tint term first gated on
`capyShadowV` alone and measured: Kyoto's chroma 33.7 % of frame → 52.0 %,
and Venice, Palawan and Iceland unmoved. Kyoto is a lane between two rows of
houses; the others are open ground. In a world built of boxes the shade is
mostly a FACE TURNED AWAY FROM THE SUN — north walls, undersides, the dark
side of every trunk — and none of that is in the shadow map. `max(cast
shadow, 1 - dot(N, sunDir))` reaches all of it. Keep the LEVEL on cast
shadow alone: `uShadowSky` is nineteen shipped numbers tuned against the
picture.

**THREE WRONG METRICS BEFORE THE RIGHT ONE, AND THE RIGHT ONE WAS ALREADY IN
THE REPO'S OWN NOTES.**
  - *Mean saturation* said Venice and Palawan got WORSE. They got better: a
    blue tint on warm stone neutralises it, and what the frame gains is the
    separation between a warm sun side and a cool shade side. A frame can lose
    chroma and gain colour.
  - *Warm-minus-cool between the luma quartiles* said Kyoto was unchanged.
    Kyoto's ground is entirely in shade, so its top luma quartile is not its
    lit quarter and the metric's premise fails.
  - **The per-pixel diff is the only honest instrument for a term** — count
    pixels that moved more than 2/255, report their mean and peak — and
    [[capy3-the-leaf]] already says so in as many words.

**A DAMPED POOL CANNOT BE SWEPT AT dt = 0.** Every picture probe here reads
its arms at dt = 0 so nothing else can move; a damped uniform does not move
there either. Ticking real time between arms instead measured two seconds of
Mong Kok — two buses, a crowd, a drifting cloud — and reported 72 % of the
frame moving with a peak of 220 at EVERY strength including the smallest.
Hence `game.state.bounceSnap`. And the arms still have to be captured
synchronously and decoded afterwards, or the `await` lets rAF run: that put
80 % of the Quay moving at a strength of 0.03, which was the harbour
sparkling. Third and fourth time this trap has been paid for.

**MANLY'S FRAME STATISTICS CANNOT HOLD A LINE.** Two runs of identical code:
p50 113 and 154, saturation 0.385 and 0.185. It read as a serious regression
from the shade term for twenty minutes. Within either run, all six arms agreed
to 15 levels. Attribute inside one run, never across two. Same family as
[[capy3-instruments-that-cannot-hold-a-line]].

**A BOUNCE'S SOURCES ARE NOT MESHES.** The spill finds lamps by
`material.emissive` because a lamp is a material; an awning is a run of
vertices inside a merged white-materialled batch. The scan subsamples the
position, normal and colour BUFFERS. Three filters and each is load-bearing:
not facing up (the ground's bounce is already `hemisphere.groundColor` and
letting the lawn in applies it twice), above the floor (`sysSPL_MINY`'s
argument), and **the chromatic residual only** — the colour with its own grey
removed — because a neutral bounce is already in the four global terms and the
only thing missing from them is hue. With the full colour it read as +9.4
levels of luma over 72 % of Mong Kok: a dimmer switch with a hue on it.

**ONE GAIN COULD NOT SERVE BOTH ENDS.** At a strength that made Pasto's
awnings do anything, Mong Kok blew out. A gain for the quiet chapters plus a
per-source CAP the loud one hits. Fourth pass running where the first guess at
a strength was 4–10x out — see [[capy3-the-airlight]].

**THE FRAME-TIME INSTRUMENT NEEDS THE MACHINE TO ITSELF.** First run said
17–20 ms in BOTH arms with three other playwright sessions open, which reads
as "the new terms broke the 60". Quiet: 16.7 → 16.7 ms, ten raw pairs agreeing
to 0.1 ms. **The tell is the OFF arm moving from its own historic figure.**

Also: a `const` read inside `grain()`'s option block before its own
declaration throws "Cannot access before initialization" on first module load
and takes environment.js and props.js down with it — read `o.wetOnly`, not
`wetOnly`. And Pasto has no merger at all, so the jitter rollout skips it.

Still open: Iceland's lamps light nothing on the road (more visible now the
chapter is not flat-lit), Rio's stripe staircase, Monaco's harbour
reflection, the cave as the flattest frame in the game, and the near 3 m of
every frame being empty — foreground framing is the biggest thing left and
the riskiest, because P1 already measured that a canopy between lens and
animal is a camera problem.

Related: [[capy3-the-beauty-pass]], [[capy3-the-picture]], [[capy3-the-lens]],
[[capy3-the-depth-pass]], [[capy3-the-leaf]], [[capy3-the-airlight]],
[[capy3-instruments-that-cannot-hold-a-line]], [[headless-qa-harness]]
