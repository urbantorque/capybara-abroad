---
name: capy3-five-things-already-built
description: "The v36 lift pass — par, crowd bodies, the calm registry's other half, the first hour's dialogue, and the album — and the four instruments that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 072293f3-10b3-4b06-a30b-86fe546e62dc
  modified: 2026-08-29T09:36:10.863Z
---

29 Aug 2026. A deep review found five systems that were **built, paid for and reaching a
fraction of the game**, and all five shipped. None invents a mechanic or gates anything.

## What each one actually was

- **`par` on a RECORDS row.** 53 records and a record only ever compared you to yourself — on
  a first attempt, to nothing. The par shows on the live line where `no best yet` was, and
  crossing it says one sentence, ONCE, derived from `jrRecs[id]` so nothing new is stored.
  40 rows have one; 13 have none because no figure in the source defends one. The v32 silence
  on a first *personal best* is untouched — meeting an authored standard is a different fact.
- **21 of 53 records had no `recordLive` caller at all**, including Hanoi's "how many of them
  had to go round you". All wired. `qa/audit-tasks.mjs` now fails on a record with no live line.
- **`game.addCrowdBodies()`** in props.js, replacing the same twenty lines hand-copied into
  rio/kowloon/sahara. Six chapters went from 0-8% solid to ~100%: venice, hanoi, monaco, quay,
  cali's ringside. See [[capy3-solid-or-drawn]].
- **`addCritter`'s `appr`** — published since v23, read by nobody outside Iceland. Antarctica's
  seal and colony and the Drift's lampflies use it: for an animal that does not flee, stillness
  buys a LONGER notice radius, not a shorter flee one.
- **`pickLine` → `localResolve`.** Sydney and Pasto predate `addLocal` and read a flat string
  table, so the two chapters with the most tasks were the two where nobody noticed anything.
  39 conditional lines added. See [[capy3-the-locals]].
- **`albShotOn`** — the album's `albBest` had one reader (the title card); now the ledger leaf
  and the departures board row too. See [[capy3-the-front-of-the-game]].

## The four things that measured wrong first

1. **`body.position.set()` DOES NOT SET `aabbNeedsUpdate`.** A hand-moved STATIC body keeps
   the AABB it was built with for ever; both the contact test and `world.raycastClosest` use
   it. Every crowd box was in the right place and the probe still read Venice at 44%.
   `kowloon.js:2659` had always set it; the helper meant to replace that code had not.
2. **`game.physics` is assembled by `createProps`, not `createPhysicsWorld`.** Promoting a
   verb onto `game` right after the world builder runs against an object that does not exist
   yet, leaves the stub in place, and costs a whole probe run with zero visible symptom.
3. **`biome.switchTo(n)` does not move the animal** — it keeps the previous chapter's (x, z).
   That put the capybara in the sea off Antarctica and in a current in the Pantanal, so
   `capyBusy` was true for ever, `calm` was pinned at 0, and the critter registry looked
   broken. Use `biome.spawnOf(n)`. (Same family as the `switchTo` traps already in
   [[headless-qa-harness]].)
4. **A `setInterval` DOM sweep never fires inside one synchronous `page.evaluate` tick loop.**
   Sweeping only at the end caught whatever bubble happened to be up and read 0 of 13 lines;
   sweeping every 8 ticks inside the loop read 11 of 13.

...and a fifth, in the instruments: **`qa/cc-perf17.js` carried a hard-coded 17-name list**
and had never measured Monte Carlo or Hanoi — the two largest chapters in the game. Same hole
the closeout fixed in four other audits and missed in this one. Derived now.

## Rules worth keeping

- **A live record line must report the quantity the record FILES.** The Drift files an
  altitude where the task measures a rise. One deliberate exception (Monte Carlo's chip stack),
  named in the source.
- **`recLiveId` is one slot; the last caller in a frame wins.** Two open attempts in a chapter
  are ordered by call order. Where they live in different update functions and the wrong one
  runs later, a small timer is the fix (`monChipShow`).
- **A COUNT wants a flash, not a line.** One `recordLive` call on the frame the number moves;
  `sysREC_STALE` (1.6 s) takes it down. No timer, no new state. A herd that follows you for
  minutes would otherwise be permanent furniture.
- **Solidity is a design call where it touches a task.** Venice's crowd is solid except on the
  passerelle (a metre wide, run against a clock — a solid queue is not harder, it is
  impossible); Cali's ringside is solid and its ten dancers are not; Manly's bathers already
  push away from you at 3.2 m and a collider would fight a shove tuned around `move-flags`.

Related: [[capy3-number-and-first-frame]], [[capy3-instruments-that-cannot-hold-a-line]],
[[capy3-the-picture]], [[capy3-shared-module-blindness]]
