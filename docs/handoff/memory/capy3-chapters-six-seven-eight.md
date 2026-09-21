---
name: capy3-chapters-six-seven-eight
description: "What a deep second pass of Rio, Iceland and Marrakech found: a set piece on an island, three crowds that were one white box, and the sand that was corrugated along the wrong axis"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-20T22:40:00.857Z
  originSessionId: 477133a3-fddb-4660-99ab-489eb9cde8aa
---

Done 21 Aug 2026, on "deep second pass of biomes 6, 7 and 8: depth, physics, NPCs, marquee
moments, visual juice, bugs". Rio, Iceland, Marrakech. Unlike Sydney and Pasto
([[capy3-the-second-pass]]), where everything found was in the tail of something already right,
these three had **whole systems that were drawn and not implemented**.

**THE WORST BUG IN THE GAME WAS A PLACE YOU COULD NOT GET TO.** Iceland's moraine — the shelf
the chapter's own comment calls "the ONLY way to the top" — stood at 15.8 m at z = -80 while the
lagoon shore two metres south was at -3. Measured, not guessed: a scripted closed-loop keyboard
walk from the bottom of the glacier run toward the snowcat's bottom station **stops at x = 39.4,
z = -75.3 and stays there for the rest of the attempt.** So the cairn, the `glacierTop` beacon,
the `snowcat` task and the pacing fix that whole set piece exists to be
([[capy3-world-size-audit]]) were on a plateau with an eighteen-metre cliff round it. Nothing
catches this: `fuzz.js` wanders and reports "no void falls", the beacon points happily at
unreachable ground, and the task simply never ticks.

**THE CAUSE IS A SHAPE OF BUG WORTH NAMING: a terrain function whose REGIONS have hard
boundaries builds a cliff of the full region height inside one heightfield cell.** `iceTerrain`
switched on `z < iceGL_Z0` and every term north of it — the U's margin, the moraine shelf, the
valley wall — went to full height on the far side of that one comparison. The same line is also
why the shot from the geyser field is a photograph of a fifty-metre grey soundstage flat with a
dead-level top. **One smoothstep fixed all three**, because all three were the same mistake: a
`mouth` term, 0 at the snout and 1 by z = -112, multiplying each. A glacier terminus is a wide
low fan; the relationship that matters (the shelf sits exactly 3 m proud of the ice) is preserved
over the whole length anybody ever steps between them. After it, the same scripted walk reaches
the station.

**THE METHOD IS THE POINT.** `playwright-cli` with real key holds and a loop that recomputes the
WASD set every 250 ms from `game.input.camYaw` and the vector to the target. `game.input.x/z` are
overwritten by systems.update every frame, so setting them does nothing — it has to be real
`page.keyboard.down/up`. That harness is how connectivity gets tested at all, and nothing else in
qa/ tests it.

**THREE CHAPTERS' WORTH OF PEOPLE WERE ONE WHITE BOX.** Rio's Sambódromo: 130 identical
`PALETTE.cloth6` boxes, motionless, and floating **half a metre above the rake they were on**
(the rake top is `0.5 + r*0.9`, the crowd was placed at `1.0 + r*0.9`). Arpoador: 16 headless
boxes in a chapter whose own toast says "the whole rock is clapping". Jemaa el-Fnaa — the busiest
square in Africa — had six idle pursuers, four acrobats and three locals, three storytellers'
rings drawn as "a bare patch with a drum in the middle" with nobody round them, and a gnawa camp
with a guembri, a tbel and a heap of qraqeb lying on the sand **for a task about taking over a
band that did not exist**.

The fix is one pattern, twice: a merged figure + a merged head, two InstancedMeshes, an
`instanceColor` each, and a **pose chosen once with a motion that runs every frame** (stand /
sit / rock-and-clap). 255 people in Rio and ~180 in Marrakech for four draw calls. Notes:

- `instanceColor` MULTIPLIES the vertex colour, so the shirt is authored white and the head is
  its own mesh — otherwise a bright djellaba turns somebody's face orange (Manly's bathers had
  already learned half of this).
- **The crowd's motion should be keyed to something the world already has.** Rio's stand bounces
  on `clamp(1 - |x - rioBateriaX| / 30)`, so a wave travels down the avenue at 2.4 m/s for free
  and can never drift out of sync with the parade, because there is no second clock.
