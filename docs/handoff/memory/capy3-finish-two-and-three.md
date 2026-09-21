---
name: capy3-finish-two-and-three
description: "F2 and F3 — the speech blip, the crowd that watches the rider, the dead randomisation in noiseMake, and the two modules that may never be dropped"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3438c0a0-f668-4a46-aecf-4e1f8f98ae17
  modified: 2026-09-05T16:08:23.013Z
---

Batches F2 (`681d280`) and F3 (`22b0e3f`) of `ROADMAP-FINISH.md`, 6 Sep 2026,
run in one session after F1. CONTRACT.md carries both paragraphs. See
[[capy3-finish-batch-one]] and [[capy3-the-finish-review]].

**THE PATTERN ACROSS BOTH: A MECHANISM THAT EXISTED AND WAS NEVER REACHED.**
`noiseMake` randomised `loopStart`/`loopEnd` per source and **no caller ever
passed an offset to `start()`** (43 sites), so every one-shot began at sample
zero and the window was never reached — the footstep and the caixa were the
same 45 ms forever. `monRider` and the 46 watchers had never been introduced.
`musDrum` was set once at 0.62 while every other bus answered `lift`.
`capySliding` was not in the footfall gate, so every slide played a gallop.
`sayBubble` — the one door every line goes through — fired no sound at all.

**FOUR THINGS THAT MEASURED WRONG OR BACKWARDS FIRST:**

1. **"Pin the crowd to the ridden car" is wrong.** Pinning drops every watcher
   beyond the existing 90 m gate to their idle phase: a lap at the far end of
   the circuit left forty spectators facing nothing (facing-nearest-car fell
   1.00 → 0.07). PREFER the ridden car where it is visible. Then: 1.000 of the
   watchers who can see the animal face it, at 0.001 rad, rest unchanged.
2. **A probe that identifies a car by `world.bodies.filter(shapes.length===5)`
   is using world ORDER, not `monCarG` order.** It rode a different car from
   the one it measured and reported the fix as a regression. Measure against
   `game.capy.position` — the animal IS on the ridden car — and the mapping
   problem disappears. (Harness trap 11's family.)
3. **`sayAudit` reimplemented `npcSay`'s lookup**, so the F2 merge would have
   been invisible to its own verification. Both go through one helper now.
   An audit that re-derives what it audits is worth nothing the day the thing
   changes.
4. **A node-count probe must be SYNCHRONOUS.** Counting `create*` across an
   `await` catches every other voice in the frame — 29 nodes for a 2-pulse
   blip. The synth builds all its nodes inside the call: patch, call, unpatch,
   read. Then it is exactly 5 and 7.

**AND ONE THAT LOOKED LIKE A FAILURE AND WAS THE THROTTLE.** The blip did not
fire through `sayBubble` in the first test — because the probe had just fired
three test blips with `force: true` and `sfxGap.blip` is 0.18 s. Leave a real
gap before testing a throttled voice through its real door.

**RULES THIS SESSION RE-LEARNT:**
- **One writer per AudioParam, always.** The crossing duck is a TERM in
  `musDuckApply` beside the pause, not a second `setTargetAtTime` on
  `musDuckG` — the same shape the pause's filter half and the chase pulse use.
- **A custom property set on an element beats one inherited from an ancestor.**
  `--capyui-gbg` had to go on `.capyui-btn .capyui-g`, not `.capyui-btn`.
- **A break must suppress a VOICE, not a bar.** Rio's paradinha leaves
  `musBarAt`/`musBarAnchor`/`musBeatLen` alone, so `game.music.beats()` — what
  the dance floors are scored against — never threw, reversed or skipped
  across bars 10 to 30.
- **The board was mounted through the intercepted `scene.add`.** It is the one
  thing built per ENTRY, so its collider was re-added by `attach()` every
  visit: 160 → 166 bodies over six round trips, now flat at 160. Anything
  rebuilt per entry must go in through the raw prototype methods.

**Two harness-only hooks added because what they observe was unverifiable:**
`game.musAudit()` (every mix gain read back — with `setTargetAtTime` the only
proof a duck happened is the param) and `game.forceCamNaN()` (the rig is
closure-local; poisoning `camera.position` proves nothing, it is overwritten
from `sysCamPos` next frame). Also `game.state.camSaves`.

**LEFT PARTIAL, ON PURPOSE:** the slide's sustained scrape, the paradinha in
Cali's salsa, and suppressing band scheduling under `transBusy`. All three on
`ROADMAP-FINISH.md`'s shelf with the reasoning.

Instruments: `qa/f2-check.js`, `f2-blip.js`, `f2-blip2.js`, `f2-mon.js`,
`f2-mon2.js`, `f2-mon3.js`, `f3-check.js`, `f3-beat.js`.

Related: [[capy3-finish-batch-one]], [[capy3-the-finish-review]],
[[headless-qa-harness]], [[capy3-the-mix]], [[capy3-sounds-people-make]]
