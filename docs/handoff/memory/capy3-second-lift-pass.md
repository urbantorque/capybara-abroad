---
name: capy3-second-lift-pass
description: "v0.60 second lift pass — the sky, the getaway, and five instruments that measured the wrong thing"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4bca48fe-4412-4d6e-9b0e-229fb74addea
  modified: 2026-09-11T01:04:40.414Z
---

11 Sep 2026, branch `lift-pass`, five commits on top of the first lift pass.
Full write-up in `ROADMAP-LIFT2.md`; the head of `CONTRACT.md` carries the seven
load-bearing facts. What is worth keeping that is NOT in either file:

**The audio memory note was stale and cost a review's worth of framing.**
Doppler, adaptive music and material footsteps all exist and have since 7 Sep.
A `ROADMAP-*.md` whose header says CLOSED is describing the world before the
fix — do not quote its findings section as current.

**Five instruments measured the wrong thing before any of them measured the
right thing.** This is the pattern of the whole pass:

1. An on/off differential 700 ms apart **with the world running** reported 86%
   cloud coverage on the Quay in a frame with no sky in it. It was measuring
   harbour water and a ferry. `game.state.paused = true` between exposures.
2. `audioProbe.lp` published the last value `sfx()` happened to set, so it read
   a flat 7072 Hz at every bearing and distance — which looks exactly like a
   curve that is not working. Lift the expression into a function BOTH the
   system and the probe call.
3. The voice census tested `incident[0]` and reported 17 of 17 *after* the
   rewrite. Correct and meaningless: `localLine` shuffles the bag, so position
   in a table is not position in play. Check distributions, not slots.
4. The wade probe teleported the animal and read `steps = 0` — a written
   position has no gait, so no footfalls. It has to walk.
5. `aim.ok = false` because the probe called `g.biome.api()`, which does not
   exist. The live biome is `current === 'sydney' ? game.env : game[current]`
   (`capyBiomeApi`).

**Two geometry facts nothing else records:**
- The settled rig pitches **DOWN** 11.2°, so a thing at elevation `e` is at
  `tan(e + 11.2)/tan(24)` in NDC and the top edge is **e = 12.8°**. The whole
  visible sky is 0–12.8° of elevation. Anything placed in it by height and
  radius rather than by elevation will end up above the picture.
- **There is no wading band.** `capySWIM_ENTER` is 0.70 from the body centre and
  the foot is `capyFOOT_Y` 0.34 below it, so the animal swims before the foot is
  36 cm under; and `terrainHeight` stops at the waterline in every chapter, so
  "standing on submerged ground" has zero grid points in twelve chapters.

**The design rule that made the getaway safe**, and the one to repeat for any
future gated task: arm **by task id, not by object**, never write a disarm, and
give the gate **two independent satisfiers** (here: 15 m from home OR 12 s held)
so no chapter's floor plan can hold a row hostage. Precedent in the tree:
`paEmpWanted` — *"IT IS NOT A GATE, IT IS A DEFERRAL"*.

**Two second owners on one row** is a class of bug this repo should expect:
`systems.js` ticked `picnic-thief` from `capy:grab` one listener after
`props.js` did. Invisible while both fired on the same frame; load-bearing the
instant one of them stopped. The tell was `armed: 1, ticked: 0` beside
`done: true`.

Trap 13 bit twice more, both times inside a regex written through the Bash tool:
`\b` became a literal backspace (0x08) and the check silently passed. `cat -A`.

Related: [[capy3-lift-pass]], [[headless-qa-harness]], [[capy3-the-sound-review]],
[[capy3-names-nothing-publishes]], [[capy3-the-beauty-pass]]
