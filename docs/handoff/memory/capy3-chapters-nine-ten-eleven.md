---
name: capy3-chapters-nine-ten-eleven
description: "What a deep second pass of the Drift, Venice and Hong Kong found: a girder over San Marco, a Symphony of one tower, and three verbs with no picture"
metadata: 
  node_type: memory
  type: project
  originSessionId: ed583c6a-9a0b-4895-b704-0a6ef5d90ff9
  modified: 2026-08-21T00:38:19.000Z
---

Done 21 Aug 2026, on "deep second pass of biomes 9, 10 and 11". The Drift, Venice and Mong
Kok. Unlike Sydney/Pasto ([[capy3-the-second-pass]]) where everything was in the tail, and
unlike Rio/Iceland/Marrakech ([[capy3-chapters-six-seven-eight]]) where whole systems were
drawn and not implemented, these three had **the right systems pointed slightly wrong** — and
in each chapter the thing that was wrong was the thing the chapter is named after.

**THE TRIANGLE COUNT IS THE TELL FOR "UNDER-BUILT".** Measured before: Drift 44k, Kowloon 39k,
Venice 72k, against Rio 120k and Pasto 98k on a 130k limit. Three of the four densest cities in
the game were the three emptiest scenes. After: Drift 52k, Kowloon 82k, Venice 111k, frame time
unchanged at 16.6–16.8 ms median in all five measured chapters.

## The single worst thing, and it was one ternary

`arcade()` in venice.js built its window bands with `ow = along ? 1.5 : d * 0.86` — using the
run length where it wanted the wall thickness. On a Procuratie that is nine metres thick and
thirty-four long, that hung a **thirty-metre concrete girder over Piazza San Marco at four
metres and another at seven, once per bay, on both sides.** They are in every screenshot of
that chapter and they are the first thing in frame at the top of the tide. Both branches were
wrong (each took the long dimension); the fix is `ow = along ? 1.5 : w * 1.02`.