- A djellaba is a cone with a hood on it. That is not a poly-budget simplification; it is why a
  crowd in Marrakech reads completely differently from a crowd in Rio at the same vertex count.

**THE TRIANGLE BUDGET IS THE ONE THAT BITES, AND `renderer.info` IS NOT HOW TO MEASURE IT.**
`info.render.triangles` after `post.render()` counts the shadow pass too and reads roughly
double. Walk the scene graph instead, multiplying instanced geometry by `.count`. Marrakech went
to **143,564 against a 130k hard limit** and it was one thing: 2,340 sand ripples as BOXES.
A ripple is a facet of the ground seen only from above, so eleven twelfths of every box was faces
that cannot be seen — a pre-rotated `PlaneGeometry` is 2 triangles instead of 12. Final: Rio
119k, Iceland 114k, Marrakech 125k; draw calls 129 / 149 / 181 against a limit of 220; bodies
80 / 116 / 105.

**GROUND DETAIL MUST BE THE COLOUR OF THE GROUND IT IS ON.** The ripples were `sahSandLit` in one
cut and `sahSand` in another, and `sahBuildGround` lerps the whole windward face toward
`sahSandLit` — so the plain-sand version read as a scatter of DARK wedges lying on a light dune,
i.e. litter. Corrugation is a lighting effect, not a paint job. And when the box became a quad the
effect vanished entirely, because **a quad has no side faces**: what makes a ripple field read is
two facets alternating, one turned toward the light and one away, so it takes two opposed quads
per pitch and they have to touch.

**THE RIPPLES WERE ALSO ORIENTED ALONG THE WRONG AXIS.** They were 2.2–5.0 m long in x and
0.4–0.8 in z — i.e. lying PARALLEL to a wind that blows along -x. Sand ripples form ACROSS the
wind. A whole desert of correct-looking code doing the exactly-wrong thing.

**OVERCORRECTION WAS THE PATTERN, EVERY TIME.** Three passes on Iceland's moss cap (hard octagon
→ a doily of identical pads at a constant radius → green pillars standing among the black
columns → right); three on the ripples (litter → venetian blind → invisible → right); two on
Iceland's crevasses (a painted line nobody could see → several hundred loose teal blades →
right). **The tell for the middle cut is always that the new thing is now the most prominent
object in the frame.**

**FOUR MORE CLASSES, ALL CHEAP AND ALL FOUND BY LOOKING:**

1. **A box centred at z with depth d has its front face at z − d/2.** Rio's Santa Teresa shutters
   were drawn at `z - d`, so twenty-six houses had two blue panels hanging half a house-depth out
   in front of them.
2. **A slab laid at a constant y across ground that is not level.** Iceland's road north was one
   `M.box(0, 0.03, 46, 9, 0.06, 76)` and the geothermal basin under the middle third of it sits
   0.6 m below zero: a grey plate hanging over a hollow. Sixteen plates following the terrain.
3. **Locals must probe `terrainHeight`.** Two more after Kyoto's miller and the Pantanal drover:
   Rio's bondinho man (`rioSTATION.z + 6` is south of `rioSHORE_Z`, so he stood on the SEA FLOOR)
   and Marrakech's maalem (`y: 0` at x = 182, where the hamada has lifted the ground four metres —
   buried to the shoulders).
4. **The done-flag gates the TASK, not the THING** — again. Iceland's puffin flush was gated on
   `icePuffinDone`, every bird was pushed to y = −400 when its timer ran out, and the cliff the
   chapter frames was bare for the rest of the save. Now: 26 s and the colony comes back, and the
   wheek re-flushes it for ever.

**SOLIDITY, MEASURED WITH `qa/audit-solid.js` BEFORE AND AFTER:** Rio 27 → 29, Iceland **105 →
17**, Marrakech **90 → 40**. Iceland's were seracs (34, "the only thing on the run that is a
HAZARD" and every one of them a picture of one), the harbour sheds and three moored boats, the
basalt columns outside a single square collider on a round plug, and eighteen fumaroles.
Marrakech's were fifty-two samples of twelve pisé walls. **What is left in all three is
vegetation, the crowd and terrain false positives — which is the Sydney/Pasto standard.**

Related: [[capy3-the-second-pass]], [[capy3-solid-or-drawn]], [[capy3-the-locals]],
[[headless-qa-harness]], [[capy3-world-size-audit]], [[capy3-the-picture]]
