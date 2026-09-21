---
name: capy3-gossip-and-the-poster
description: "B15, the last batch of ROADMAP-FUN: the shadowed name that broke a feature 1100 lines away, why the album cannot be a mugshot, and the three tests a prop needs before it will stand up"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T15:46:25.143Z
---

Item 6's last two bullets, built 8 Sep 2026 as `ba30f2e`. **ROADMAP-FUN is
closed except B0**, which is not code: watch a stranger play two chapters.

**A `let` INSIDE A FACTORY SHADOWS THE MODULE SCOPE, AND THE BUILD CANNOT SEE
IT.** The gossip timer was `npcHeardT` — a name npc.js already uses at module
scope for the overheard-speech pill fence. A `let npcHeardT` inside
`createNPCs` captured it for the whole factory body, including three lines
eleven hundred lines above. Both features silently drove each other's clock.
**Found by arithmetic, not by reading**: the six-second wait drained at a ratio
of exactly **2.01** against the wall clock, and the timer later rose to 8.9
having been armed at 6. `build.mjs`'s collision check counts top-level
declarations ACROSS modules and cannot see a shadow inside one function. An
unexplained integer ratio in a timer is a shadowed name until proven otherwise.

**`biome:enter` CARRIES `{ name, from }` AND NOTHING HAD EVER READ `from`.**
Since F3. Nineteen chapters and the game did not know where you had come from.

**ARM, DON'T SAY.** A line said at the moment of arrival lands in **14 of 19** —
four chapters have nobody within 16 m of the spawn (drift, pantanal, cave,
antarctic) and all four have 6-8 people elsewhere; Pasto's cast counts through
`peopleNear` at 4 s but is not yet eligible to speak. Armed and spent on the
first person in earshot, it lands everywhere with people. **Earshot 16 m.**

**ONE WRITER FOR STATE TWO MODULES TOUCH.** Clearing the armed line in npc.js's
own `biome:enter` handler is a race with systems.js's — handlers run in
registration order. systems.js calls `rumourArm` on EVERY crossing, with no
place when there is nothing to say.

**THE ALBUM IS A POSTCARD, NOT A MUGSHOT.** `albAdd` blits the WHOLE FRAME at
288x180, so a shot is the place with a capybara ~20 px tall in it. Rendered on
a plane and looked at, you cannot tell what it is of. It also comes out
double-graded (the tone map is already baked in) and would be **the first
texture in the game** — one grep of src finds a single 1x1 DataTexture. The
poster is drawn instead: a sheet, a rodent shape, three bars where the writing
would be. The exit board's own rule — *"no text in the world and not about to
grow a font atlas"* — is the precedent, and it answers this question too.

**THREE TESTS BEFORE A TALL PROP WILL STAND, and each was found by failing:**
1. *Level with the anchor*, not merely a finite floor — `boardFloor` returns
   the canal bed quite happily. Venice put the poster underwater.
2. *Flat under its own foot* — four corner samples, spread < 0.10 m. Level
   with the spawn at 10 m still allows a slope; 4 of 19 were face-down.
3. **`body.sleep()` after placing it.** `physScatterBiome` ends with exactly
   this loop and a prop spawned from a `biome:enter` handler never goes
   through it. Which ones fell moved between runs — nothing was pushing them,
   they were being solved over. 15/17 standing → **18 of 18**.

**AND IT STACKED ON RE-ENTRY.** A chapter's props are detached on exit and
re-attached on return, so one spawned per arrival is one more for ever: the
third visit to Kyoto had three posters and three live bodies. Idempotent per
place, the contract `physSpawnKeep` already states.

**PROBE TRAPS PAID FOR HERE.** Four biome IDs that do not exist — `marrakech`,
`reef`, `balloon`, `raft` are NAMES; the ids are `sahara`, `palawan`, `goreme`,
`pantanal`, and `hud.cross` on a non-id rolls back into the chapter you were
in (reads exactly like four empty chapters). And `forceNoto` wrote only
`inc`/`scn`, so a "quiet place" case still armed off 57 accumulated photos — it
takes `pho` and `fed` now.

Thresholds, measured: one incident travels; the charm side needs 6, because
90 s of standing still among Cappadocia's people is 3 photographs and 2 gifts.

Instruments: `qa/gossip-premise.js`, `qa/gossip-cast.js`, `qa/the-gossip.js`,
`qa/gossip-why2.js`, `qa/poster-premise.js`, `qa/poster-sweep.js`,
`qa/poster-return.js`, `qa/b15-shots.js`. `game.rumourArm` / `game.rumourAudit`
are new.

Related: [[capy3-the-number]], [[capy3-routine-and-blame]],
[[capy3-measure-the-premise]], [[capy3-the-locals]], [[capy3-the-fun-review]]
