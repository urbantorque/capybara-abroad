---
name: capy3-waves-three-and-four
description: "The six systems Delight Pass waves 3-4 added to capy3, where each lives, and the API each publishes"
metadata: 
  node_type: memory
  type: project
  modified: 2026-08-24T12:02:33.837Z
  originSessionId: fcafc952-336a-4c5e-aed3-15f04ea76fbe
---

Built 24 Aug 2026 (CONTRACT.md §v22). Six systems, nine files. What to reach for:

**`game.calm(x, z)`** (systems.js) — 0..1, how settled the world is at a point. Blends
toward 1 with distance over `sysCALM_REACH` (26 m) because the only disturbance in any of
these worlds is the capybara. No argument = the global figure, also on `game.state.calm`.
Fed by `capy.restT`. **NOT `game.time.calm`, which is prefers-reduced-motion and a boolean.**

**`game.addCritter({biome, r, k})`** (systems.js) — registers a flee radius; the registry
writes `rec.near` once a frame for the live chapter. Read `rec.near` in the biome's own
distance test. A registry rather than seventeen `game.calm()` calls because the curve will
be retuned and a curve in seventeen files gets retuned in fourteen. Five adopters: Göreme's
cats, Reykjavík's sheep, Manly's gulls, Kyoto's heron, the Quay's apron gulls.

**`fam`** (npc.js, on every local) — the positive twin of `wary`. Rises inside somebody's
circle while nothing happens; the only thing in the game that reads the wave-1 soft wheek.
`localsChat` is chatStep's twin for the fixed-point shape. `npcLOC_STEP_*` is the shuffle.

**The room** (systems.js) — `acSfxIn` is the head of a wet send off which every non-`ui`
sfx now hangs; `sysROOMS` is one row per chapter; `musIR` builds the impulse response
(it had one caller for three versions and now has two). `game.hud.roomAudit()`.

**`physKEEPS` / `game.physics.spawnKeep(place, x, z, restY)`** (props.js) — the seventeen
souvenirs as real props. `biome: ''` is the load-bearing part: three of the four biome
gates in props.js already read an empty tag as "everywhere", and `physSceneAddLoose` /
`physWorldAddLoose` is the hatch. Always solo — an InstancedMesh is owned by whatever
capture tag was live. `physKeepOut(place)` finds the live one.

**The graze** (props.js) — `edible: true` on a physTYPES row; `physGrazeStep` runs from
`physUpdateHeld`. Four bites, then `physHide` on the restock path, so nothing is ever
destroyed and no task can be starved. `capy:graze` is what capybara.js animates the jaw on.

**The postcard** (systems.js) — K toggles photo mode, Enter saves a PNG. `game.hud.photoAudit()`.
The caption is the only reader `weather.label()` has ever had.

Three audit hooks were added for the harness, in the spirit of `mapMarkAudit`:
`game.hud.calmAudit()`, `game.hud.roomAudit()`, `game.hud.photoAudit()`. `game.locals` was
already published by npc.js and is how the shuffle, `fam` and the chat are all measured.

New static audit: **`node qa/lines.mjs`** — every `after:`/`before:` id is a real task, in
its own chapter, and the four chapters this wave opened up cannot silently go back to zero.

Related: [[capy3-delight-pass]], [[headless-qa-harness]], [[capy3-controls-one-voice]],
[[capy3-the-locals]], [[capy3-external-forces-on-the-capybara]]
