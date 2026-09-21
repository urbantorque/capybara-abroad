---
name: capy3-the-leaf
description: "v46 — the transmission term, the strength that was invisible and the metric that agreed with it, and the shore batch that was already built"
metadata: 
  node_type: memory
  type: project
  originSessionId: 29e889c9-47e2-4900-8427-f195ecba9825
  modified: 2026-08-30T11:08:50.209Z
---

Ran 30 Aug 2026, straight after [[capy3-the-depth-pass]], from "make the changes"
on the first two of five recommended items. Commit `2a78321`. Architecture is in
**CONTRACT.md ➜ "THE LEAF (v46)"**; this is what cost time.

**ITEM TWO OF THE BATCH WAS ALREADY BUILT AND I RECOMMENDED IT ANYWAY.** I
proposed generalising the Pantanal's depth-graded waterline to Palawan, Manly,
Antarctica and Venice — from looking at *frames*, without reading the builders.
Reading them: the Pantanal fades its sheet on vertex alpha, **Manly already
blends `manSand` → `manSandWet` → `manSandDeep` across the whole terrain**, and
**Antarctica already carries a rock-and-scree band at `antWATER + 0.3`**. Manly's
and Antarctica's seas are also OPAQUE by design, so the alpha approach is not
portable without changing how they sort against the floes, the boat and the dive.
The one genuine defect was Palawan switching at a single contour (`h > 0.1`), so
its swash zone did not exist above the waterline — one line, now a ramp,
continuous at the old boundary. **A frame shows you a symptom; only the builder
tells you whether the mechanism exists.** Same family as
[[capy3-five-things-already-built]].

**THE STRENGTH WAS INVISIBLE AND THE INSTRUMENT AGREED WITH IT.** First guess
`sysLEAF_K = 0.16`. A frame-mean luminance A/B read **0.001 of 255 in five
chapters** — and that is not a bug in the term, it is the same mistake as
measuring a defocus with mean luminance one pass earlier: a few hundred backlit
canopy facets do not move a frame average. Two fixes, both needed:

  - **Diff PER PIXEL.** Count pixels that moved more than 2/255 and report their
    mean and peak. That turned "0.001" into "6.2% of the frame, mean +7.1,
    peak +27.4".
  - **ORBIT THE CAMERA.** This term is strongly directional by design — Sydney
    reads 0.03% of frame at the front-lit azimuth and 6.2% at the backlit one,
    and **every arrival frame in this game is front-lit**. A probe that
    photographs one arrival frame concludes the term does nothing, correctly,
    about a term that works. `qa/leaf-orbit.js` places the camera at eight
    azimuths and re-imposes it AFTER the tick.

**FIND THE CEILING BY OVERDOING IT.** Cranking to 3.0 made the Pantanal's campo
acid yellow-green and the grass read as emissive. A quarter of that is the ship
value. Much faster than creeping up from below, and it gives the write-up a
stated failure point.

**WHERE IT LIVES, AND THE THREE REASONS.** View space off `vViewPosition` and
`normal` — both already in scope at `<opaque_fragment>` in every Lambert three
compiles — so it adds **no varyings** and needs none of the rim's plumbing; the
only cost is the sun direction pushed through the camera once a frame. It is its
**own program**, because the rim reports ONE cache key so hundreds of materials
share one, and folding this in makes every wall and bollard pay a normalize and a
`pow` for a thing only plants want. And it **clones and chains** exactly as
`sway()` does, or a canopy loses the rim and grain it already had — the
`grainOwn()` bug again.

**`swayMesh` CARRIES THE OPTION**, because that call is already the marker for
"this mesh is a plant". Read it BEFORE the `auto` branch, which rebuilds the
options object as a copy and silently drops anything else. 26 sites wired.
**Son Doong is not wired and it is the chapter that motivated the term** — its
vegetation is merged into one mesh with the rock and the walls, so there is no
material that is only leaves.

Shadows are deliberately ignored (a leaf glowing in shade is wrong; the fix is a
lookup this cannot afford) — the same bargain the spill takes.

Measured after: 16.4–16.8 ms median / 18.5–20.1 p95 in all nineteen, 0 errors,
every row asserting its biome, `qa/fuzz.js` 19/19 clean. Switch is
`game.state.noLeaf` and it cuts.

**STILL OPEN, from the same review:** the albedo ceiling (Palawan measures
**29.5% of its frame over 235/255** — `toneMapping` is `NoToneMapping` and there
is no exposure control anywhere); light in the air near the spill emitters; and
shadow penumbra, which does not vary with caster distance (`sysBIO_SH_RAD` is one
number, 1.0 for seventeen chapters).

Related: [[capy3-the-depth-pass]], [[capy3-the-lens]], [[capy3-presence-batch-one]],
[[capy3-five-things-already-built]], [[headless-qa-harness]]
