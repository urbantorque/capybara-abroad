---
name: capy3-the-beauty-pass
description: "The 10 Sep 2026 beauty pass — one star for eight chapters, the cloud that finally moved, the sea's horizon, the albedo gate written in the wrong colour space, and the ground material that is the second near: line"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1204923e-d5e5-4bfe-a366-2ce1d3c432a9
  modified: 2026-09-09T17:44:12.179Z
---

Ran 10 Sep 2026 unattended from "deep review, 4–6 no-regret decisions to lift
beauty ~30 %, then polish". Branch `beauty-pass` off `review-sweep`, five
commits (`b3269fd`, `c9de995`, `2928a33`, `fda3754`, `f70ff17`) plus docs.
Review is `ROADMAP-BEAUTY.md`; architecture is **CONTRACT.md ➜ "THE BEAUTY
PASS"**. This file is what cost time.

**THE REVIEW WAS TWO TABLES, NOT NINETEEN FRAMES.** The frames said "flat"
in four chapters; the light probe said WHY: `sysSUN_BY_BIOME` handed one
61-degree star to eight chapters, and the caster audit said every one of
them casts from 43–96 % of its geometry. A flat noon frame is a sun-angle
fact, not a wiring fault, and only the tables tell those apart. Antarctica at
28 degrees plus `sysSHADOW_SKY` 1.0 → 0.62 was the single biggest change of
the pass — the shadow pass was already moving 22 % of the frame by 15.7
levels and snow that keeps all its sky in shade hides that completely.

**FIVE THINGS THAT MEASURED WRONG FIRST:**

1. **A picker probe that presses digits without reloading reads Sydney
   nineteen times.** The picker is on the title card; after the first press
   the game is running and the next eighteen keys do nothing. The tell is
   nineteen identical rows. Reload before every press.
2. **`diffuseColor` IS LINEAR.** The pale-ground gate was written as a
   0.55..0.85 luma ramp read off a screenshot (sRGB). Pale stone is ~0.6 in
   linear and never reached it: 0.04 % of the Erg's frame changed, 0.00 % of
   Hanoi's — a live wire reading as a dead one. sRGB 0.51..0.77 is linear
   0.24..0.52. Any threshold on an albedo in a shader is a linear number.
3. **A chapter's GROUND material is the SECOND `near:` line in its builder.**
   Every chapter has two `grain()` calls ten lines apart — a whisper on the
   merged world, then the real one on the ground — and a line-number rollout
   that takes the first `near:` puts the option on the buildings. The speck
   "read as nothing" for one whole iteration because it was on the wrong
   material. Same family as [[capy3-names-nothing-publishes]]: opted in and
   invisible looks exactly like invisible.
4. **THE CUT SETS THE SIZE of a thresholded speck, not the scale.** At 2.4
   cells/m and cut 0.5 the daisies were 30 cm blobs and the lawn read as snow
   patches; at 4 cells and cut 0.66 they are dots. Find the ceiling by
   overdoing it, as [[capy3-the-leaf]] says, then come back.
5. **The `post.render()` x 60 harness has no fixed noise floor.** Five
   iterations drifted 11.1 → 9.3 ms with nothing changed; the historic
   ±0.1 ms ([[capy3-the-lens]]) was the machine on that day. The interleaved
   rAF A/B (terms cut / live, three reps) is the only quotable number and it
   read 16.6 → 16.8 ms. Same family as
   [[capy3-instruments-that-cannot-hold-a-line]].

**THE CLOUD LIVES IN THE RIM BLOCK ON PURPOSE.** `reflectedLight.directDiffuse`
is in scope at `<opaque_fragment>`, so a cloud subtracts DIRECT light and a
shadowed fragment loses nothing — no shadow-chunk override, no struct
hacking. Unrimmed materials (seas, the wet-only prop material) take it in
`grain()` on the diffuse at 0.7, bound to the same uniform objects under
different GLSL names (the `uWetK`/`uGrainWet` rule). The 150 m fade is what
keeps it off every sky dome without a flag: they all ride the lens at
200–900 m.

**A TDZ IN grain().** `wetOnly` is declared halfway down grain(); an option
line placed in the near block that reads `wetOnly` throws "Cannot access
before initialization" on the first module load and takes environment.js
and props.js down with it. Read `o.wetOnly` directly there.

**Fresnel is not gated on sparkle** — Antarctica's and the Pantanal's seas
are opaque with no glitter and wanted a horizon most. The call site says it
is water by asking.

**Line endings:** pantanal.js, sahara.js and pasto.js are CRLF. A node
rollout that splits on '\n' and joins on '\n' leaves the edited line bare;
split on whichever the file uses. `git status` warns, `node --check` does
not.

Open, unchanged: Iceland's lamps on the road, Iceland's sun (2° at 23:30 —
an art call), Rio's stripe staircase, Monaco's harbour reflection.

Related: [[capy3-the-picture]], [[capy3-the-lens]], [[capy3-the-depth-pass]],
[[capy3-the-leaf]], [[capy3-the-penumbra]], [[capy3-the-blossom]],
[[capy3-the-waters-edge]], [[headless-qa-harness]]
