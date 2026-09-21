---
name: capy3-presence-batch-two
description: "Batch TWO of /presence under a low-risk brief — spill instead of point lights, and the two phases that measurement retired"
metadata: 
  node_type: memory
  type: project
  originSessionId: 28afdbb2-9429-4783-9253-4cf83cf06089
  modified: 2026-08-28T01:34:12.976Z
---

Ran `/presence 2` on 28 Aug 2026 with an explicit brief: safe, low risk, no
performance cost. Reordered by risk, not by the batch numbering. One phase of
three shipped; the other two were **retired by measurement**, which was the
right outcome and is written into `qa/PRESENCE-PASS.md` as an addendum.

**Light shipped, and NOT as `THREE.PointLight`** (`5d966fe`). Every added light
changes `NUM_POINT_LIGHTS`, recompiles every material, and costs a full
lambert-plus-specular per light per fragment on all of them. Instead: a
nearest-8 uniform pool and an additive term **inside the rim's existing
injection** — the rim already compiles into nearly every material via `mat()`,
already carries world position and normal, and already sits at
`<opaque_fragment>` where `outgoingLight` is, so the spill reaches the ground,
the stalls *and* the capybara. Multiplied by albedo (light, not paint).

**Emitters are discovered, not authored.** `sysSpillScan` walks the live chapter
once per attach and reads **instance matrices** — signs are instanced and taken
from the mesh they all cluster at the chapter origin, which made one enormous
lamp under the road first time. No chapter file was touched. One filter does
real work: `sysSPL_MINY` — *a light that spills is a light above the floor* —
which drops Kowloon's wet-road reflection discs, emissive quads at y=0 that
would each have registered as a lamp lighting the road they are a picture of.

Reach 14–26 m; the first pair (8–17) was too short by half — Mong Kok's nearest
cluster is 10.5 m away and 6 m up, and its light stopped above the kerb.
Results: Hong Kong floor **34.8 → 58.8**, Monte Carlo **102.8 → 120.3**, clipping
0.00% in both arms, six unaffected chapters identical to 0.1 of 255.

**Cost: +0.044 ms (Kowloon), +0.311 ms (Monaco).** The bounded loop is why — a
`uSpillN` uniform the shader breaks against, so a chapter with two clusters stops
paying for eight. Before it the same measurement read +0.5 to +1.7 ms.

**THE CAMERA NEVER LOOKS AT THE SKY.** The sun glow was built, gated, made
additive, given an A/B switch, and measured at **0.0 of 255 in five chapters** —
then reverted. Unprojecting the frame edges says why: the **top edge of the
frame points ~20° BELOW the horizon** (centre −44°, bottom −68°) while the sun
sits 41–61° **above** it. `sunInFrame: false` everywhere. Retires the sky-dome
item permanently, and means the "sky band" in every table in the audit is
mis-named — it is distant ground below the horizon.

**Floor graphics not done**, and the archaeology is recorded. Venice's Istrian
ribs **already span both squares** (6 long z −55..9, 14 cross z −53..7; the
Piazzetta is z −14..10) and read on the Piazza but not the Piazzetta — a
near-field contrast problem, not missing geometry. Cali's apron **is** the
terrain mesh at exactly y = 0 and `terrainHeight` is authoritative there
(raycast-verified); what blocked it is that paving and a lawn share one mesh and
one colour rule, so a joint grid would run over the grass.

**Why:** a generalised `groundGrid()` helper was written and **deleted rather
than shipped** — a published system with no call sites is the failure in
[[capy3-payoff-batch-one]]. Same reasoning retired the sun.

**How to apply:** benchmark discipline matters more than any of this. Every
early cost number in the session was a warm-up artefact — the first bench arm
ran cold (~2.2 ms) and later arms settled (~3.1), so whichever arm went first
won. Use **30 warm frames, 150 sampled, medians of three, interleaved**, and
repeat the whole thing three times. And give every visual term a
`game.state.noX` switch that **cuts rather than fades**: probes read two frames
at `dt = 0` and a damped fade does not fade, so a fading switch makes both arms
identical and the feature measures as doing nothing.

See [[capy3-presence-batch-one]] and [[capy3-the-presence-pass]].
