---
name: capy3-ghosts-and-noise
description: "B4-B6 of ROADMAP-FUN: the pips, the witnesses who were not in the world, and how noisy the first-five table actually is"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T04:04:15.423Z
---

**B4 `d1f5e82`, B5 `76e13ec`, B6 `13bd69e`+`f3bae00`**, 7 Sep 2026, branch
`character-pass`.

**THE BIG ONE: TWO OF `game`'s ARRAYS ACCUMULATE, AND EVERY SPAWN IS NEAR THE
ORIGIN.** `game.props` and `game.npcs` both keep every chapter visited so far —
`game.props` held 49 Sydney props plus 17 Pantanal ones after one crossing —
and detached objects keep their world coordinates, which are the coordinates the
next chapter puts the player in. Consequences:

  - **any probe** counting props near a spawn must filter `q.biome === live`
    AND `q.body.world`. The tell that this is happening is **two chapters
    returning byte-identical lists** (Sơn Đoòng reporting the Pantanal's beach
    towels). It invalidated a full nineteen-chapter sweep.
  - **`findPeople` in systems.js had the bug in the game**: it filtered
    `game.locals` by chapter and walked `game.npcs` with no chapter test.
    `game.npcs` is Sydney's cast, **built at boot whether the player goes there
    or not**. Measured in the Drift, on a run that went straight there from the
    title card: **27 of Sydney's 38 within 55 m of the spawn**, in the chapter
    the incident chain's own comment names as the one that can never produce an
    incident. In Venice the raw walk counts 38 where the chapter has 5.
    `game.peopleNear` in npc.js answers it now — third time this session the fix
    was "the question belongs to the module that owns the collections".

That bug had two victims: the chain's witness gate (a loaded gun — all five
empty spawns are >16 m from Sydney's crowd, so it never actually fired), and
**`quiet-corner`**, whose comment says it must not be "a free tick in the Drift"
and which needs nobody within 55 m — those ghosts made it near-unsatisfiable, so
it was failing in the chapters it was written for, for the opposite of its
stated reason.

**HOW NOISY `qa/first-five.js` IS.** Three runs of the SAME wander driver gave
**13, 10 and 11** for "first tick ≤ 30 s" over nineteen chapters. That is ±3,
from scatter placement and a random walk. **A single-run comparison of that
column is not evidence.** `tSee` moves 6/7/7. The one row that does not move is
the signpost, 19/19 in every run. Any future batch quoting an improvement in
these numbers needs several runs, not one.

**THE DRIVER MUST PRESS E.** B1's driver held WASD and pressed Space and Q,
never E and never Shift — and `physBarge` needs 3.2 m/s, so a walking driver
cannot knock anything over. Three chapters that "ticked nothing in 90 s"
(Iceland, Marrakech, Hong Kong) have their first row inside 12 m and all three
are THEFTS; with E they tick at 1.0 s, 6.5 s and 54 s. `first-five.js` runs both
passes in one session now, clearing the save between them.

**Other things built.** The pips (B4): five bars over the stamina bar, the third
ringed while unlit, a window bar draining with `incT` on a LINEAR transition
because easing a countdown makes it lie — and **nothing at rest**, because v51
gave the chain a rising note per event and said in its own comment that it adds
no HUD. A note cannot carry HOW MANY and HOW LONG; that is all the pips add.

Hanoi's spawn ring (B5): the only chapter with nothing loose within 16 m and
nobody within 26, in a city; its scatter clusters were 88 m and 154 m away and
its 240 bikes are an instanced crowd that cannot witness anything. Third annulus
plus two locals. `physBIOME_SCATTER`'s `also` takes a list now, and
`qa/p8-spawn.cjs` does that arithmetic on every build.

Kyoto (B6): the only chapter that ticks nothing under BOTH drivers, four runs
running. Its act one is the most spread-out in the game (lantern 19 m, garden
47, pond 72, stones 76, river 79, torii 98, bamboo 118) and **the paper offers
rows in author order**, so the top row was the second-furthest thing in the
chapter. Fixed by moving one line in TASKS; nothing in the world moved.

Related: [[capy3-measure-the-premise]], [[capy3-the-glimpse]],
[[capy3-what-the-place-is-for]], [[headless-qa-harness]],
[[capy3-instruments-that-cannot-hold-a-line]]
