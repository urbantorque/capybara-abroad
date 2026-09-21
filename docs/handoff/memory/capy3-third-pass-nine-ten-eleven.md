---
name: capy3-third-pass-nine-ten-eleven
description: "The third pass over the Drift, Venice and Mong Kok: light that was never drawn, a show with seven seconds of material in a thirty-nine second window, and the two people who had always lived up in the Drift"
metadata: 
  node_type: memory
  type: project
  originSessionId: a79155fd-2684-49d4-92d3-68ff4c869900
  modified: 2026-08-21T02:17:52.896Z
---

Done 21 Aug 2026, a second deep pass over chapters 9, 10 and 11 after
[[capy3-chapters-nine-ten-eleven]] had already been through them the same day. Where that
pass found *the right systems pointed slightly wrong*, this one found **things that were
built and then not DRAWN** — and the reason all of them survived two audits is that every
number about them was correct.

## The pattern: measure the picture, not the state

Four separate findings, one shape:

1. **`grain(...).clone()` threw the shader away** on five water surfaces. Own file:
   [[capy3-clone-eats-the-shader]].
2. **The three pennant masts in the Drift went into the merger AFTER `M.build()`.** The
   merger takes geometry after it has been built; it just never draws it. So the chapter's
   three wind pennants — the only way to read the wind standing still, which is the whole
   pacing of the place — hung in mid-air on nothing. A static check for
   *`X.build()` then `X.box()` in the same function* catches it in nine lines and found
   exactly one instance in three files.
3. **Venice's arcade lamps were `mat()`** — a Lambert, no emissive — hung in the shadowed
   soffit of a loggia, with a comment above them claiming they were the brightest thing on
   that wall. The fifth time this family of chapters has learned that a LIGHT is
   `MeshBasicMaterial`.
4. **The loggia had no light in it at all.** A Lambert floor under a solid soffit gets the
   hemisphere and nothing else, so fifty metres of the most photographed colonnade in
   Europe was flat grey. Nothing in this game casts light: put the lamp in and PAINT the
   pool it throws. And put the pool on the floor that is actually there — `gy` is the
   arcade's datum sampled on the pier line, and two metres back the floor is 15–30 cm
   higher, so the first version was eight thousand triangles of light underneath the stone.

## The Symphony of Lights had seven seconds of material

`hkSHOW_ON..hkSHOW_OFF` is 39 s. Sixteen towers at 0.42 s a beat is **under seven**. For the
other thirty-two the far shore held perfectly still with all sixteen lit and the lasers
turning five hundredths of a radian. Nothing asserted it because `litTowers()` said 16.

Four movements now, and a movement changes on a BEAT, never on a timer, so it cannot drift
from what the player hears: **count-in** (one per beat), **wave** (a three-tower crest
running the shore and bouncing off both ends), **counterpoint** (odds against evens flipping
on the beat), **finale** (everything up with a shimmer across it, two chimes, a camera shake
and the swell taken from 0.8 to 1.0 — the build sits at 0.8 for half a minute precisely so
the last movement has somewhere to go). Measured per-tower `emissiveIntensity` at 1 Hz: the
max-minus-min across the shore now runs 0.58 / 0.58 / 0.08 / 0.22 / 0.01 / 0.13 through the
window instead of 0.00 flat.

## Reflections are a camera-facing smear, and it is now the house pattern

Mong Kok already reflected sixteen towers in the harbour with per-tower quads. Two more
places needed it and both are places you WALK ROUND, so a fixed direction is wrong from
three sides: **a reflection in a horizontal mirror always runs from the object toward the
viewer**, which is one `atan2` per reflector per frame.

- **Venice**: 28 reflectors (campanile, domes, three flagpoles, both columns, every arcade
  lamp), off under a third of the tide, gated per reflector on `isOverWater` so none of them
  paints dry stone.
- **Mong Kok**: 60 streaks on the wet road, one per neon sign, faded out as the camera goes
  up because a shallow-angle streak is nonsense from a roof.

Three things about the unit smear, all paid for:
- **ADDITIVE.** With normal blending the vertex-colour fade MULTIPLIES the water and a
  reflection of a gold dome renders as a slab of mud.
- **Three plates across, not one**, with the outer two at a third brightness — otherwise
  every strip has a hard side edge and a flooded square is a floor tiled in light.
- **The lateral falloff has to live wherever the per-frame writer is not.** Mong Kok's show
  rewrites every reflection vertex colour each frame from (tower colour × fade), so anything
  baked into the merged colour is gone on frame one. It goes in `hkReflFade`.

**And it saturates fast.** First cut of the wet road was 60 streaks up to 20 m long at 0.30
on a 13 m street: the tarmac came out brighter than the signs. Narrow, short, 0.085.

## Nobody had ever lived in the Drift, and that was the point until it wasn't

