---
name: capy3-the-second-colour
description: "R6 of the character pass: a per-part colour in the instanced buffers, the eye that was inverted, and the roadmap row that could not be built"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T12:01:34.138Z
---

Built 6 Sep 2026, closing [[capy3-the-character-pass]] (all six items are in).
Code: `npc.js` THE SECOND COLOUR (R6), `capybara.js` A BAND plus the two
costumes. Instruments `qa/r6-colour.js`, `qa/r6-shots.js`, `qa/r6-wear.js`.
Left uncommitted with R1-R5.

**A `c` PER PART IN `npcMakeGeo` COSTS NOTHING.** The `color` attribute was
already on the buffer, filled with 1, and the material already had
`vertexColors`. Albedo is `material (sail) x vertex colour x instance colour`,
so a shoe is darker than the trouser and both still take that person's colour,
in one draw call for forty-five people. The helpers are `npcSRGB` (an sRGB
intent) and `npcOf(hex, ofHex)` (the ratio of two palette colours through
`THREE.Color`, which uses the REAL transfer; a plain power of 2.4 is 1.65x out
at the dark end). Same pair as the coat's `capyCoatK` / `capyCoatOf`.

**AN EYE WHITE CANNOT BE REACHED BY MULTIPLYING UP A DARK INSTANCE COLOUR.**
The plan was to keep `capyEye` per-instance and write 2.3 on the white. But
`capyEye` is **0.027 of full in linear**, so 2.3 lands at 0.06 and even 7.3
lands at 0.19; reaching `sail` needs 37 on red and 115 on blue. **Invert it:**
the instance colour becomes white so the eye white IS the material's own pale,
and the pupil carries the dark multiplier. Every multiplier is then at or below
1, the direction that cannot clip. Family of the nose pad in
[[capy3-the-hull-and-the-head]]: when a multiplier has to be large, the base is
wrong.

**AN EYE WHITE MUST BE THREE TIMES WIDER AT THE SIDES THAN ABOVE.** At a uniform
6 mm / 4 mm ring the pale reads as a pair of SPECTACLES, not as an eye. Only the
render showed it. Built 0.088 x 0.050 against a 0.058 x 0.044 pupil.

**"IS IT DRAWN" AND "DOES IT READ" ARE DIFFERENT QUESTIONS.** `qa/wear-parts.js`
said all four of the dinner jacket's satin boxes draw. The render says they are
four pale FLECKS on a black coat, which is exactly what Rio's collar comment had
already recorded about two slabs on the shoulders. A pixel-count probe cannot
answer the second question and nothing but looking will. (Rio's collar was then
measured with the same probe BEFORE being copied.)

**`renderer.info.render.calls` MOVES 2 TO 3 WITH NOTHING CHANGED**, because it
is taken from the live camera and the crowd walks: Sydney 149/151/151/149 and
Sahara 185/185/188 across runs of one build. Venice holds at 160 every time. The
tight measurement is the IN-FRAME A/B: render, scrub the attribute to 1 in
place, render again, same frame same build. Add to
[[capy3-instruments-that-cannot-hold-a-line]].

**A REVIEW ROW CAN NAME A FILE IT NEVER OPENED.** R6 asked for horn boxes on
"the herd body (`pantanal.js`), so the cattle read as cattle". That herd is NINE
CAPYBARAS whose own build note says they must read as the player's own species;
and the actual cattle, a different mesh, have had horns, ears, a hump and a
dewlap since they were built. Not built, and that is the finding.

**The game had no way to draw a collar.** `capyGeoRing` is an open tube (edge on
from the front, so a hairline) and `capyGeoDisc` is solid (it would cover the
face a ruff frames). `capyBandGeo` is an annulus segment with an angular range,
which the parka's ruff needs because it keeps a gap at the jaw. Winding checked
by signed volume before drawing, in node, not in the game.

Related: [[capy3-faces-and-bodies]], [[capy3-the-wardrobe]],
[[capy3-the-coat]], [[headless-qa-harness]]
