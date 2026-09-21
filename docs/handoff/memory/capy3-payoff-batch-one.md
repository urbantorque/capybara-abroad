---
name: capy3-payoff-batch-one
description: "The Payoff Pass batch 1: the mischief economy, the loaf, the gust that finally works, and the three systems that had been written and never once asked"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8f8abd8c-de8f-4fe9-bade-97adc2a7ed4b
  modified: 2026-08-24T17:31:55.291Z
---

Done 25 Aug 2026, on the Payoff Pass brief in `qa/PAYOFF-PROMPTS.md`. Three jobs:
a baseline audit, the mischief economy, and stillness as a verb. Full detail is in
CONTRACT.md v23.

**THE SHAPE OF THE BATCH: two of the three biggest finds were systems that had
been WRITTEN, PUBLISHED AND NEVER ASKED**, and the third was a timer on the wrong
clock. That is now the third pass in a row where the best return came from
looking for published-but-unwired rather than from building anything new.

- **Iceland publishes `waterHeightAt` for three bodies of water at two heights
  and never set `localWater: true`.** `capyWaterY` only calls `waterHeightAt`
  when that flag is up, so the animal floated to `waterLevel` (−1.0) inside a
  hot pool drawn at −0.30. Measured mid-soak: the top of the drawn animal at
  −0.594 against a surface at −0.300 — **the whole capybara was 29 cm under the
  water for the entire seven seconds of the chapter's best-loved moment.** One
  flag; 43 cm proud after. See [[capy3-slip-and-sky]] for the family of
  one-flag biome hooks this belongs to.
- **`sysSAVE_DEBOUNCE` aged on the SCALED dt.** It promises 700 ms of wall clock
  and the ticks that arrive with slow motion on them — every marquee, every
  chapter close — waited 1/scale as long. Measured 718 ms plain, 1046 ms on
  Kyoto's marquee at timeScale 0.62. main.js states this rule in its own
  doctrine block for hitstop and slow-motion; this was the one timer that had
  not taken it.
- **`qa/fuzz.js` was running against a title screen.** It assumed something else
  had booted the page, and when nothing had, all seventeen chapters came back
  identical with no errors — which reads as seventeen clean passes. A suite that
  cannot fail is worse than no suite. Check that a "green" suite is actually
  driving something.

**THE MISCHIEF ECONOMY** (npc.js, chapter-neutral, no biome file touched).
Ownership is by where a prop LIVES (`homeX/homeZ`) and not where it is, so a
stolen thing keeps its owner for the whole theft. Two hard ceilings — 10 s out,
14 s home, torn down unconditionally at the second — plus a 15 m leash on the
PROP so nobody can be led away. Details and the measured radii in
[[capy3-mischief-radii]].

**THE LOAF** — `capy.loaf`, 0..1, on `capyRestT` and never `capyStillT` (the two
lists differ by `heldProp`, and reading the wrong one is a bug this codebase has
now shipped three times: the calm field, the graze, and nearly this).
`capy.loafAsk` lets a biome ask for it where the rest test cannot reach — a hot
spring, where `capySwimming` correctly zeroes `restT`. Three readers: the lens
eases back, the score takes a wider lean, and the critter registry INVERTS.

**THE REGISTRY INVERSION IS ONE LINE AND NEEDS NO BIOME FILE.** Every consumer of
`game.addCritter` is `if (d < c.near) spook()`, so `near *= (1 - appr)` switches
fleeing off everywhere at once. Only the APPROACHING half needs the chapter,
because only the chapter knows where its animal's feet may go. `bold` defaults to
0 so nothing starts walking at the player because a shared file changed.

**WHAT DID NOT LAND.** The Drift and Sơn Đoòng carry one of the three reaction
chains rather than two: measured, their people and their props are 21–24 m apart
and the Drift's closest pair of people is 36 m. Not fixable from npc.js — it is
chapter layout, for the five-pillars passes in batches 3 and 4.

Related: [[capy3-gust-is-an-impulse]], [[capy3-mischief-radii]],
[[capy3-catch-all-state]], [[capy3-the-micro-environment]],
[[capy3-render-pose-heuristics]], [[headless-qa-harness]]
