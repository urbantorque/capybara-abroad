---
name: capy3-third-pass-six-seven
description: "The third pass over Rio and Iceland: a marquee task behind a 168 m wall, a hot spring with a lid on it, and the traverse call that turns every castShadow=false in the game back on"
metadata: 
  node_type: memory
  type: project
  originSessionId: 270144b7-67a8-4cd6-8e41-de9872590f05
  modified: 2026-08-22T12:28:19.835Z
---

Done 22 Aug 2026, a third deep pass over chapters 6 and 7 after
[[capy3-chapters-six-seven-eight]] had already been through them. Where that pass found
*systems that were drawn and not implemented*, this one found **things that were implemented,
drawn, correct in every number, and standing in the wrong place.**

## The two worst were both PLACES YOU COULD NOT GET TO OR SEE

**RIO'S MARQUEE TASK WAS BEHIND A HUNDRED AND SIXTY-EIGHT METRE WALL.** `rioBuildAvenue` gave
each grandstand ONE `rioStaticBox` `rioAVE_X1 - rioAVE_X0` long. Measured two ways: a driven
closed-loop walk from the spawn stops at **z = 24.4** and slides sideways along that line for
the rest of the attempt, from x = 0 and again from x = 40; and a sweep of `navBlocked` over
every x from -110 to 110 returns `firstBlock = 24.5` for **every x in [-84, 84]** and null
outside. So `samba-parade` (the chapter's `wow`), the bateria, the float and the only route on
to Lapa and Selarón were all behind an unbroken barrier whose only way round was 86 m of detour,
with the task beacon pointing straight through it. Four sectors a side now, five gangways with
vomitório arches, one of them **on the centre line so the way inland from the spawn is dead
ahead**.

**AND THE SECOND OBSTACLE HAD TO LINE UP WITH THE FIRST.** The new Avenida Atlântica frontage
went in on a 21 m pitch against the stands' 33.6 — so a cross street let you through the
buildings and then you met the grandstand and had to hunt up to seventeen metres sideways for a
gangway. *Two obstacles with gaps in them at different spacings is a maze and the player has no
map of it.* Both on 16.8 m now, and the sweep reports clear straight runs at x ≈ 0, ±33, ±67.

**ICELAND'S HOT SPRING HAD A LID ON IT.** MEASURED: pool floor −2.10 at the centre, water
surface −0.30, capybara floating at −0.99 with `wet = 1` — and the silica rim was
`M.cyl(x, 0.06, z, iceSPRING.r + 1.8, 0.14, …)`, an **eight-sided disc 10.3 m in radius spanning
y −0.01 to +0.13**. The water disc is 8.8 m. So a solid tan plate covered the entire spring 43 cm
above its surface, and the site of the only task in the game that asks the player to do NOTHING
— and the trigger for the aurora — was a dry mound with the animal submerged underneath it. A
rim is a RING and it follows the ground it is on.

## THE TRAVERSE THAT UNDOES EVERY `castShadow = false` IN THE GAME

`sysEnableShadows` is `o3d.traverse(n => { if (n.isMesh) n.castShadow = true })`, and
`registerShadowTarget(root)` is the **last line of every biome's build** — so every
`castShadow = false` written anywhere in a biome file is silently undone four lines later. The
proof is the hot spring: a dozen hard grey hexagons painted on the silica where the steam is.
It also means the aurora curtains, 260 stars 300 m up, the pools of sodium light on the road
(the thing the shadow would be falling ON), the geyser column and every water surface in both
chapters were all in the shadow pass. Both files now walk their own root after registering and
turn it back off for anything `transparent || depthWrite === false || AdditiveBlending`.

## A LAMBERT IS THE WRONG MATERIAL FOR SMOKE IN A NIGHT BIOME

Iceland's steam was `mat(iceSteam, {transparent, opacity})` — a diffuse surface under a sky with
almost no light in it, so every facet pointing away from the low sun came back **near-black**.
The shot of the spring is pale hexagons with dark grey ones interleaved. Self-illuminated
(`emissive`, the same law the windows, the beacon and the stars already use) and it is one even
value from every angle. The plumes were also SEVEN METRES ACROSS — `iceSteamSync` grows a
particle to `scale * 2.74`, and `rand(1.4, 2.6)` over a 17 m pool hid the pool, the animal and
the task. The chimneys had already learned this and the spring had not.

## FOUR MORE THINGS IN THE WRONG PLACE, ALL FOUND BY LOOKING AT ONE SHOT

1. **A quay shed was built on the pier.** `x = -18 + i * 13` puts the fourth at 21, ten metres
   wide, i.e. 16→26; the pier is at 26 with a 5.4 m deck, i.e. 23.3→28.7. The landward end of
   the only way OUT of chapter 7 ran into the side of a building, collider and all.
2. **The pier's furniture was strung out over a hundred metres of open sea.** `len` is 16 m and
   the loop laid nine groups at 13.2 m centres: eight of the nine hung 2.5 m over the water in
   a dead straight line pointing away from the pier head.
3. **The harbourmaster stood 0.6 m inside the deck** (`y: 0.8`, deck top 1.4). Probing
   `terrainHeight` would NOT have saved him — the causeway under the boards reads 1.0. *Some
   floors are drawn, and you have to ask the drawing.*
4. **Rio's kiosk vendor was inside the kiosk** — a 4.6 m solid drum centred on him, invisible
   from every angle, his collider inside its collider.

## THE PUSH AND THE PICTURE HAVE TO BE THE SAME WAVE

`rioWaveLift` and the foam mesh both put the crest at `wz + rioWaveBow(x)`. `rioFlow` used
`z - wz`. Over an 84 m break with a 10 m bow that is **up to ten metres of registration error at
the shoulders**: you sat in a pocket that was not under the crest, or under the crest with
nothing happening. One term.

## THE BREAKING WAVE, ON THE FOURTH ATTEMPT, IS A RIBBON

Four boxes (a dead-straight white board). Eighteen segmented boxes (a crenellated sea wall).
Thirty-eight jittered boxes, which is what shipped — and the shot is **a line of loose white
paving slabs lying on the water**. The note above that cut says "a lip is ragged or it is a
plank" and was right about the diagnosis and wrong about the cure: what makes thirty-eight
independent boxes read as thirty-eight boxes is not that they are too regular, it is that
**THEY DO NOT TOUCH** — each carried its own 0.7 m z-jitter, so consecutive pieces of one
continuous object stood at different heights with sea between them.

A nine-point profile (tail of the soup → whitewater → back of the face → crest → lip →
**back under the lip**, which a lofted ribbon is perfectly happy to do → foot) lofted along 56
stations that SHARE their edges. Continuous by construction, ragged because the profile moves
per station rather than because the pieces do, and 672 triangles instead of 1620. Two further
things it needed:
- **The foam has to sit on the water the wave has already lifted.** The first ribbon put its
  whitewater 2–5 cm over `rioSEA_Y` while `rioWaveLift` raises the sea itself by 1.7 m over a
  7.5 m back — so everything behind the crest was under the surface it lies on and the crest was
  level with the water. The profile follows the sea's own back curve and rides 16 % over it.
- **The inside of the curl is not white.** It is the only face the camera sees from underneath,
  and white geometry lit from below by a sand-coloured ground bounce comes back KHAKI — a brown
  seam along eighty metres of surf.

## SPARSE LONG PIECES CANNOT BE A TEXTURE

Two cuts of glacier surface detail, wrong in opposite directions, and the second is the
instructive one. 320 pairs of 16 m quads: a BARCODE. Halving the sizes and softening the values
turned the barcode into **a scatter of planks**, which is worse — each piece is now a distinct
object lying on the ice instead of a pattern in it. The lesson is not about amplitude: either it
is dense enough that the eye stops resolving individuals, or it must not be geometry at all. It
went into the ground mesh's own vertex colours (arced foliation banding, which is what ice that
has come round a bend actually looks like), where it costs nothing and can never read as an
object. Same family as [[capy3-chapters-six-seven-eight]]'s three goes at the moss cap.