**And the colonnade was inside the wall.** The piers, capitals and "shadowed back wall of the
loggia" were all drawn between y 1.0 and 9.4 of a solid block spanning the full nine metres, so
the most recognisable thing about that square — fifty metres of arches down each side — was a
blank cream cliff, and Florian's five tables were laid ACROSS the arcade (`x = venCAFE.x +
(i-2)*3.2` on a façade that runs in z), three of them inside the building. The loggia is a hole
now: piers on the façade line, a voussoir ring per bay with a stepped spandrel behind it, a dark
soffit, mass above — and the collider is the BACK of the block plus one compound body carrying
all forty piers, so the arcade is somewhere to be rather than something to walk round.

## The Symphony of Lights was one building

`hkUpdateShow` takes its beat from `game.music.beats()` and falls back to a fixed interval when
`!mus.playing`. There is a third state: **playing true, audio clock frozen** (muted, suspended,
a backgrounded tab, a context that never got its gesture). In it `Math.floor(beats())` never
changes, so `step` fired exactly once — measured over the whole 46-second window,
`litTowers() === 1`. Everything else about the show was correct, which is why nothing caught it:
the phase, the toast, the swell, the lasers and the camera lift all worked. **Watch for a
STALLED clock, not a silent one**: if the beat has not moved for two beats' worth of wall time,
stop believing it.

## Three verbs with no picture, and one lamp under its own shade

- **The puff** — the Drift's entire reason to exist — was two sounds and a velocity write.
  Nothing on screen. It leaves a ring of cloud now, which is also the only feedback that it has
  been spent.
- **The wind** is the chapter's clock and the only way to read it standing still was a vane on
  the Shelf, three islands from the lip where the decision is actually made. Pennants on both
  lips and on the arch.
- **The lampflies' brightness lived on a SHARED material**, so waking one brightened all
  forty-six including the twenty-two you had not touched. The gate is "wake six" and there was
  no way to look at the orchard and see which six. Per-instance colour, on an unlit material —
  a lampfly is a light, it does not receive one.
- The Shelf's lamp-post had its **shade drawn over its bulb** (cone 4.45–5.15, bulb at 4.62), so
  the one warm thing on the island the chapter opens on was an unlit brown cone, at night.

## THREE MORE CLASSES OF THE SAME MISTAKE: opaque things in front of the thing that matters

1. **A window surround 44 cm deep with the dark pane 36 cm inside it** is a blank white tablet.
   Both Procuratie read as pilasters. A surround is a FRAME — four bars.
2. **A "recess" built as a solid box** hides the doors and the lunette behind it. San Marco's
   five portals were five dark slabs.
3. **The façade plane is not where you think.** The basilica has a full-width Istrian band on
   the front of it (`31 x 11.2 x 1.2` at `bz + 10.9`, front plane `bz + 11.5`), so everything
   laid at `bz + 11.1` was BEHIND the façade. The jambs showed because they are 1.9 m deep;
   nothing else did.
4. **A lunette is the head of an opening, not a disc across it.** Two `cyl`s of radius w/2 laid
   face-on hung a two-and-a-half-metre gold coin in every portal.

## A LAMBERT SURFACE IN A NIGHT SCENE IS BLACK — for the fourth time in this file

Kowloon already knew it about ninety neon signs. The lasers were still `mat(...)` (a Lambert)
and so were the new harbour reflections: light on water is EMITTED toward the camera, it is not
a surface receiving a moon. `MeshBasicMaterial`, always. **And `instanceColor` MULTIPLIES
`vColor`, which only exists if the geometry carries a colour attribute** — a raw
`OctahedronGeometry` with `vertexColors: true` renders BLACK, which is how forty-six lampflies
briefly became forty-six holes. Merge one primitive through the biome's merger to get a white
colour attribute and the per-instance tint has something to multiply.

## Colliders built from the loop bound instead of from what was drawn

The Pasto terraces lesson, twice more:

- **Kowloon's tong lau overrun their own `while (z > hkST_Z0)`** by up to 5.4 m, because a block
  started inside the bound extends past it. Five and a half metres of building you walked
  through, on the approach to the pier, which is the way out of the chapter.
- **The market lane's collider gap did not match its drawn gap.** The row skips a block whose
  CENTRE falls between z 11 and 27, which opens z 6.5–28.1; the collider gap was 11–27. Four and
  a half metres of invisible wall across the mouth of the lane the chapter's fifth task is down.
- **The shopfront band is 70 cm proud of the wall** and the collider started at the wall, so at
  the one height the player actually is, the animal stood inside the shop.
- Both rows are one compound body per side now, built from the spans the merger actually laid.

Also: **Kowloon's roof cap was 35 cm above the surface the solver stands you on** (`h + 0.35`
centred, so `h - 0.35` to `h + 0.35`, against a collider topping out at `h`) — on the one roof
in the chapter the player is sent to. And Venice's rio had **sixty metres of retaining wall
standing 42 cm proud of the fondamenta with no collider on either side**: 42 is the worst
possible number, because the capybara steps over 40.

**SOLIDITY, MEASURED BEFORE AND AFTER** (`qa/s3-solid2.js`, which clusters the hit POINTS on a
6 m grid — the meshes here are merged, so the object's name tells you nothing and its position
tells you everything): Venice **304 → 128**, Kowloon **278 → 143**, Drift 61 → 96 (the rise is
the new drooping lip, which is deliberately outside the footprint). What is left in all three is
vegetation, the crowd, and the water's edge — the Sydney/Pasto standard.

## And nobody lived in either city

Venice had three locals and Mong Kok three, against Rio's eight and Kyoto's seven — in the most
photographed square in Europe and the densest street on earth. Five more in Venice (the café
orchestra, the passerelle crew, the seed man, a mask-maker, a fruit boat), four more in Kowloon.
Mong Kok also got **eighty pedestrians** on the Rio/Marrakech pattern with one thing those two
did not have: **the legs and the arms are on their own instanced meshes in antiphase**, so this
crowd walks rather than bobbing. Five draw calls. Anyone within 3.5 m stops and turns to look,
which is the whole of it.

**A pigeon was two boxes**, and there are a hundred and eighty of them in the shot Venice is
famous for. Body, head, tail, folded wings, feet; three morphs; a peck, a strut and a turn on
its own little clock; and wings that open when it goes up — one mesh per wing, because a flap is
the two of them going the SAME way and a single instance can only roll one way about its own z.

Related: [[capy3-chapters-ten-eleven]], [[capy3-drift-air-and-gravity]],
[[capy3-the-second-pass]], [[capy3-chapters-six-seven-eight]], [[capy3-solid-or-drawn]],
[[capy3-the-locals]], [[headless-qa-harness]], [[capy3-the-picture]]
