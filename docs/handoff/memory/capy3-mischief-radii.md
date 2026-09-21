---
name: capy3-mischief-radii
description: "The measured radii behind capy3's reaction layer, and the blocked-step ray that switched the whole feature off"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f8abd8c-de8f-4fe9-bade-97adc2a7ed4b
  modified: 2026-08-24T17:32:44.419Z
---

Built 25 Aug 2026 in npc.js as part of [[capy3-payoff-batch-one]]. Three
chapter-neutral reaction systems — ownership, produce, chains — using only the
people and props each chapter already has. Every number below was measured, and
the first cut of each was wrong.

**`npcOWN_R` = 11 m.** Ownership is "the nearest local who can WALK whose anchor
is within this of where the prop LIVES". The first cut was 5.5 m and at that
radius **five chapters of fifteen had nobody who owned anything**. Distance from
each prop's home to the nearest walking local, closest per chapter:

  Antarctica 1.8 · Iceland 1.9 · Venice 2.1 · Göreme 2.8 · Marrakech 3.6 ·
  Kyoto 3.8 · Manly 4.1 · Quay 5.2 · Rio 5.8 · Kowloon 6.2 · **Cali 9.5** (and
  then nothing until 14.7) · **Sơn Đoòng 9.4 · the Pantanal 21.3 · the Drift 24.0**

**`npcCHAIN_R` = 20 m, and it is NOT the 13 m pair-chat radius.** Hearing
somebody react and having a conversation with them are different distances. At
13 m, Reykjavík (17.16), Manly (18.38) and the Drift (36.16) have no pair of
locals at all. At 20 the first two come in; the Drift does not, and that is
correct — its eight people are on separate floating islands.

**THE BLOCKED-STEP RAY HAD TO START 1.20 m OUT, NOT 0.45.** A local retrieving
something walks up to 15 m, so unlike the shuffle it needs a "would this step put
me inside a wall" test. Starting the ray clear of the walker's own 0.26 m
half-width is not enough: **a Marrakech stallholder chasing a hat 4.4 m away
moved 0.48 m in 18.5 seconds**, because their own counter is the first solid
thing in front of them and every step read as blocked. Most of the people who own
anything in this game are standing behind the thing their stock is on. Ray filter
is `collisionFilterMask: 1` (physGRP_STATIC), so the prop being chased is never
what stops them reaching it.

**LOCALS CAN NOW LEAVE THEIR ANCHOR, WHICH BREAKS TWO OLD INVARIANTS.** Any audit
asserting "a local is never more than `npcLOC_STEP_R` (0.55 m) from its anchor"
is wrong while `r.own` is set. And a walking local's `y` has to follow the
terrain — but only while AWAY; back inside the shuffle radius the authority is
`baseY`, the height the CHAPTER measured, because somebody standing on a jetty,
a plinth or a step is not standing on the terrain.

**ONLY LOCALS WITH `r.fig` MAY WALK** — a person the module built. A chapter that
handed over its own Group may have merged that person into a jetty, a stall or a
boat, and moving them takes the jetty with them. Same gate the shuffle takes.

**Sydney and Pasto are not in any of this.** They are populated by the STEERING
cast (`game.npcs`) and have no locals at all; their ownership is stronger already
(a prop carries `owner`, and taking it starts a chase). What they were missing
was the produce reaction, which is `startle` plus the existing `shoo` pool.

**ADOPTION: 13 of the 15 locals chapters carry two of the three chains.** The
Drift and Sơn Đoòng carry one, for the layout reasons in the table above. Also
worth knowing for later: **only 6 of 17 chapters have any EDIBLE prop at all**
(Sydney 7, Pasto 13, Cali 4, Pantanal 3, Kowloon 2, Quay 1), so the graze verb —
and the produce reaction that hangs off it — cannot fire in eleven chapters. One
`edible` flag on an existing `physTYPES` row would fix each of them.

Related: [[capy3-payoff-batch-one]], [[capy3-catch-all-state]],
[[capy3-the-locals]], [[capy3-second-pass]]
