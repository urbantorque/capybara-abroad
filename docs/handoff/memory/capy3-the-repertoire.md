---
name: capy3-the-repertoire
description: "The forty named stunts (Q1+Q2) — why a masher only ever earns two of them, the four ranking rules, and the identical-anchor trap that hooked a page to the wrong refresh"
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c28ee5-fd4b-4f8e-b699-73fd732dbf2e
  modified: 2026-09-09T02:57:00.727Z
---

ROADMAP-NEXT item 4, built 9 Sep 2026 as Q1 (the names) and Q2 (the page, the
variety term, the ledger foot). `sysREP` in systems.js: forty patterns, matched
against `repEv`, a ring of the last eight witnessed events that `incAdd` now
carries a `kind` and a prop `type` into. Read-only over the chain — the twelve
seconds, the twenty-two metres, `sysINC_COOL` and both tiers are untouched.

**A masher earns two of the forty, and that is the load-bearing measurement.**
The directed troublemaker (grab the nearest prop, throw it at the nearest
person, every 0.9 s) over nine minutes and 292 throws produced twelve cards,
eight names — and **two distinct**: THE HAT TRICK ×7 and KLEPTOMANIA. The
nearest prop is the same prop, and the same prop three times is always the same
name. This is why SAME AGAIN and THE HAT TRICK are deliberately the entry tier,
and why notoriety's `variety` term (Q2) is the one thing a masher cannot farm.
A *random* masher chains once in six chapters, so the "freebie" worry is the
wrong way round entirely.

**Four ranking rules, each of which cost a measured pass.** An `any` is a
length not a description and scores 0; a chapter-locked name outranks a neutral
one by 3, not 1 (at 1 all four locked names were dead code); `kinds` scores 2n,
not 3n; and the three breadth names sit at the bottom of the table so table
order breaks the tie. Every fault was the same shape: **a name winning by
requiring less**.

**`variety <= inc + scn` is structural, not hopeful** — a name is only written
on the beat that decides a card is owed, so `repName` has exactly one call
site. `qa/q1-static.cjs` asserts that count, because a second writer would
break the bound silently and the only symptom would be a tier table that had
quietly stopped meaning what B14 calibrated it to mean.

**An identical anchor line hooked the page to the wrong function.**
`jrAlbBtn.hidden = !albAll().length;` occurs TWICE in systems.js and the first
occurrence is `albRefresh`, not `jrRefresh` — so a patch anchored on it rebuilt
the journal's page whenever the album refreshed, and the fold never appeared.
Anchor on a line you have proved unique, or assert the call count afterwards.
See [[capy3-the-paper]] for the journal card this lives on and
[[capy3-the-number]] for the notoriety formula it now feeds.

**An unearned name is drawn as the shape of its words** — one bar per word, in
the width of the word — which is the shelf's unearned-souvenir rule applied to
text. It is a `<details>` fold on the journal, not a fourth full-screen card:
`albShown` is named at nine sites in systems.js and every one of them is a
place a fourth modal has to be told about.
