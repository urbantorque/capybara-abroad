---
name: capy3-the-sea-has-a-shape
description: "capy3 chapter 14 (Manly): the localWater hook, why a swell needs a phase table, and the five things that measured wrong first"
metadata: 
  node_type: memory
  type: project
  originSessionId: dcc928c7-6698-466c-a306-96ba0ca82238
  modified: 2026-08-20T10:58:37.845Z
---

Built 20 Aug 2026. For thirteen chapters `waterLevel` was a NUMBER — one height for
the whole sea — which is why Venice could have a tide (the number moves) and nowhere
could have a wave (the number is not a function of where you are).

**THE HOOK IS ONE FLAG: `localWater: true`.** capybara.js's `capyWaterY(env, x, z)`
then asks `waterHeightAt(x, z)` instead of reading the scalar. That is the entire
change to the controller; fifteen chapters cost one property miss. Everything that
already read it — the swim threshold, the float target, the clamber ceiling, the wake
rings, `capy.depth` — becomes correct on a wave for free, because all five had already
been rewritten as OFFSETS from "wherever the water is" for the Venice tide.

A biome publishing it must STILL publish `waterLevel`: the fog, the minimap and a
prop's rest height want the still-water level, not whatever a wave is doing this frame.

**`capy.swimming` is published now.** A biome cannot infer it from `capy.depth > 0` —
the depth of a capybara floating on its own waterline is zero and a passing wave makes
that number flicker. Same rule as `carriedBy` and `climbing`.

**FIVE THINGS THAT MEASURED WRONG, IN THE ORDER THEY WERE FOUND:**

1. **The flat outer ocean painted out half of every wave.** One big plane at the
   still-water level under the live surf mesh: a TROUGH is below that level, so
   wherever the live surface dips the flat plane is on top of it. Uniform sheet of
   `manSea`, crests poking through, and no `renderOrder` fixes it because both are
   opaque and the depth test is doing its job. Cut the flat water AROUND the live
   water — far, west and east, never under.
2. **One celerity everywhere gives a wave and a half across the whole view.** A wave
   in shallow water travels at `sqrt(g*d)` and its period cannot change, so it gets
   SHORTER as it shoals: 66 m out the back, 32 over the bank, 19 in the shorebreak.
   Integrated once into a 1-D table of accumulated phase against distance from the bar
   — exact for the whole bay because every profile is the same profile shifted by
   `manBankZ(x)`, and it makes crest lines contours of the bathymetry, so the swell
   refracts round the bar with no code about refraction.
3. **Foam as a function of DEPTH turns the whole inner bay permanently white.** It has
   to be phase-locked: about a third of a wavelength straddling the crest.
4. **Darkening the face and whitening the foam CANCEL.** They are in antiphase along a
   wave. Measured off the vertex buffer: crest (0.27, 0.40, 0.42), trough forty metres
   behind it (0.06, 0.35, 0.37) — a difference nobody can see, and the reason a
   two-metre swell rendered as a smooth gradient. Gate the face term on `(1 - foam)`.
5. **A ride is a FIXED POINT or it is nothing.** Broken-water push is
   `sqrt(g*(d+eta)) * (0.86 + 0.26*foam)` — faster than the bore where the white is
   thickest, slower at its leading edge — so an animal in the band is carried forward
   until the speeds match and then stays. That is trim, it needs no input, and it is
   the difference between a 13.5 m ride and the full 44-46 m ramp. Both measured.

The seaward face of a sandbar is a SLOPE (1:5), not a cliff: at 0.66 m/m the swell
went from ten metres of water to one in ten metres and never shoaled at all.

Related: [[capy3-slip-and-sky]], [[capy3-reference-frames]], [[capy3-the-picture]],
[[headless-qa-harness]]
