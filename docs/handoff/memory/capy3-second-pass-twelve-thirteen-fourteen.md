---
name: capy3-second-pass-twelve-thirteen-fourteen
description: "The second pass over capy3 chapters 12, 13 and 14: the launch field with no crew, the beach whose bathers never swam, and why the sparkle helper cannot draw a caustic"
metadata: 
  node_type: memory
  type: project
  originSessionId: 906bba61-7bac-4803-bae9-a703cedb5edb
  modified: 2026-08-21T04:05:43.371Z
---

Done 21 Aug 2026, a deep second pass over Palawan (12), Cappadocia (13) and Manly (14) —
the three newest chapters, none of which had been re-audited since it was built. Forty-odd
changes. The shape of the pass was different from [[capy3-the-second-pass]] (which found
furniture nobody collided) and from [[capy3-third-pass-nine-ten-eleven]] (which found things
built and then not drawn): **these three had systems that were DESCRIBED and not populated.**

## The pattern: the comment says a crowd, the file draws the equipment

Three instances, one shape, and all three survived because every number about them was right:

- **Göreme's launch field.** The file calls it "five crews, all at a different point of the
  same twenty minutes" and "the best-observed thing in this chapter". It drew five envelopes,
  five trucks, five floodlights, coils of rope, propane bottles — and **not one person**, at
  the hour when a Cappadocian launch field is the busiest place in the province. Twenty
  merged figures now (`gorFigure`, eleven boxes, four poses: standing / holding the mouth
  open / one arm out / bent at the waist, plus a sitting pose for the tea house). They are
  not `addLocal` locals — a local is somebody you talk to and there are only ever two or
  three; a crew is a CROWD and a crowd is geometry, the same argument as Rio's blocos.
- **Manly's bathers.** The chapter's first spoken line is *"swim between the flags, mate,
  that is the whole system"* and for its whole life `manScatterBathers` put every bather at
  `flagZ ± 5`. The flags live at z 30. The waterline is at 24. **Nobody on the beach whose
  entire subject is where you may swim had ever been in the water.** Two thirds of them are
  in it now, held ACROSS the span between the poles, standing on the seabed in the shallows
  and floating (`y = wave.y - 1.05`) once the water is over a metre, facing out to sea —
  which is also what makes moving the flags read as a consequence rather than as sixteen
  people shuffling four metres up the sand. The figure went from a cylinder and a sphere
  (a chess pawn) to legs/torso/strap/arms/head/hair/nose, still one instanced draw call.
- **Palawan's bangka.** The chapter's one working boat crossed the bay forty times an hour
  with nobody in it, past a jetty local saying "bangka leaves when the bangka leaves" — a
  man describing a ghost ship. The boatman is merged into the hull's own Group, so he rides
  with it for nothing. **A carrier's crew is part of the carrier.**

Locals: 2 → 7, 2 → 7, 2 → 8. The comparable chapters are Venice 8, Rio 8, Kowloon 9.

## THE SPARKLE HELPER CANNOT DRAW A CAUSTIC, and that cost an evening

The obvious build for Palawan's seabed light was `grain()`'s sparkle on an additive sheet,
on the theory that glitter on a surface and a caustic on the floor under it are the same
function one storey down. **They are not, and the reason is the shape of the ramp.** Sparkle
is two multiplied value noises through a NARROW threshold: it is tuned to produce a few
isolated points far brighter than everything round them, which is a specular highlight. A
caustic is the opposite — a continuous interlocking WEB with dark holes in it. At the
strength that made the net visible the whole reef went under a sheet of milk; at the
strength that did not, there was nothing there at all.

Two more things learnt on the way, both worth keeping:

1. **`grain()` adds the sparkle AFTER `<color_fragment>`**, so a per-vertex RGB fade gates
   the base wash and does *nothing at all* to the glitter. The mask has to be **vertex
   ALPHA**: an `itemSize: 4` colour attribute makes three define `USE_COLOR_ALPHA` and
   multiply `diffuseColor.a`, and under additive blending the source alpha scales the whole
   fragment. That is the only way to fade a grained additive sheet.
2. **A product of ridges is unsamplable.** The net is written in JS now:
   `ridge(u) = 1 - |sin u|`, three families at 0°/62°/121° (never 0/60/120 — that tiles
   hexagonally and reads as wallpaper), drifting at three speeds. The first cut MULTIPLIED
   them and raised the result to the fourth power. Mean of a ridge is `1 - 2/π = 0.363`;
   the product cubed and squared is **five parts in a million**, so the entire field
   measured as zero. **Summed and then thresholded** is bright where two or three lines
   cross and dark between, which is the picture. And the wavelength is set by the VERTEX
   SPACING, not by taste: 1.7 m cells need a 7–10 m period (4–6 samples a cycle); at 5 m
   it is noise.