Chapter 9 was the only place in the game with no one in it — deliberately, because the
ground came off and took everything with it. But the chapter is *full* of somebody: a lamp
still burning, a bench facing the drop, a jetty, a pond, two carved posts on the lips of the
Long Gap and a nine-metre paper lantern somebody used to light.

Two people, and only two, and both at the far end: the lampfly keeper on the Orchard and the
lantern keeper on the Crown. You cross an entire empty sky alone — the solitude is the first
two thirds and it stays — and then, on the two islands the list already sends you to, there
is somebody. Same rule Venice uses: **nobody is a detour.**

And the furniture that argues for them, on five islands: a roofless house with a chimney and
a hearth fifteen seconds from spawn, cairns on the three stepping islands, a hoist on the
Anvil (the island named after a tool), the lampfly house on the Orchard, and a rail, a
bench, a stack of unlit lanterns and three offering bowls on the Crown. 51 352 → 66 480
triangles; bodies 30 → 54.

**Also: the wheek had exactly one responder in the whole biome** (a lampfly, within 9.5 m,
grounded only). The skein hears it now within 150 m and breaks formation — per-bird offsets
that are trigonometric functions of `i`, so the V re-forms in a different order over about
three and a half seconds — and lighting the lantern CALLS a crossing, so the two biggest
things in the chapter are in the same frame once.

## A NEW OBJECT DROPPED ON AN EXISTING PATH. Again.

The dai pai dong added to Mong Kok (four tables, sixteen red stools, a wok range with the
only fire in the chapter, an extractor, steam) filled the east pavement kerb-to-shopfront.
Measured: a capybara walking to the pier wedged between the range and the wall for **1 597
frames**. It straddles the kerb now — range hard against the shopfront, tables out in the
road where they really are — leaving a measured 1.5 m lane, verified by driving it from
z −12 to the pier at −59.7 and back. The crowd's outer lane is diverted round it on a
smoothstep, because forty people an evening were walking through the cook.

**And a stall blocking a pavement is not the same bug as a stall you can walk through.** Do
both checks: the solidity audit says *is it solid*, a driven walk says *can you get past*.

## Smaller things worth not re-deriving

- **A pool of light is ROUND and it is a CURVE.** Both Drift light pools and all sixty Mong
  Kok road pools were two nested boxes/octagons: a visible polygon with a hard step in the
  middle. Five or six rings of a **sixteen**-sided cylinder, dimming outward, additive.
  Eight sides is a shape at anything over about three metres across.
- **A single double-sided additive cylinder is a band with an edge on it** — exactly twice
  the sky everywhere inside the silhouette and exactly the sky one pixel outside, because a
  thin wall is the same thickness whichever way you look through it. The Drift's columns are
  three nested shells now (2 / 4 / 6 across the section) with a per-vertex top fade.
- **Venice's water sheet was ONE QUAD.** 72 × 34 now, with a small swell written into it —
  free, because the material is `flatShading` and three computes the flat normal in the
  FRAGMENT shader from derivatives, so it never needs `computeVertexNormals()`. But geometry
  cannot buy visible shading at that scale (a few degrees of slope over 4 m cells is 15 cm of
  displacement across the Piazza), so the light on it is two crossing waves and a diagonal
  multiplying the diffuse term in the shader — which also works from straight down, where
  half the chapter's cameras are.
- **`sparkleScale` 1.8 is 55 cm cells and they are sub-pixel thirty metres out**, so the
  distance fade eats them and the far half of the square has no glitter. ~1 m cells is the
  floor, as [[capy3-the-picture]] already said about the sea.
- **A hundred and eighty birds at random heights with almost no velocity is a cloud of
  flies.** The flooded flock wheels now: every bird damped toward its own place on a shared
  ring that drifts down the square, the outer ones travelling faster, heading AND bank both
  derived from where the bird actually went this frame, and a third of them gliding at any
  moment.
- **The one local whose whole character is a verb should do it.** Venice's seed man said
  "they know me. Watch —" and nothing happened. He throws every ten-odd seconds now and
  every pigeon within eighteen metres WALKS to it (a flock that flies to seed has been
  frightened). The passerelle crew answers the siren two seconds after the fourth tone.
- **The wok flame was inside the wok** (30 cm cone at 1.14, 42 cm wok spanning 1.01–1.23) —
  the Drift's lamp-shade-over-its-own-bulb, one chapter along.
- Kowloon 84 178 → 117 270 triangles, level with Rio. Frame time unchanged.
- `qa/fuzz.js` 17/17 clean; `qa/audit-tasks.mjs` 0 blockers; solidity residue is the crowd
  (106 of Kowloon's 129), instanced vegetation and the water's edge — the Sydney/Pasto
  standard.

Related: [[capy3-chapters-nine-ten-eleven]], [[capy3-clone-eats-the-shader]],
[[capy3-the-picture]], [[capy3-solid-or-drawn]], [[capy3-the-locals]],
[[headless-qa-harness]], [[capy3-visibility-metrics]]
