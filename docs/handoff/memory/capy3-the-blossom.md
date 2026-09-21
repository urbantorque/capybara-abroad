---
name: capy3-the-blossom
description: "v50 — the rim is what makes a ground decal stop being one, and every flat disc in Sydney is wound face-down"
metadata:
  type: project
---

Ran 30 Aug 2026 after [[capy3-the-penumbra]], on "do the jacaranda decals next".
Commit `d8d5b4f`. Architecture is in **CONTRACT.md ➜ "THE FALLEN BLOSSOM (v50)"**.

**EVERY FLAT DISC ON THE GROUND IN SYDNEY IS WOUND FACE-DOWN.** The rebuilt
blossom came back *completely invisible* first time. `envDisc` emits
`tri(centre, v[i-1], v[i])`, which with `x = cos` and `z = sin` puts the
geometric normal at **−Y** — so the pond bed, the pond water and the flower-bed
pads are all inside out, and they are on screen only because `matVC2` is
`side: DoubleSide` **for the Opera House sails**. Move one onto a front-faced
material and it is culled. Nothing looks different (a double-sided material draws
both faces, and the merger writes a `+Y` normal attribute so lighting never
cared), and it is fixed anyway because it is a trap, not a defect.

**Settle a winding with the cross product, not by trying both.** For `a` = centre
and `b`, `c` on a ring at increasing angle, `((b−a) × (c−a)).y = −sin(θc − θb)`,
so the outer pair must be listed in **decreasing** angle to face up. Same for the
ring strip. Two minutes of algebra against an edit-reload cycle per guess.

**THE RIM IS WHAT MAKES A GROUND DECAL STOP BEING ONE.** Giving the outer ring
**the receiving surface's own colour** — computed from the very same noise fields
the ground mesh uses — makes the shape dissolve instead of ending. No alpha, no
sorting, no z-fighting. Third time this session that "ramp it into what is
underneath" beat the obvious approach: the crease's opposed pairs, Palawan's
swash, and now this.

Also needed: two rings not a fan (a fan interpolates centre→rim and leaves no
solid middle), a **noise-wobbled outer radius** (a perfect circle reads as a
decal however soft its edge), vertices following the lawn's own height function,
and — the big one — **building it on the GROUND's material rather than the
decals'**, so it inherits the grain, near octave, broad hue field and contact
term. Every improvement made to that lawn over v45–v46 had been making the
blossom look worse, because the blossom was on `matVC2`, which has no `grain()`.

**CHECK THE MESH RESOLUTION BEFORE DESIGNING AROUND IT.** The first idea was to
paint the lawn lilac and add no geometry at all. Sydney's ground is 64×46 over
220×160 m — **3.44 m cells** — and eight of the ten drifts are smaller than one
cell. Thirty seconds of checking killed a good-sounding plan.

**A PREDICTED "+1 DRAW CALL" WAS NOT MEASURABLE.** Differential with
`shadowMap.enabled = false` and `info.autoReset = false` (else the counter reads
the composite quad, and the shadow pass is excluded — see [[capy3-the-picture]]):
140 calls against a baseline of 141, i.e. inside the run-to-run variance of what
the frustum culls on an arrival frame. 480 triangles replacing 80 against ~87 000.

16.6–17.0 ms median in all nineteen, 0 errors, `qa/fuzz.js` 19/19 clean.

**Still open:** Son Doong has no leaf term — its vegetation is merged into one
mesh with the rock, so there is no material that is only leaves, and splitting
that merge is its own job.

Related: [[capy3-the-penumbra]], [[capy3-the-leaf]], [[capy3-the-depth-pass]],
[[capy3-the-picture]]