## Bugs found, in the order they cost the most

- **A flat quad drawn with `manXform(x,y,z, -π/2, ry, 0, ...)` stands on its edge.** The
  helper builds its quaternion from an `'XYZ'` Euler, which three composes as `Rx·Ry·Rz` —
  so `ry` is applied BEFORE the lay-flat rotation, and rotating an upright plane about the
  vertical axis leaves it upright. Every rock pool in Manly was a green square standing in
  a ring of stones. **The in-plane spin goes in `rz`.** (`palXform`/`gorXform` use `'YXZ'`
  and do not have this.) Only a screenshot finds it.
- **Göreme's pigeons never came home.** `gorPigeonOut` was set to 1 by the dovecote task and
  nothing ever set it back, so 160 birds wheeled round that cliff for the rest of the
  chapter. They could not settle because they had nowhere to settle TO: the launch
  overwrote the only copy of where each bird had been sitting. Ten floats a bird now, and
  the last three are the hole it came out of.
- **The wisps were the UI and the UI was off by a layer.** `gorUpdateBalloon` asks for the
  wind at height ABOVE GROUND; `gorUpdateWisps` asked at ABSOLUTE y. The valley floor runs
  −2.2 to +10, against a `gorBLEND` of 9 — so a player who read the streaks, chose a height
  and burned to it could arrive in a layer going the other way, and nothing would ever have
  told them why. The wisp is DRAWN at its absolute height and the wind is EVALUATED at its
  height above whatever is under it.
- **Manly's flags: grabbing the eastern pole animated the western one.** The grab tests both
  (that was fixed once already) and the drag only ever moved `manFlagA`, so pressing E next
  to flag B teleported flag A into the capybara's mouth from eleven metres away.
- **Palawan's god rays did not reach their own holes.** Every shaft was centred at
  `height/2 − 9`, which put its top wherever the arithmetic landed: the reef one ran to
  y = +5 (five metres of glowing cone standing in the open air over the bay) and the
  CATHEDRAL one topped out at 18 under a hole in the roof at 26.2 — an eight-metre gap
  between the chapter's best picture and the thing it comes through. The table carries an
  explicit TOP now.
- **A local standing on a jetty must be ON the jetty.** Palawan's original boatman was at
  `palJETTY.x − 3` on a deck 2.4 m wide about x = 6: a metre and a half off the side,
  standing on air over the sea since the chapter shipped. Found by a probe that prints every
  local figure's `y` against the live `terrainHeight` — worth keeping (`qa/p4-locals.js`).
  It reports the two who are genuinely on the jetty as +1.4 and +1.8; that is the detector
  being honest about a structure it cannot see, not a failure.
- Manly's pelican allocated two Vector3s every time it moved. Palawan's water sheet used
  `grain()` (a CACHED clone keyed on `mat()`'s own cached uuid) and then had an emissive
  written onto it every frame — `grainOwn` exists for exactly this; see
  [[capy3-clone-eats-the-shader]].

## Solidity: the residue was three objects, and all three were big

`qa/p4-solid.js` before → after. **Palawan's beach mesh 662 → 179** (four nipa huts and
three nine-metre bangkas; the hut box is round the ROOM, not the whole hut, because you walk
under a house on stilts and that is what stilts are for). **Manly's point mesh 263 → 19**
(22 boulders to 2.6 m, 9 more at Shelly, the board rack, bins, bike racks — one compound
body per cluster, `manPoolBody`). **Göreme's tether envelope 50 → 19**, which forced the
better decision: the task zone was a circle round the envelope, so *"chew through something
important"* fired while you stood INSIDE a balloon. It is on the CROWN LINE now, which is
the thing you would actually bite, and the beacon moved with it.

What is left in all three is vegetation, the crowd and terrain false positives — and the
field/town meshes went UP, because merged people are never solid. That is the Sydney/Pasto
standard.

**And raising a collider to its drawn height can make a trap.** The ocean pool's wall was
drawn to 1.95 and collided to 1.35; matching them adds 60 cm to the climb out of a pool
whose floor is at −1.45. Driven three ways out of the water before shipping it — the
sea-wall clamber handles it (maxY 3.7 over a 1.95 wall) — but *test the escape, not the
wall.*

