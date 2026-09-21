---
name: capy3-the-second-flier
description: "How the condor stopped belonging to Pasto, and the four things that measured wrong first"
metadata: 
  node_type: memory
  type: project
  originSessionId: e3a5caa5-0616-4a3d-814c-96b2bfbbb035
  modified: 2026-08-27T14:54:55.753Z
---

Row 5b of the Movement Pass, 28 Aug 2026. `CONTRACT.md` §v35, `qa/MOVEMENT-PASS.md`.

**A chapter hosts a flier by publishing `thermals`.** Sixth time this codebase has replaced a
list of biome names with the question the list stood in for (after the dive, slip, wind,
localWater and the climb). `condor.js` called itself biome-neutral and the FLIGHT LAW was —
the plumbing was not: terrain, fence, updraft, both early-outs, the marquee and all three task
ids went to `game.pasto` by name. `condorHost()` resolves the live biome instead.

**Rio is the second host and the bird was already drawn** — nine frigatebirds over the bay
since the chapter shipped (`rioBuildBirds`), unreachable. Four columns off Pão de Açúcar, Morro
da Urca and Corcovado. Two ordinary tasks, deliberately no `mini`: Rio already has the wow and
two minis, and no chapter may have two of the same KIND of moment.

## FOUR THINGS THAT MEASURED WRONG FIRST

1. **The obvious translation of a despawn gate is wrong with two hosts.** `e.name !== 'pasto'`
   → `if (!condorHost())` keeps the bird ALIVE across a border between two hosts: Rio's fragata
   circling Galeras with the wrong plumage, thermals two chapters away, a fence that has moved.
   A bird belongs to the chapter it was called in — despawn at EVERY border; the host only
   decides whether a new one can be called on the far side.
2. **A module latch must not gate a chapter's tick.** `condorRodeOnce` guarded `completeTask`,
   so riding in Pasto meant Rio's line never ticked. Latch = "done before" (global, arms the
   low orbit); tick = the host's, fired every time, because `completeTask` is idempotent.
   The marquee keys off its RETURN VALUE — true only on a genuine first completion — so each
   host gets its own payout.
3. **A guard belonging to one chapter's joke ate a chapter-neutral number.** `condorCheckPeak`
   bailed on a missing `craterCentre` before reaching the height record.
4. **A record filed on every improvement fires a card every few centimetres.** Four stacked
   *personal best · carried up to 9 m* over Copacabana. `recordLive` on the way up, `record`
   once on release. Needs a CLIMBING flight to show, which is why one chapter of thermals never
   surfaced it and two did.

## THE PROBE THAT COULD NOT HOLD A LINE

A free-flight position trace is useless as a differential: **noise floor 69.6 m** between two
runs of the SAME build, against a 24 m before/after difference that read as "DIFFERS". Use a
scalar with low variance instead — max altitude over N runs (200 m ceiling, ±0.3 m floor) plus
the deterministic plumbing (thermal count, column 0, bounds, terrain samples). See
[[capy3-instruments-that-cannot-hold-a-line]].

**Plumage is six colours and belongs to the host**, baked into a merged geometry with
vertexColors, so it is a rebuild (`condorRePlume`, called from the summon — the one moment the
bird is off screen). Only the wing rig and three pivots need clearing. Not in `PALETTE`.

Related: [[capy3-the-movement-pass]], [[capy3-number-and-first-frame]], [[headless-qa-harness]],
[[capy3-external-forces-on-the-capybara]]
