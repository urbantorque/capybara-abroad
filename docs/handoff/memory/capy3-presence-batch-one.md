---
name: capy3-presence-batch-one
description: "Batch ONE of /presence shipped — contact darkening and wind sway, the two tuning errors that were invisible in a screenshot, and the concurrent writer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 28afdbb2-9429-4783-9253-4cf83cf06089
  modified: 2026-08-27T23:50:45.981Z
---

Ran `/presence 1` on 28 Aug 2026. Both phases shipped. See
[[capy3-the-presence-pass]] for the audit that specified it.

**Contact** (`b7855e2`). A nearest-N uniform pool in `systems.js`
(`sysContactFrame`, 12 slots, camera-ranked, hysteresis, damped fade,
`sysContactClear` on every biome swap) feeding a term in `grain()`'s fragment
shader. Opted into the same 32 call sites that had already opted into the near
octave. **Two things were wrong in ways no screenshot could show:**

1. **The darkest part of a contact patch is underneath the object.** At a
   footprint 0.95x the object's half-width the capybara's whole patch fell
   inside its own outline — 0.74 % of the lower frame touched, mean darkening 6
   of 255. At **1.90x**, with the flat core pushed out to **0.45 of the radius**
   (just short of where the silhouette ends), it is 4.3 % and 15.1.
2. The vertical gate must be in **absolute metres**, not radii, or a big prop on
   a terrace reaches further down than a small one on the same terrace.

**Sway** (`28bc289`). `sway()` / `swayMesh()` / `swayTick()` in `shared.js`.
Two design points worth keeping: most chapter geometry is merged so "height
above the base" is unanswerable — the answer is a **window on a local axis
declared by the call site**, and on an InstancedMesh that window is the
instance's own frame, which makes instanced foliage the cleanest target. And the
world wind is pushed into local space **through the transpose** (`v * M` is
`transpose(M) * v`; GLSL ES has no `inverse()`), because `transformed` is
pre-instancing and a raw world push bends every frond of a crown a different
way. `swayMesh` does material **and** `customDepthMaterial` in one call, because
a shadow that does not sway walks away from the thing casting it.

Wired: Palawan (657 fronds), Rio (770 blades, shadows verified moving), Sahara
(4320, compiles but **not photographed** — the chapter spawns in Jemaa el-Fnaa
and the grove is out in the erg). **Sixteen chapters still do not sway.**

**Why:** the helper is the work and the wiring is per-place; half-wiring nineteen
chapters unverified is worse than naming what is left.

**How to apply:** batch TWO (`/presence 2`) is still unrun — point lights, floor
graphics, sun/lens. It is the batch with the perf gate and the re-grade.

**Three instruments that lied, and the one that did not.** A framebuffer
pixel-diff over time measures camera settle, not world motion. Zeroing the live
gust vector to A/B sway also moves the weather emitters. Advancing `state.time`
to isolate sway also advances `grainTick`'s sparkle. What worked: **an A/B
against an identical frame with the feature switched off inside one
`page.evaluate`**, with `dt = 0` so nothing else can step and the camera provably
static — assert it by returning `camera.position` in every row, and assert the
restore reproduces the baseline. The gate was finally proved by watching a real
hop: the patch fades 3309 → 6 as the animal rises to 1.89 m and returns
monotonically. Note `game.tick(0, true)` does NOT move `capy.group` when you
write `capy.body.position` — contact reads the group, so that test measured
nothing until it moved the group instead.

**This working directory has concurrent writers.** Another session committed
`e2941c0` mid-run with the same phase-1 source; `git diff e2941c0 <mine> -- src/`
came back empty, so it had committed the shared working tree rather than
duplicating work. Check for that before assuming a strange commit is a conflict —
and check `git log` before starting a batch here.
