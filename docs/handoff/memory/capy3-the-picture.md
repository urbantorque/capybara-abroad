---
name: capy3-the-picture
description: "The capy3 composite pass, the shared sky dome and grain()/sparkle — and the five things that measured wrong before they measured right"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9b8f9364-88b7-49d9-bae6-78b199c329ac
  modified: 2026-08-20T06:18:09.265Z
---

Added 20 Aug 2026. Until then capy3 handed the Lambert output straight to the canvas:
nothing at all between the scene and the screen, which is why every night in the game —
Mong Kok, the aurora, the lantern on the Shelf, the festoon over Göreme — was a set of
coloured shapes rather than a set of lights. Full architecture is in **CONTRACT.md ➜
"THE PICTURE"**; this file is only the things that cost time.

**1. `renderer.info.render.calls` does NOT include the shadow pass** when `autoReset` is
true — three resets the counter after the shadow map. Every draw-call figure recorded in
CONTRACT.md is therefore main-pass only, and a probe that sets `autoReset = false` reads
roughly DOUBLE and looks like a catastrophic regression. To compare against the historic
numbers, set `renderer.shadowMap.enabled = false` for the counting render.

**2. The bright-pass threshold is the whole trick, and it is per-biome.** In a night
chapter nothing on the ground clears 0.4, so a low threshold blooms the lights and only
the lights. **A chapter built out of white stone needs a HIGH one** — Venice at 0.94
bloomed the Piazzetta itself into one flat sheet of paper and the pigeons vanished.
Palawan is 1.04 for the same reason. Sunlit surfaces here read ~1.2 albedo by design
(see the lighting header in systems.js), so "just under 1.0" catches glare and nothing else.

**3. The sea sparkle measured wrong three times running.**
  - `smoothstep(cut, 1.0, n1*n2)` leaves every speck at a third of the strength asked
    for, because two multiplied noises almost never reach 1.0. It reads as *dirt*.
    A NARROW ramp (`cut .. cut+0.11`) saturates, and that is what a glint is.
  - Without a `fwidth` distance fade a one-cell speck a hundred metres out is sub-pixel,
    and a sub-pixel speck does not twinkle, it CRAWLS — the far half of the harbour
    boils as the camera moves.
  - An even dusting reads as television static. One very low-frequency drifting noise
    multiplied over the top turns it into bands, which is what a sun path looks like.
  - Cell size is in WORLD units and the camera is six metres up at 41°: 0.5 m cells are
    already sub-pixel at thirty metres. ~1 m cells is the floor.

**4. Rendering to a target loses the MSAA the whole art style depends on.** The post
chain's scene target MUST be `{ samples: 4 }` (WebGL2 multisampled RT, three resolves it
for you) or every low-poly edge in the game goes jagged. Half-float too, or values over
white are clamped before the bright pass ever sees them.

**5. `RawShaderMaterial` gets none of three's preamble.** Needs `glslVersion = THREE.GLSL3`,
`in`/`out` declarations by hand, and a **manual sRGB encode in the final pass** —
`outputColorSpace` only applies to built-in materials, and a render target's texture is
linear (`NoColorSpace`) by default.

**6. `grain()` must set `customProgramCacheKey`.** Without it three shares one compiled
program between the grained and ungrained variant of the same material config, and which
one you get depends on draw order. It also has to CLONE — `mat()` hands back a shared
cached material and compiling a hook onto it grains every mesh in the game with that hex.

Measured after: 16.7 ms median / 16.8 ms p95 at 1600×900 in all thirteen (locked 60,
unchanged), +1 draw call and +1 152 triangles per biome for the sky dome, `qa/fuzz.js`
13/13 clean. First entry to a biome peaks 33–100 ms while shaders compile; the white hold
in `biomeFadeTo` covers it, and every entry after is 17.6 ms.

Related: [[capy3-visibility-metrics]], [[headless-qa-harness]], [[capy3-chapters-ten-eleven]],
[[capy3-world-size-audit]]
