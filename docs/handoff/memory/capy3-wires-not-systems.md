---
name: capy3-wires-not-systems
description: "D1-D4 and D9 of the delight roadmap — the shadow that was a tint, the stride that was a constant, the person who was a wall, the freeze that never fired, and the six probes that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-03T01:55:59.297Z
---

Batches D1 (`c9d7ff5`), D2 (`87573dd`), D3 (`06ba90b`), D4 (`a0a2657`) and D9
(`f68318e`) of `ROADMAP-DELIGHT.md`, 3 Sep 2026. Contract sections **DEPTH —
D1**, **THE BODY — D2**, **THE WORLD ANSWERS — D3**, **THE PAYOFF — D4**,
**HOUSEKEEPING — D9**.

**The through-line: almost nothing here was a new system.** Every one was a
wire between two things that already existed, or a constant that had stopped
being true. The roadmap's own headline was right — "the systems are all there
and half the wires between them are not".

## THE SHAPE OF THE FAULTS

- **A comment that states a number is a claim, and it rots.** `sfx()` said
  eleven `force: true` and there were 31. `punch()`'s own paragraph named the
  two events that "do stop the world" and neither cleared the floor.
  `capySTRIDE` said "metres of ground per half gait cycle (~= foot arc)" and
  was a constant while the arc is speed-dependent.
- **Two numbers that must agree, living fifty lines apart, will disagree.**
  The cadence and the swing. Hoist one to the other.
- **A threshold expressed as a FRACTION of another constant is invisible.**
  `sysPUNCH_MIN = 0.55` is 0.187 in the units callers pass. Nobody comparing a
  call site to it ever did the multiplication.

## FIVE MEASUREMENTS THAT CHANGED THE ANSWER

1. **A shadow can only remove the sun's share.** 29 levels on a 152-level lawn
   where the lighting comment promises 60 — hemi 1.35 + amb 0.12 + fill are
   unshadowed by construction. Scaling the INDIRECT irradiance by sun
   visibility fixes it; the roadmap's 45-60 target is **unreachable with that
   lever** (the whole indirect share is ~15.6 levels, so even 0.0 tops out near
   45) and the ceiling is written down rather than chased.
2. **Skate is worst at the quietest speed.** 0.457 m per step at 1 m/s, 0.144
   at a walk, zero at a sprint — the constant was right at the one speed the
   game is loudest at, and the creep-up-on-a-picnic speed is reached by NO KEY,
   only on the ramp out of a standstill.
3. **Barging a person was not silent, it was a WALL.** Both npc record shapes
   carry a mass-0 collider, so both landed in the static branch and got the
   stone thud. The roadmap said "no sound, no punch, no flinch" and it was the
   opposite fault.
4. **The two cast chapters cannot be barged through physics at all.**
   `npcPlaceBody` holds any `userData.npc` body off the animal by 1.30 m every
   frame so a walker cannot shove the player — and the DRAWN figure is not
   moved with it. You walk through the person. They are barged on proximity to
   the figure instead.
5. **ω×r is worth nothing.** Every mass-0 body big enough to stand on, seven
   chapters, 900 samples: **0.000**. Decks translate along a path; their
   colliders never turn. Measured by DIFFERENCING THE QUATERNION —
   `angularVelocity` is zero on a body turned by writing one.

## SIX PROBES THAT LIED, AND HOW

1. **`game.time.slow` is the slow-motion component ONLY.** A hitstop must not
   narrow the lens, so a freeze does not appear in it. Sample
   `game.state.timeScale`. The first D4 run read the marquee's existing slowmo
   and would have called a missing feature present.
2. **`punchAt` from the CAMERA reads zero at every range.** The boom is 9.5-12 m
   BEHIND the subject, so a crate 5 m in front of the animal is 15 m from the
   eye. "Near me" is a fact about the ANIMAL.
3. **`input.x/z` are rebuilt from the key state every frame.** A single write
   before a loop walks at 0.6 m/s. Write them every tick — and they are
   CAMERA-RELATIVE, so a world bearing must be rotated into the live `camYaw`
   or the animal walks in a circle as the camera swings.
4. **A locomotion probe must reload between runs.** Walk, then sprint from
   wherever the walk ended, and the sprint row reads 1.76 m/s because the
   animal is against a fence.
5. **A barge is an ARRIVAL at speed.** In Pasto the nearest person is 1.3 m
   from the spawn; the animal starts pressed against them and never closes.
   Back off and turn round first. And COUNT THE EVENT, not a symptom — the
   flinch spring has a dozen drivers.
6. **The per-name throttle sits above the voice ceiling.** Ten names fired
   three times each is not a cascade: twenty of the thirty die before the cap
   sees them.

Plus: **the sky dome's rings are at ten degrees of POLAR angle** (y = 1, 0.985
… 0.174, 0 — nothing between 0 and 0.174), so a band sampled at 0.02 < y < 0.06
reads no vertices; and a sky LOBE must be compared at the sun's own elevation
or it measures the vertical ramp.

## THINGS MEASURED AND DELIBERATELY NOT BUILT

- **ω×r** (above).
- **The capybara's tail** — a 5.5 cm blob pivoting on its own centre. Rotating
  it moves nothing at nine metres.
- **Venice's sway** — a stone piazza with no foliage; its only cloth is three
  flags that already have `venUpdateFlags`.
- **The witness chain for the seventeen** — already built since v30
  (`locChainFrom`). `npcWitnessChain` is the CAST chain, ported TO Sydney and
  Pasto *because* they have no locals. The roadmap had it backwards.
- **A true jump anticipation.** One spring cannot give both a long crouch and a
  full stretch (the zero crossing wants a small seed velocity, the peak wants a
  large one, and ζ = 0.26 takes 40 % off whatever the algebra promises). A real
  anticipation means delaying the impulse: 50 ms of jump latency, not bought.

## TWO CONTRACT HOLES WORTH REMEMBERING

- **The boot chapter never fires `biome:enter`.** Every shadow and sun constant
  is Sydney's, so frame one was always right by construction — and the first
  per-chapter number that was NOT already a constant was silently neutral in
  chapter one and correct in the other eighteen.
- **`nextIn` had no audit**, so "no task on a clock" and "forgot the hook" were
  indistinguishable. The two missing were the two OLDEST chapters: Sydney's
  ferry (the first task in the game that asks you to wait) and Pasto's carroza.

Related: [[capy3-payoff-and-hood]], [[capy3-faces-and-bodies]],
[[capy3-the-lens]], [[capy3-external-forces-on-the-capybara]],
[[capy3-carriers-that-drop-you]], [[headless-qa-harness]]