## A POOL OF LIGHT HAS NO STEPS IN IT, AND THE FALLOFF LIVES IN THE VERTEX COLOURS

Three goes: eight-sided cylinders (a hard octagon), four sixteen-sided ones (a bullseye — three
concentric bands and a solid disc in the middle), eight flat discs (**still** banded). The count
was never the problem: each ring is one flat colour, so however many you draw there is a step at
every boundary. Four concentric rings of sixteen segments with the brightness written **per
vertex** on a squared curve, additive, unfogged — no edge anywhere. Same helper does the
fumarole glow, and the same argument rebuilt Hallgrímskirkja's floodlight as one quad per column
with a vertical gradient (two triangles instead of seventy-two). And the tint must be NEUTRAL:
the stepped version wrote `(v, v+6, v+14)`, which at the dim end is **pure blue**.

## AND THE OTHER HALF OF EACH CHAPTER THAT WAS NOT THERE

- **Rio had no city.** Between the calçadão and the Sambódromo were 120 m of open ground with
  seventy palms on it. The whole city shelf — avenue, grandstand apron, Lapa, the foot of the
  arches — was painted BEACH SAND by a bare `else` in the colour rule, so the aqueduct stood on
  a beach. Ten blocks of Avenida Atlântica frontage (balconies, plinth shopfronts, roof tanks,
  washing) and a ground palette with road, pavement, median garden and hillside in it.
