---
name: capy3-the-depth-pass
description: "v45 — the depth texture and the three terms it bought, the broad octave, and the five things that measured wrong before they measured right"
metadata: 
  node_type: memory
  type: project
  originSessionId: 29e889c9-47e2-4900-8427-f195ecba9825
  modified: 2026-08-30T10:31:19.142Z
---

Ran 30 Aug 2026 from a "deep pass on aesthetics, top five opportunities, then
build them" brief. Commits `f1001ab` (depth) and `153a721` (broad). Full
architecture is in **CONTRACT.md ➜ "THE DEPTH PASS (v45)"** and **"THE BROAD
OCTAVE"**; this file is only what cost time.

**THREE OF THE FIVE OPPORTUNITIES WERE ONE CHANGE.** The review found the frame
uniformly sharp from 2 m to the fog, no aerial perspective inside the playable
band, and no ambient occlusion anywhere — and all three wanted the depth
`sceneRT` has always written and always discarded. Attaching a `DepthTexture`
costs the resolve. **Probe the multisampled resolve before building on it**
(`qa/depthprobe.js`): it works here, but a driver declining would have taken the
whole post chain down.

**FIVE THINGS THAT MEASURED WRONG FIRST.**

1. **THE NEAR BLUR WAS AIMED IN FRONT OF THE PICTURE.** I set the ramps from the
   camera height and pitch. `qa/depth-map.js` raycasts a 3×5 NDC grid and the
   real resting frame is **9.3 m at the bottom edge, 12 m at the animal, 16–18 m
   centre, 27–42 m upper third** — remarkably consistent across chapters,
   because the rig holds 12 m. My near ramp was 2.8..7.5, i.e. entirely in front
   of the nearest visible thing, and it measured **byte-identical** in two of
   three bands. Off the real numbers: −22.8% top, −17.8% bottom, −1.1% middle.
   **Never author a distance in this game without raycasting the frame first.**
2. **A NAIVE DEPTH-DIFFERENCE AO DARKENS EVERY LAWN.** The biggest grazing plane
   in every frame is the ground and it is half the picture, so a single tap
   finds a neighbour tens of cm nearer and calls it a corner — 2.8 of 255 off
   Sydney's grass. **Four OPPOSED PAIRS, take the min of each:** on any flat
   surface one side is nearer by exactly as much as the other is further, so the
   pair cancels; in a real corner both are positive. Free (the taps were already
   read), exact, and it took the same measurement to **0.001 of 255**.
3. **SYDNEY'S SKY DOME WAS THE ONLY ONE IN THE GAME WRITING DEPTH.** A 300 m
   sphere in a 400 m frustum, so the "exempt the sky" gate — a rolloff at 0.9 of
   far — never fired and the chapter came back milky. The exact gate is
   `rawDepth < 0.999999` (an untouched buffer is precisely 1.0), and Sydney had
   to be made `depthWrite:false` to participate. That also lifts a latent
   depth-clip on anything past 300 m. **Clone before writing a flag** — `mat()`
   hands back a shared cached material.
4. **CHROMA IS THE METRIC FOR HAZE, NOT LUMINANCE.** The air was authored at
   ~2× and Sydney's harbour went grey-green, and the luminance probe could not
   see it because mixing toward a pale haze RAISES the mean. `qa/depth-chroma.js`
   measures the air term ALONE (a defocus also lowers local max-minus-min, and
   that is a blur, not a desaturation — mixing them spends the budget on the
   wrong term). **Sydney at −14% top band is the calibration point.** Eleven of
   nineteen were past −12% first time; eight were retuned.
5. **NO PROBE THAT CALLS `game.tick()` CAN A/B ANY OF THIS.** Even at `dt = 0`
   the camera walked 0.16 m over five arms. Drive **`post.render()`** instead —
   same scene, same camera, and `sysDressFrame` never runs so it cannot
   overwrite the params. And **capture every arm before decoding any of them**:
   `await` yields to the event loop, the event loop is where rAF lives. With
   both, the camera is identical to four decimals in every row, and that
   assertion is in the output.

**A FOCUS DISTANCE IS A MULTIPLE OF CAMERA-TO-ANIMAL, CLAMPED TO 11..60 m.** The
multiple is what makes it survive a condor and a balloon. The clamp is what
stops a camera pinned against geometry collapsing the field: at a floor of 8,
Antarctica and Manly both sat ON it and the Antarctic boat — 30 m out, where a
task sends you — came back soft. **A focus field that defocuses what the card
points at is a bug however good it looks.**

**THE SECOND SHADOW CASCADE WAS RETIRED BY MEASUREMENT.** `sysSHADOW_HALF` is 22,
so nothing past a 44 m box round the animal casts a shadow, ever — which is most
of the frame in the wide chapters. The air and the crease already carry the
distance, so a cascade would buy a whole extra shadow pass for something behind a
haze and inside a defocus. Same call as the sun glow in `/presence 2`. Revisit
only if a chapter ever brings the far field back into focus.

**`broadM` IS A WAVELENGTH IN METRES.** Every other octave in `grain()` is a
multiple of `scale`, which is 0.24–0.62 per chapter — one multiplier would put
the patch field at 18 m in Kyoto and 46 m in Hanoi. Hue and value come off ONE
sample and are correlated on purpose (bright→warm, dark→cool), which is the
physical case. Both options must go in `key`, which feeds the material cache
**and** `customProgramCacheKey`.

Measured after: **16.2–16.8 ms median / 18.2–20.1 p95 in all nineteen**, 0
errors, every row asserting its own biome, `qa/fuzz.js` **19/19 clean**.
Composite delta +0.01 to +0.46 ms — and **the timing instrument's own noise
floor is ±0.1 ms** (three of five per-term deltas came back negative, which is
impossible), so only the total is quotable.

Verification for any future pass: `qa/vr30.js` (the 19 arrival frames),
`qa/depth-ab.js` (the exact A/B), `qa/depth-map.js` (where the frame IS),
`qa/depth-chroma.js` (the saturation budget), `qa/depth-perf.js`,
`qa/depth-sweep.js`. Switches are `noDepth`, `noDof`, `noAir`, `noCrease`.

Related: [[capy3-the-lens]], [[capy3-the-picture]], [[capy3-presence-batch-one]],
[[capy3-presence-batch-two]], [[headless-qa-harness]],
[[capy3-instruments-that-cannot-hold-a-line]]
