---
name: capy3-the-herd-anywhere
description: "The portable herd: obey tiers, the hold timer, the offer contract, and why forcing the skill in a tick loop cannot test it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 888a28cc-359f-4fe1-8a49-90d7217b8d22
  modified: 2026-08-30T01:33:30.247Z
---

`gather` (ch15) teaches THE HERD and it works in any chapter that offers animals. `game.herdOffer`
/ `game.herdCount` / `game.herdDebug` in systems.js; four chapters wired.

**WHY IT NEEDED NO PER-CHAPTER SURGERY.** systems.js is the LAST module in the frame
(env → 16 biomes → weather → props → capy → condor → npcs → systems), so a `put` from the herd
lands after the chapter's own wander has already moved the animal and wins for that frame. The
chapter goes on drawing its animals exactly as it did. This is the general trick for anything
that wants to take over an actor another module owns.

**THE CONTRACT** — `game.herdOffer({biome, kind, obey, voice, pitch, count(), at(i,out), put(i,x,z,yaw)})`.
`obey` is `clamp(…,1,3)`: there is deliberately no way to ask for a fourth wheek. `put` is only
called for animals actually following (plus a yaw-only call for the look). Register it beside the
existing `addCritter` call — that is already the per-chapter "my animals exist now" hook.

**FOUR RULES, and the first two are what stop it being a switch:**
 1. ON A TIMER — `herdHOLD` 21 s per wheek. A herd is KEPT, not collected.
 2. TIERS — `herdHEARD_T` 7.5 s decay, so the extra wheeks must be PERIODIC.
 3. EVERYTHING ANSWERS THE FIRST WHEEK, whatever its tier. This is what makes the tiers legible
    instead of mysterious: you can see you were heard AND that it did not move.
 4. THEY WALK THE PLAYER'S TRAIL (the Pantanal's own pattern) — no flocking, so no pile-ups.

**WIRED IN EIGHT CHAPTERS, all three tiers** (qa/herd2, herd4, herd5, heron.js):
obey 1 — sydney ibis, iceland sheep, venice pigeon, pantanal cow, antarctic gentoo (all wheek 1)
obey 2 — goreme cat (wheek 2), manly silver gull (joins; tier noisy, they mill and flush at 7 m)
obey 3 — kyoto heron (looked on 1, refused on 2, joined on 3). ONE animal at the ceiling.
Cap 14. Decay 14 at 18 s, 0 by 24 s, rebuildable. 0 across a chapter change.
qa/herdsoak.js: 19 chapters, 0 errors, 0 NaN.

**FOUR ANIMALS WERE OFFERED AND TAKEN BACK OUT — this is the rule for what MAY be offered:**
 - leopard seal: antSEAL_NOTICE 24 m puts her to 'watching', closer to 'in'; earshot is 15 m, so
   there is NO distance at which she is both on the floe and in earshot. n:0 on every attempt.
   Her marquee IS leaving the ice to inspect you.
 - pantanal caimans: load-bearing FLOORS (panCaimanTop) with panPoolBox colliders baked at build.
 - pantanal capybaras: native follower system already owns them.
 - quay apron gulls: store a PERCH INDEX, not a position. Nothing to write.
An offer that cannot be completed is the bug this pass exists to find.

**OFFER FROM AN UPDATE, NOT A BUILD.** npc.js is created BEFORE systems.js (…npcs → systems), so
game.herdOffer did not exist in the ibis spawn loop and the offer was silently skipped — Sydney
reported no recruitable kinds at all. Same lazy-null-check shape addCritter already needs.

**THE HERON IS THE EXEMPLAR AND IT IS ONLY REACHABLE FROM OUTSIDE ITS OWN FLUSH RADIUS.**
`kyoHERON_NEAR` is 9 m and herd earshot is 15 m, so it must be asked from ~12 m. A probe that
teleports next to it flushes it and measures `n: 0` — which reads exactly like an unwired offer.

**THREE HARNESS TRAPS, all of which produced confident wrong numbers:**
1. **FORCING `capy.learn('herd', true)` IN A TICK LOOP CANNOT TEST THIS.** `herdUpdate()` runs at
   the END of `systems.update()`, i.e. AFTER the skill table has rewritten `learn` from the task
   list — so every recruit is undone on the frame it is made and the run reports `following: 0`
   everywhere. Use `game.completeTask('gather', true)`. The forcing trick only works for skills
   read EARLIER in the frame than the skill table (capybara.js ones).
   The tell was exact and is worth recognising: 21 looked, 14 recruited-then-dropped (heard reset
   to 0), and the 7 over the cap still holding `heard: 1`.
2. **A TIER CANNOT BE MEASURED ON A DIRTY ANIMAL.** `gather` persists once ticked, so chapter after
   chapter carried the previous chapter's wheeks in and measured a two-wheek cat joining on one.
   Stand 60 m off for 12 s and let `heardT` bleed first.
3. **`game.herdDebug()` exists for the same reason `game.hintTarget` does** — `herdKinds` is
   closure-local and the animals live in four other files, so without it nothing outside can ask
   "is there anything recruitable here, where is it, has it heard me". The first probe walked a
   coarse grid hoping to bump into a pigeon.

The Pantanal's own capybara herd is deliberately NOT offered: it has a native follower system and
two of them would fight.

Related: [[capy3-nine-skills]], [[capy3-the-herd]], [[headless-qa-harness]], [[capy3-the-place-remembers]]
