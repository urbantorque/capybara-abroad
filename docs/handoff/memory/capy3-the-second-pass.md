---
name: capy3-the-second-pass
description: "What a deep re-audit of capy3's two oldest chapters found: the furniture nobody collided, two islands you stood inside, and a waiter who had never reached a table"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9d0fb52-6acc-4b85-b275-892868be786e
  modified: 2026-08-20T18:20:55.630Z
---

Done 21 Aug 2026, on "second pass of Sydney and Pasto: physics, no phasing, NPCs". The two
oldest chapters in the game, both audited before. **Everything found was in something that
was already 95% right**, which is the shape of a second pass: the misses are all in the tail.

**THE SOLIDITY RESIDUE WAS ALL FURNITURE, AND FURNITURE IS EXACTLY THE WRONG SIZE.**
`qa/audit-solid.js` reported Sydney 3, Quay 18, Pasto 56. Named (the audit now prints the
object's name chain, its bounding box and its colour — object ids are a global THREE counter
and cannot be looked up after a reload, which cost a probe), they were:

| where | what | why it mattered |
|---|---|---|
| Sydney | 4 ferry-shelter posts, 24 bollards, 12 lamp standards | a bollard is 45 cm across and 72 cm high: too tall to step over (the animal manages 40) and too small to read as a wall, which is precisely the size of thing that looks like a bug when you walk through it |
| Quay | Fort Denison and Shark Island | `quayIsOverWater` had always said they were LAND, and `terrainHeight()` returned a flat zero for the whole chapter — so a capybara that swam out to the fort climbed out **two metres inside the rock** |
| Quay | 12 wharf-shelter posts, 3 berth boards, 17 colonnade piers, 9 ticket stiles, 8 lamps | the same omission, five more times |
| Pasto | the end house of each of the three terraces | the houses are laid by `x += w` through a cycling list of six widths until the run is used up, so a run **never** ends where the loop's bound says: drawn to 35.4, collided to 34.5 |

Sydney is now **0**, Quay **1** (a scrub bush, and vegetation is deliberately walk-through
everywhere in this game), Pasto **54 — every one of them instanced vegetation**. The Pasto
terraces report the span they actually built and the colliders are sized from that.

**ONE COMPOUND BODY PER CLUSTER.** Forty pieces of quayside furniture is forty broadphase
entries done naively; `envPoolBody`/`envPoolBox`/`envPoolDone` already existed in Sydney and
quay.js got the same three functions. Body counts after: Sydney 131, Quay 32, Pasto 61, frame
time unchanged at 16.6–16.9 ms median in all seventeen chapters.

**THE WAITER HAD NEVER ONCE REACHED A TABLE.** `serve` is a steering state and it was the only
one in npc.js with **no ceiling**: arrival advances the circuit, and if arrival never happens
nothing ever does. Measured over forty seconds — he walks to (-31.6, 3.1), stops one metre
short of chair 0 because the table between him and it is solid, and stays there with `stateT`
past 27 s and `serveI` pinned at 1. Same class as the three farmers who never left their spawn
([[capy3-catch-all-state]]) and the wander state that logged 328 s and zero metres. Two things
were wrong and both had to go: no ceiling (9 s now), and a 1.0 m arrival test around a target
that is a chair beside a 1.04 m table with somebody already sitting in it (1.7 m now).

**AND WHEN HE GETS THERE HE PUTS THE THING DOWN.** He used to walk a counter-to-table circuit
holding a tray perfectly level and then stand beside the table in silence, which is a man doing
a lap rather than a waiter. Now: the tray dips through a half-sine over 1.2 s, one small sound,
one line — and **the two people at that table look up**, one hand raised, for 1.6 s. It is the
only thing on that terrace that has ever acknowledged anybody who is not the capybara.

**THE DETECTORS THAT CRIED WOLF, so they are not chased again:**

- `qa/npchealth.js` measures every record in `game.npcs`, including the 38 that belong to a
  DETACHED biome. Run it on Pasto and it reports all of Sydney's cast "stuck, moved 0.0 m".
  Only the rows whose biome is live mean anything.
- "always seated / always busk / always serve" is the DESIGN for the patrons and the busker.
- The abuela's `patrol` calls `paPickPlaza(rec); rec.stateT = 0` without changing state, so a
  state-duration detector reads 39 s. She moved 21.5 m in it. Not stuck.
- `qa/kine.js` flags a "teleport" for any frame a body moves without velocity. NPC capsules do
  that by design and nothing rides one. The one worth looking at is **Sơn Đoòng's log** —
  17 frames, 29 cm each — because that one is a carrier with a passenger on it.

A deeper pass over chapters 6-8 followed on the same day and found a different SHAPE of
miss — whole systems drawn and never implemented, including a set piece on unreachable
ground. See [[capy3-chapters-six-seven-eight]].

Related: [[capy3-solid-or-drawn]], [[capy3-catch-all-state]], [[capy3-the-locals]],
[[headless-qa-harness]]
