---
name: capy3-first-three-chapters
description: "capy3: the deep pass on Sydney / Pasto / Circular Quay — two worlds you could walk out of, a float driving through a fountain, and the camera inside every fig"
metadata: 
  node_type: memory
  type: project
  originSessionId: dc9b8d92-e436-4e40-b0ba-1fee4f3d15cc
  modified: 2026-08-23T15:57:36.751Z
---

24 Aug 2026, a deep pass on chapters 1, 2 and 3 (sydney = environment.js + npc.js,
pasto = pasto.js, quay = quay.js). Four findings are worth keeping.

**TWO OF THE FIRST THREE CHAPTERS HAD NO `bounds()` AND YOU COULD WALK OUT OF THEM.**
The Pasto fix in [[capy3-three-chapters-reported]] was never applied to the other two.
Measured by dropping the animal and ticking 3 s: Sydney stands at y = 0.18 at z = 200
and at x = ±140 — hundreds of metres past anything drawn — and is never rescued,
because capybara.js's soft floor holds it and `backVoid` only fires on a FALL or on a
published rectangle. The quay is the same at z = 200. Neither falls, so neither is a
"void" by the y-test; the only honest test is the RECTANGLE, and only pasto had one.
Sydney's is the UNION of land box and harbour (x ±142, z -152..96) because the water
is much wider than the lawn; the quay's is exactly its drawn sea. **Any biome whose
terrainHeight is an analytic law needs `bounds()`, and the test is a drop-and-tick at
absurd coordinates, not a fuzz run** — a random walk found it only after four minutes.

**THE CARROZA DROVE THROUGH THE FOUNTAIN, SIX BENCHES AND THE CATHEDRAL.** The mini's
lane was `pastoCAR_X = 0`, and the plaza's centreline is where the fountain is. The
cheap way to find this is not to read the geometry — it is to walk the route through
the chapter's OWN `navBlocked` at the vehicle's half width:

    for (z = 7; z <= 43; z += 0.5) if (g.pasto.navBlocked(lx, z, 1.62)) bad.push(z)

x = 0 came back solid 14.5–25.5 (basin + bench ring; the fountain's second collider is
rotated 45° so it reaches ±4.81, not ±3.4) and 35–43 (the church). x = 10.5 is clear for
the whole probe once the two north stalls move out to ±15.5. **Run that probe for every
rail, route and carrier in the game** — a kinematic body does not collide with statics,
so nothing ever complained.

**BUNTING AT 6.5 m IS BUNTING IN THE PLAYER'S FACE.** The papel picado across the Pasto
plaza looked right in a wide shot and was a disaster in the follow camera: the eye sits
at **y = 8.6**, so every run was BELOW it, cords cutting grey bars across the paving on
either side of the animal. Raised to 11.6 m at the posts with a 1.4–1.8 sag (lowest
9.8 m) it frames the top of the shot instead. Also: merged into a casting mesh, a 5 cm
cord six metres up is thinner than one shadow-map texel and stores as blocky bars on the
paving — overhead decoration gets its OWN non-casting mesh. **Judge any new overhead
geometry from a `g.tick(1/60, true)` frame at the real camera, never from a posed one.**

**THE CAMERA SAT INSIDE ALL THIRTEEN FIGS.** Standing under the fig at (-19, 5) the eye
is at 8.6 and the crown is 3.4–7.8: the whole frame is leaves and the capybara is not on
screen. The occlusion ray in systems.js cannot help — a canopy is render-only, there is
no body to ray against and there should not be — so this is exactly what `camCeil` is
for. `envCamCeil` returns 3.15 inside a fig crown and 2.65 inside a jacaranda's, and the
shot becomes an animal framed by a canopy. **`camCeil` is not only for roofs; it is for
any render-only thing the eye can get inside.**

Smaller things that measured wrong first: `quayRaceMask = -1` on completing 'yacht-race'
switched the whole block off, so the fleet stopped being counted at the second of six;
`quayEscortT = 1000` did the same to the dolphin escort. Both were "the task is done so
stop caring", and both destroyed the only number in their own task. **A completion flag
and a measurement must be separate variables.**

Related: [[capy3-three-chapters-reported]], [[capy3-put-me-back]],
[[headless-qa-harness]], [[capy3-the-middle-rung]], [[capy3-quay-is-two-places]]