## The juice, and the two that were nearly wrong

- **Twenty-seven balloon shadows, painted.** The shadow map is fitted to a 44-unit box that
  follows the capybara, so a balloon stops casting the moment it clears about twenty metres:
  a valley with a hundred and fifty envelopes over it was completely unmarked. One flat
  16-gon disc per balloon (eight is a visible polygon at twelve metres across — the Drift
  and Mong Kok both paid for that), thrown WEST by an amount that shrinks as `gorSun` runs,
  so the whole field of shadows walks in toward its own balloons over the sunrise.
- **The burner lights the envelope from inside** — the picture of that valley, and the
  chapter did not have it. It is also the strongest possible feedback for a lever that takes
  four seconds to answer anything: pressing it now does something instantly and enormously,
  which makes the lag bearable rather than dead. The five field crews' burners flash on
  their own clocks. All of these need `gorVCOwn` (grainOwn), or the town, the valley, the
  cliff and the herd light up too.
- **The dawn arrives as a LINE and the line comes DOWN.** `gorSun` used to move the sky, the
  disc and the score — all background. A light line descending from above the ceiling to the
  valley floor, with every envelope above it multiplied toward the sunrise colour, is the
  reason those photographs exist.
- **Manly's swash band.** The surf mesh buries itself 6 cm under the sand wherever the water
  is below the ground, painted a colour nobody ever sees. Where the water has only JUST left
  — under 30 cm of drop — it is drawn 1.5 cm PROUD in wet sand instead, so the tide line
  runs up and down the beach every eight seconds for two triangles a cell.
- **Spray is a property of the WAVE, not of the observer.** Manly's only spray fired within
  fourteen metres of the capybara, so a wave breaking forty metres up the beach threw
  nothing. It walks the break line now — and **it had to be rationed hard**: thirteen throws
  a second into a 64-particle pool dusted the whole bay with white spheres and the sea read
  as litter. 0.19 s, and only where `foam > 0.42`.
- Same failure, different mechanism: **`sparkleScale` 0.85 is 1.18 m cells**, which from six
  metres up is a fifteen-pixel white blob. A field of fifteen-pixel white blobs is not
  glitter. 1.35 and a higher cut is the same light in twice as many pieces.
- Bubbles off a diving capybara, at a rate that is the STAMINA BAR (a full tank lets one go
  every 1.4 s, nearly out is streaming) — the chapter's central resource, in the world
  instead of in the corner of the HUD. And they carry the plankton up during the bloom.

## Smaller things worth not re-deriving

- **The wheek had no answer in Cappadocia at all** — not the 400 pigeons, not the eleven
  horses, not the twenty people. Now: the flock goes up from 100 m (further than E reaches,
  and the correct verb — nobody has ever put a flock up by touching a cliff), the mare goes
  up a gear without changing SPEED (she has a passenger), and the valley gives it back twice
  at 1.15 s and 2.35 s, which the plaza local had been promising since the chapter shipped.
- Palawan's schools bolt from a wheek as an OFFSET on the circle each fish is already on, so
  the school re-forms by itself with no state machine.
- The sea turtle is a reptile and never surfaced, in a chapter about holding your breath.
  92 s cycle, deliberately not a factor of the bloom's 124 — two clocks that share a factor
  are one clock.
- **A jittered grid, not a scatter.** 22 independent `rand()` draws over a 28×36 patch put
  nine boulders in one heap. A grid with ¾ of a cell of jitter still looks random and cannot
  clump.
- Göreme's `api` had `field:` twice.
- Manly's marquee ticked a box and made no noise; a fifty-metre ride ending on the sand in
  front of twenty people got less ceremony than knocking a pine cone down.

Measured after: **17/17 clean on `qa/fuzz.js`**, `qa/audit-tasks.mjs` 0 blockers over 198
tasks, frame time **16.6–17.0 ms median / 18.4–18.9 p95** in all six chapters sampled
(Pasto, Venice and Sydney are untouched and moved the same amount, so the p95 is the
machine). Triangles: Palawan 108,555 → 116,871, Göreme 79,024 → 82,860, **Manly 37,388 →
49,338** (it was the thinnest world in the game by a distance). Bodies 61 / 86 / 72.

Related: [[capy3-dive-and-balloon]], [[capy3-the-sea-has-a-shape]], [[capy3-the-locals]],
[[capy3-solid-or-drawn]], [[capy3-the-picture]], [[capy3-visibility-metrics]],
[[headless-qa-harness]]
