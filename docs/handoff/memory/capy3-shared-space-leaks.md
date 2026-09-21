---
name: capy3-shared-space-leaks
description: "The capy3 bug class of 19 Aug 2026: all biomes share one coordinate space, so any position test or stateful actor not gated on the LIVE biome leaks across worlds"
metadata: 
  node_type: memory
  type: project
  originSessionId: 26dc1817-2ec8-460c-b77f-3ffa2f399471
  modified: 2026-08-18T19:44:04.138Z
---

Every biome is authored in the SAME world coordinates and only detached, never moved. Two
standing rules follow, and on 19 Aug 2026 a sweep found six separate violations of them:

**1. A position test means nothing without an `isActive(biome)` gate.** `game.env` (Sydney)
stays resident abroad and answers `inZone()` identically everywhere; every rectangle exists as
bare ground in all eight worlds. Violations found and fixed: `opera-stage` completable from
Cali (two call sites — systems.js camera block, whose guard was a stale `!inPasto` from the
two-world era, and capyWheek in capybara.js); Pasto stall barge/collapse triggers running in
every post-Pasto biome (props.js gated `physPastoUpdate` on "not Sydney" instead of "Pasto
live" — invisible stalls collapsed under Cali's spawn and ticked `market-chaos`);
`physNearestGrabbable` offering detached biomes' invisible props (grabbing the unseen Sydney
sandwich from Cali ticked `picnic-thief`). `mat()` in shared.js caches by color+opts JSON, so
two biomes writing the same literal share ONE material — Iceland's aurora lerp permanently
tinted the Río Cali until the sea mesh got a `.clone()`.

**2. Any stateful actor that can hold the player (or a prop) must clear that state on
`biome:enter`.** The gardener's carry (`rec.carryT >= 0`) froze across travel and teleported
the capybara back into his hands on Sydney re-entry. A held prop crossing the departures board
could never be released abroad — its body left the world with its home biome, so release
produced a dynamic-but-unsimulated invisible prop and a soft-locked task; the fix is customs
in `physOnBiomeEnter`: force-empty the mouth and `physRescue` the prop home. (Reparent its
mesh with `THREE.Object3D.prototype.add.call(scene, m)` — the patched `scene.add` would tag
it into the NEW biome's set.)

Also from the same sweep: `musSetPalette` must reset `musIdx` BEFORE its
suspended-AudioContext early return (band palettes' next-tables are shorter, and a stale
index made `musTick` throw forever after an alt-tab during travel); the title card's
catch-all pointerdown/Space paths must carry on, not `saveClear()`, when a journey is on
file; and `completeTask(id, silent)`'s silent branch must not touch row visibility —
that is `todoRefresh`'s diff's job alone.

Related: [[capy3-progression-chain]], [[capy3-module-drop-failure]], [[headless-qa-harness]]
