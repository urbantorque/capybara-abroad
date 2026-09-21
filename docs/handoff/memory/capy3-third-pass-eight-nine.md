---
name: capy3-third-pass-eight-nine
description: "The deep pass over Marrakech and the Drift: every arch turned in the wrong plane, a camp built on a flat datum over a dune, and a chapter whose peak triangle count nobody had ever measured"
metadata: 
  node_type: memory
  type: project
  originSessionId: d5b4bc86-16e2-4905-96b5-e7cb8b655097
  modified: 2026-08-22T15:53:00.370Z
---

Done 23 Aug 2026, chapters 8 (Marrakech) and 9 (the Drift). Where the second pass over 6–8
found *systems drawn and not implemented* and the third over 6–7 found *things standing in the
wrong place*, this one found **maths that was wrong in a way every number about it agreed
with**, and **one chapter measured at the wrong moment for its whole life**.

## EVERY ARCH IN MARRAKECH WAS ROTATED IN THE WRONG PLANE

`sahXform` composes Ry·Rx·Rz, and `Rz` turns a vector about the world Z axis: it maps +Y to
(−sinθ, cosθ, 0), which **always lies in the XY plane**. Bab Agnaou's horseshoe stands in the
YZ plane (it varies in y and z; x is the wall's thickness), so no value of `rz` can ever point
a voussoir along it. Every block in that ring was rolled sideways out of the wall instead of
being turned round the arch, and the rendered gate is a pile of slabs leaning at the camera.
Four arches in the file had it: the gate, its spandrel band, the mosque arcade and twenty
panels of blind arcading up the Koutoubia.

    arch in the YZ plane, position (X, CY + sin a·R, CZ − cos a·R)
      radial = (0, sin a, −cos a)   ->  rx = a − π/2
    arch in the XY plane, position (CX − cos a·R, CY + sin a·R, Z)
      radial = (−cos a, sin a, 0)   ->  rz = π/2 − a

drift.js got the XY case right and left a note about it ("THE ROLL GOES THE OTHER WAY"); the
note was correct **for its plane** and was copied into a file where the plane is different.

## AND THE GATE WAS THREE METRES FROM THE HOLE IN ITS OWN WALL

The wall was `z = -60 + i * 11` with a `continue` on `|z − sahGATE.z| < 7`, which skips
exactly one segment — the one at z = 17. So the gap in the masonry runs 11.5 → 22.5, centre
17, and the gate is authored at 14. Consequences, all measured off one rendered frame: the
south pier stood **entirely inside** a wall block, invisible, collider and all; the north pier
stood in the middle of the opening and swallowed half of it; and the arch sprang from 9.4 and
18.6, off the hole at both ends. Usable gap 6.3 m of the 11 that were drawn, on the only way
out of the city on foot. **The wall is laid FROM the piers outward now**, so the opening is
where the gate is by construction.

## THE CAMP WAS BUILT ON A FLAT DATUM AND IT IS ON A DUNE

Four tents, three carpets, the fire ring, three instruments and fourteen people, all authored
in a local frame whose origin is `sahTerrain(182, 20)` — **one number** — on ground that moves
more than two metres over the sixteen-metre crescent. The eastern tents hang with daylight
under the eaves, the western ones are buried, and the man at the north tent is a head and
shoulders sticking out of the sand. Fourth instance of this class (Kyoto's miller, the
Pantanal drover, Rio's bondinho man, this chapter's own maalem) and the first that is a whole
set piece rather than one person. Everything is world-authored now and asks `sahTerrain`.

## THE PEAK IS NOT THE NUMBER YOU GET AT THE SPAWN

Marrakech's 200 stars were six-by-four spheres — 7,200 triangles — and `sahStars.visible` is
false until the storm passes. Every triangle measurement this chapter has ever had was taken
at noon, so its real maximum was ~10,000 over anything recorded. **Measure a chapter that
changes its weather at its weather.** `qa/z8-peak.js` drives the storm clock through all four
phases and counts at each. Tetrahedra now: 800.

## THE OTHER SHAPE THIS PASS KEPT FINDING: GROUND DETAIL DRAWN AS OBJECTS

Five separate instances, and the tell is the same every time — *a thing which should be
scenery is the first thing the eye lands on*.

- **56 eight-sided worn patches** on Jemaa el-Fnaa, whose own comment promised "no edge
  anywhere". Painted into the ground grid's vertex colours instead: no triangles, no draw
  call, and a polygon edge is not a thing it can have.
- **26 eight-sided patches PER ISLAND** in the Drift, on twenty-five islands, including the
  two the marquee and the hardest jump stand on. The deck is a nine-by-seven painted grid now
  (126 triangles against 12) with mottling, moss in the middle and thinning at the torn edge.
- **The sand ripples did not touch in z.** 6.4 ± 2 m segments on a 9 m grid is 70 % coverage:
  a field of pale playing cards. And they were drawn straight across the **slipface**, where
  an 11 m plate on a 36° face is seen nearly edge-on from below — the shot from the foot of
  the lee side was a hillside of enormous pale spikes. A slipface is the one surface in an erg
  that is smooth. Same failure as the first "venetian blind" cut, arriving from the other
  direction: not the amount of the effect, the **angle it is read at**.
- **The walk-up track** was 80 plates at a constant y on a face climbing 25° AND falling 0.3
  m/m in z. Two gradients, sampled over each plate's own footprint.
- **110 scrub tetrahedra in cedar-dark** on pale sand: sharp black chips, i.e. litter. Third
  go at this bush (pale green pyramids → black chips → khaki, low, two lobes).

## A CREST IS THE SHAPE OF THE GROUND, NOT A THING ON IT

First attempt at giving the great dune a visible brink hung fifteen cornice boxes along the
ridge. Five metres of box laid at one height across a face falling at 36° puts its far edge
2.5 m in the air: a line of loose white paving slabs floating over the slipface, which is
exactly what Rio's breaking wave photographed as. It went into `sahCrest(z)` — four metres of
wander on two incommensurable periods, folded into `sahTerrain` — so the ground mesh AND the
collision heightfield get it for nothing, plus a painted lip and a shaded lee in the vertex
colours. The dune has a top edge you can see from the bottom now.

## THE DRIFT: A LAMPFLY ASLEEP WAS INDISTINGUISHABLE FROM A PIECE OF FLUFF

Not invisible — a previous pass fixed that — but a 33 cm octahedron at 0x9a8fb0 next to a
17–40 cm tetrahedron at 0xe8e0f6, sharing the sky. Twenty-two of them in the orchard and
nothing in the frame separates the creatures the chapter's second task is about from the
ambient seed-fluff. **The fix is not brightness.** A lampfly is a LIGHT, so it gets the one
thing no mote has — a halo, three times the size at a fifth of the strength, additive — and it
breathes in SIZE (0.26 → 0.50), which nothing inanimate in that sky does. The motes went
smaller and fainter so they stop competing. And a sleeping one now lifts and drifts away when
the capybara comes within three and a half metres, which is what makes a player try the noise.

## ARMED STATE THAT DOES NOT SURVIVE TRAVEL, TWICE MORE

- **`driSeedHeld` is an index and nothing cleared it.** Travel holding a seed-head and the
  consequences are all on the way back: it snaps to the animal's head on frame one, the
  velocity clamp that stops you falling is live before you have caught anything, and
  `driSeedRide` carries whatever was banked — so `driftseed` can tick from a walk you took in
  Venice.
- **`sahStorm` is a plain 0..1 that only `sahUpdateStorm` writes**, and that only runs while
  Marrakech is live. Leave mid-storm and it parks at 1.0 for ever; systems.js reads it on the
  first frame you come back, so the chapter reopens with the fog down and the wind leaning on
  you, in Jemaa el-Fnaa, with no brown line on the horizon. Parked (not cancelled — the done
  flag is untouched) and re-armed on the same approach rule.

## SMALLER THINGS WORTH NOT RE-DERIVING

- **The shadow traverse, in both files.** Marrakech: 150 transparent dust spheres, the fire,
  the star field and 4,680 ripple quads, all authored `castShadow = false`. The Drift: 300
  stars, the moon and its halos, five ribbons, fifteen additive column shells, 8,820 triangles
  of seed-head and the skein. Both files walk their own root after registering. Drift's
  shadow-pass triangles went 66,912 → 50,258 of 83,008.
- **Three nested column shells at the SAME opacity is still a band with an edge on it.** The
  step at the rim is whatever the outermost one is worth. Five, on a squared ramp 0.008 →
  0.044: the total through the middle is unchanged and the silhouette step is a fifth.
- **Three flat halo discs round the moon are three visible rings.** Same note as Iceland's
  sodium pools and Venice's arcade lamps: however many rings you draw, each is a flat value.
  One disc, fourteen rings deep, brightness per VERTEX on a squared falloff.
- **A warm Lambert in a night biome is black.** The Drift croft's new hearth embers had to be
  `MeshBasicMaterial`; the lamp's bulb four lines below in the same file already was.
- **The date palm — the one tree in ninety the chapter asks you to find — stood in the middle
  of the irrigation channel**, trunk, notch ladder, collider and task marker.
- **A frond is a flat thing.** 1,620 boxes at 12 triangles → 4,320 quads in a shallow V (two
  per segment, which is both the correct section and why it does not vanish edge-on).
- **Props: `sombrero`, `plantain` and `maiz` were scattered across Jemaa el-Fnaa**, and the
  Drift — an abandoned sky island lit by one moon — got two wheelie bins, two road signs and
  two traffic cones. Both rows in `physBIOME_SCATTER` are now the place's own household.

## NUMBERS

Marrakech **126,820 → 123,844** (peak 125,016 mid-storm), meshes 151 → 194, bodies **122 → 42**.
The Drift **67,652 → 83,008** (+23 %), meshes 112 → 125, bodies 65 → 75.
`qa/audit-tasks.mjs` 0 blockers; 9 s random-input fuzz clean on both (no NaN, no void falls,
`state.lastError` null); a real-clock soak with audio unlocked reports **zero console
messages**; gravity round-trips −24 / −8.6 / −24 across six switches; all twenty-five Drift
decks settle the animal at exactly +0.34; a driven closed-loop walk goes through the rebuilt
gate both ways, climbs the dune's firm shoulder to y = 32 and slides the whole slip band to
the bottom. Solidity residue is 44/3,827 in Marrakech and 14/206 in the Drift, all of it
crowd, vegetation and terrain false positives — the Sydney/Pasto standard.

Related: [[capy3-chapters-six-seven-eight]], [[capy3-third-pass-six-seven]],
[[capy3-third-pass-nine-ten-eleven]], [[capy3-drift-air-and-gravity]], [[capy3-the-picture]],
[[capy3-solid-or-drawn]], [[capy3-the-locals]], [[headless-qa-harness]],
[[capy3-props-in-every-world]], [[capy3-shared-space-leaks]]