- **Arpoador was tested by HEIGHT** (`y > 4`) and a 13 m dome sampled at 4 m never returned a
  vertex over the line: the one landmark at the west end came out as a sandcastle with grey
  boulders on it. Landmarks are tested by DISTANCE now, which mesh resolution cannot lose.
- **Every person in Rio was a torso with a brown plank on top.** The hair box was 0.30 wide on a
  head 0.29 across and this camera looks DOWN. Hair on the back of the crown only, plus a nose —
  the locals in npc.js have had one since they were written; the crowd never did. And the head
  is now placed by taking the local `(0, h, 0)` through both rotations: the old version used the
  feet's x and z with a fudge on y, so twenty-two sitters had their heads floating in front of
  their chests.
- **The desfile was sixteen drummers and an empty trolley** — no ala, no destaque. Sixteen
  dancers walking with the section and six on the float, all keyed to `rioBateriaX` so nothing
  can drift.
- **The futevolei court had four people standing still round a ball** the chapter then asks you
  to head into the Atlantic. They rally now: one impulse every second and a half from whoever is
  nearest, never the same person twice running, never while the capybara is on the ball.
- **The puffin colony was 150 statues** until you wheeked once. Shuffle, head turn, a preen
  every eight seconds, and fourteen of them permanently in the air on a tight circuit.
- **The arctic fox had no answer to the wheek.** It hears at 40 m, yips, and comes two thirds of
  the way over to look at you — which is exactly what an animal with no land predator does.

## NUMBERS

Rio **121 112 → 124 716** triangles, bodies **99 → 68**. Iceland **116 418 → 121 390**, bodies
**132 → 35**. Both were near or over the contract's caps before; the headroom came from
*reclamation*, not restraint: warped ground grids (Rio 17 200 → 11 200 with 2.4 m cells through
the beach instead of 4.0; Iceland 22 464 → 17 888), a warped sea (10 944 → 6 912), the wave
ribbon (−2 800), and the crevasse ribbons (**11 520 → ~2 400**).

**AND THE BODY BUDGET IS AN ARTEFACT OF ONE HELPER.** `iceStaticBox`/`rioStaticBox` spend a whole
`CANNON.Body` per box, so Iceland was at 132 against a hard 130 and it was not one big thing — it
was 46 houses, 34 seracs, 18 fumaroles, 11 cars and 5 sheds. One body per ROW of things
(`rioStaticGroup` / `iceStaticGroup`, registering each shape in the nav index exactly as before)
took Iceland to 35. **Caveat for the next pass: `qa/audit-solid.js` skips a sample point that
falls inside any collider's AABB, and it computes that per BODY — so a grouped body's AABB
spans the whole town and the audit reports a suspiciously clean world.** `qa/y67-solid.js`
enumerates SHAPES with their offsets instead; honest results are Rio 23 (11 of them the
instanced palm trunks) and Iceland 6.

`qa/audit-tasks.mjs` 0 blockers; the pointer audit returns [] for both; 9 000-frame fuzz clean on
both with no NaN, no void falls and `state.lastError` null.

Related: [[capy3-chapters-six-seven-eight]], [[capy3-solid-or-drawn]], [[capy3-the-locals]],
[[capy3-the-picture]], [[headless-qa-harness]], [[capy3-things-that-are-simply-there]]
