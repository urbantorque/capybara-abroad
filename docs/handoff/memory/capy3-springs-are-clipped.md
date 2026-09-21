---
name: capy3-springs-are-clipped
description: "Why every spring peak in capy3 has to be measured rather than derived, and the three that were wrong on the first try"
metadata: 
  node_type: memory
  type: project
  originSessionId: a12efa99-0899-414a-b855-0944f517cdb7
  modified: 2026-08-23T07:40:41.964Z
---

Every "juice" spring in this game is integrated semi-implicitly at 60 Hz with the frame's own
dt, and **the discrete stepping clips the peak well below the closed-form value**. Deriving
`x_max = v0 / (ω·e)` for a critically damped spring and shipping it gives roughly 30–65% of
the intended amplitude. This bit three separate features in one session (23 Aug 2026):

- **FOV punch** (systems.js, `sysFOV_KICK_D`): `k=150, c=24.5` predicted 2.0°, measured 1.25°.
- **Prop squash** (props.js, `physSQ_K`): `k=210, c=29` is a 69 ms time constant — four frames —
  and a towel dropped 6 m squashed **0.035** where 0.20 was intended. `k=90` (105 ms) survives
  the stepping.
- **Local flinch** (npc.js, `npcLOC_FL_K`): first kick gave a 0.21 peak = 3.7° of lean, under
  the threshold at which anyone can see a person reacted.

**Rule: pick the time constant first (≥100 ms, i.e. six-plus frames), then measure the peak
under playwright with a rAF sampler and scale the kick until it reads.** A 69 ms constant is
too fast to survive 16 ms steps no matter what the damping ratio says.

Two other traps from the same pass, both of which look like a physics bug:

- **Presentation must never read `game.time.scale`.** A 55 ms `hitstop` pulled the FOV from 48
  to 43.6 and snapped it back — exactly the dropped-frame artefact the freeze exists to avoid
  looking like. Read `game.time.slow` (the eased slow-motion component, freeze excluded).
- **Check for a second writer before animating `mesh.scale`.** props.js already had a uniform
  grab-pop damper reading `scale.x` and writing all three components; it ran one line after the
  new squash and turned (0.955, 1.089, 0.955) into (1.018, 1.018, 1.018) — the squash rendered
  as the prop briefly getting *bigger*. `physWriteInstance` also composed from `scale.x` three
  times, so non-uniform scale would not have reached the instance buffer at all.

Related: [[capy3-render-pose-heuristics]], [[capy3-slip-and-sky]], [[headless-qa-harness]]
