---
name: capy3-module-drop-failure
description: "In capy3, a single throw inside systems.update kills camera+input+HUD — the signature 'capybara walks off screen and freezes' bug"
metadata:
  type: project
---

main.js gives each updater 4 strikes and then SPLICES IT OUT of the loop for good.
For `systems` that is fatal in a way no other module is: systems owns the camera rig,
the per-frame input poll and the HUD. Once it is dropped the camera stops following,
`input.x/z` freeze at their last value, and the capybara waddles off screen while the
world keeps simulating. Players report this as "it bugs out and freezes" — the actual
cause is always four consecutive throws in systems.update.

So: any exception thrown from systems.update is a total-loss bug, not a cosmetic one.
Check `game.state.lastError` and the console for `[update systems strike N]` first.

The 2026-08-18 instance: the Sydney/Quay ambience branch called the synth `sfxGull()`
DIRECTLY instead of going through `sfx('gull')`. The dispatcher is what supplies
default volume/pitch AND wraps every synth in try/catch, so the bare call passed
`vol === undefined`, `pk` went NaN, and `exponentialRampToValueAtTime` threw. Rule:
**never call an `sfx*` synth directly — always through `sfx(name, opts)`.**

It fired only in Sydney and Quay because every other biome's ambience already used
the dispatcher, and only ~15-20 s in, because that is when `ambTimer` first expires
after audio unlock. Related: [[headless-qa-harness]]
