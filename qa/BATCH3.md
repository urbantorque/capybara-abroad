# BATCH 3 — Chapters 4-11 (Payoff Pass)

Started 25 Aug 2026, on `claude-opus-5`. Brief: `qa/PAYOFF-PROMPTS.md` § BATCH 3.
Predecessor: `qa/BATCH2.md` — jobs 1-2 landed (THE LAWN, THE ALBUM, CONTRACT v24).
**Batch 2 jobs 3 (the first hour) and 4 (pillars on ch 1-3) were NOT done** and its
handover/chaining steps were never run. Noted here; not in batch 3's scope.

Carried in and available to pillars 2 and 3:
- mischief reaction layer (npc.js `r.own`, produce, chains) — harness `qa/pf-mischief.js`
- auto-loaf + inverted critters — `capy.loaf`, `capy.loafAsk`; harness `qa/pf-loaf.js`
- the finale (`sysFinale*`, `game.physics.stageKeep`), the album (`capy3.album.v1`)

## The eight chapters

| n | biome | file | notes from the brief |
|---|---|---|---|
| 4 | kyoto | src/kyoto.js | heron = critter-registry adopter, direct test of inverted approach. Toy: six stepping stones |
| 5 | cali | src/cali.js | `caliNightT` is a PROGRESS LATCH not a clock — check every reader |
| 6 | rio | src/rio.js | Arcos da Lapa deck + kiosk counter earned tasks late; certify both |
| 7 | iceland | src/iceland.js | hot-spring soak is the marquee. Route life FAILS: dead 160 m glacier approach needs a RIDE BACK |
| 8 | sahara | src/sahara.js | pillar 5 applies to town+souk only, never the hamada |
| 9 | drift | src/drift.js | 201,886 tris — NO net geometry. Home of the wind comedy. Island keels are not a place |
| 10 | venice | src/venice.js | pillar 3 at BOTH waterlines |
| 11 | kowloon | src/kowloon.js | 130,390 tris vs 130k — geometry FROZEN |

## Per-chapter checklist (five pillars)

- [ ] **4 Kyoto** — 1 marquee · 2 cast · 3 ground · 4 toy · 5 route
- [ ] **5 Cali** — 1 · 2 · 3 · 4 · 5
- [ ] **6 Rio** — 1 · 2 · 3 · 4 · 5
- [ ] **7 Iceland** — 1 · 2 · 3 · 4 · 5
- [ ] **8 Marrakech** — 1 · 2 · 3 · 4 · 5
- [ ] **9 The Drift** — 1 · 2 · 3 · 4 · 5
- [ ] **10 Venice** — 1 · 2 · 3 · 4 · 5
- [ ] **11 Hong Kong** — 1 · 2 · 3 · 4 · 5

## Finish

- [ ] CONTRACT.md new version section
- [ ] qa audits for new invariants
- [ ] Project memory
- [ ] This file as the handover
- [ ] `playwright-cli close-all`
- [ ] Chain batch 4 (VERY LAST action)

## Log

- Started. Oriented on BATCH2.md + PAYOFF-PROMPTS.md + headless-qa-harness memory.

### Baseline, before any chapter work (main thread, 25 Aug)

`qa/pf-mischief.js` re-run. **It was under-reporting and now says so.** The
harness printed `ownedProps` with no population count beside it, so "this
chapter has no owners" and "this chapter's props had not scattered when I
looked" were the same number. Kyoto read `owners 0` on one run and `owners 2,
closest 3.8 m` when measured on its own — 3.8 m being the exact figure CONTRACT
v23 records for Kyoto. `nProps` added; the numbers are stable now.

| ch | props | walkers | owned | owners | edible | pairs<20m | chains |
|---|---|---|---|---|---|---|---|
| 4 kyoto | 10 | 13 | 5 | 2 | **0** | 4 | 2 ✅ |
| 5 cali | 10 | 10 | 3 | 2 | 4 | 3 | 3 ✅ |
| 6 rio | 10 | 8 | 3 | 2 | **0** | 4 | 2 ✅ |
| 7 iceland | 10 | 8 | 7 | 2 | **0** | 1 | 2 ✅ |
| 8 sahara | 11 | 10 | 5 | 3 | **0** | 4 | 2 ✅ |
| 9 drift | 9 | 8 | **0** | **0** | **0** | **0** | **0** ❌ |
| 10 venice | 10 | 8 | 7 | 3 | **0** | 5 | 2 ✅ |
| 11 kowloon | 11 | 9 | 4 | 2 | 2 | 8 | 3 ✅ |

- The ownership walk and its ceiling are healthy: Marrakech drill walked out
  7.47 m in 11.9 s and put the prop back 0.48 m from home; the impossible
  retrieval ended at 16.4 s having gone 10.52 m. No errors.
- **THE DRIFT IS THE ONE OUTRIGHT FAILURE: 0 of 3.** Its 9 props scatter around
  `{x:2, z:42}` on the Shelf and its only nearby person is the jetty traveller
  at (26.4, 32.8) — 26.1 m from the scatter centre, so ownership is a coin flip
  on where the random scatter lands. Its witness chain is deliberately absent
  (drift.js: "one voice per island and forty metres of sky between them") and
  must stay absent. So the Drift's second chain has to be OWNERSHIP, by moving
  the scatter onto the household that is already drawn there.
- **SIX OF THE EIGHT CHAPTERS HAVE NOTHING EDIBLE IN THEM**, so batch 1's
  produce reaction is unreachable in three quarters of this batch. Marrakech is
  a false positive — it has an authored orange-cart chase (`sahara.js:4626`)
  that is richer than the generic chain; the count only sees SCATTERED props.
