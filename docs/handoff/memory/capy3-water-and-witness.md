---
name: capy3-water-and-witness
description: "The v19 pass — the dive became a property of water, twenty unlisted finds, and a 26-second wariness; plus the four camera rules that are wrong underwater"
metadata:
  type: project
---

23 Aug 2026, after [[capy3-shape-and-thread]]. Three macro gaps, one commit.

**THE DIVE IS DEPTH, NOT A CHAPTER.** `capyCanDive` was `!!api.canDive` (3 chapters).
Now: explicit `true`/`false` still win, everybody else is measured —
`capyWaterY(api,x,z) - capyGroundY(game,x,z) >= 1.75`. The rule SELF-SELECTS, which
is the tell it is the real question: a chapter that modelled a seabed gets the verb,
one whose water is a flat plate publishes no `terrainHeight`, answers 0, and is
untouched. Sydney/Quay 0%, Drift 0%, Cali 24%, Kyoto 47%, Pantanal 41%, Iceland 91%,
Rio 96%, Venice/Kowloon 100%. 3 chapters → 11.

**MOST OF A VERB IS THE PICTURE OF IT, and four separate systems all said no:**
1. the grade block was nested inside `if (palT > 0.002)` — moved out, after every
   chapter's atmosphere and before the dome;
2. `subT` was fed only by `palawan.submerged()` — now from the LENS vs `sysWaterY`
   (a note already in the file said to judge it from the lens; it took a second
   pass to actually obey);
3. no `rig()`/`camFloor()` outside Palawan — its measured numbers (5.0 m @ 0.12 rad,
   terrain+0.95) offered as a CANDIDATE, strictly greater, so Palawan ties and wins
   and a river/balloon/helm rig still beats the dive;
4. **the terrain clearance is exactly wrong underwater.** It lifted the eye over the
   bank: measured in Venice, animal −3.04, eye **+2.90**. The boom must come IN, not
   up — 8 gentle steps stopping at the first where the eye is not inside ground, and
   the clearance capped at `waterY − 0.75` at BOTH call sites (there are two).
   First attempt tested "is there deep water under the eye" and pulled to 1.2 m —
   the frame was a capybara's back. The right test is "is the eye inside the ground".

**FINDS (20).** `FINDS` in shared.js + `sysFINDS` predicates in systems.js, swept 4×/s,
never retested once found. Never listed, no arrow/beacon/clue, nothing gated. Payoff is
the SMALLEST channel (toast + chime a fifth over the tick) on purpose: a banner would
turn a private pleasure into an achievement, and an achievement is a thing you are told
to get. They accumulate per-chapter on the ledger. Saved as `finds` + `foundAt`.
Trap: `high-point` fired on the Sydney lawn in ten seconds — a flat chapter has no
`terrainHeight`, so peak = 0 and everywhere qualifies. Gate on `sysHasRelief()` and a
peak above 3 m.

**WARINESS (26 s, linear).** DERIVED, not set: `stepHuman` takes it from `alarm` so all
six existing causes feed it free; the locals take it from `localsReact` but only when
the animal was within 7 m of the event (`npcWARY_BLAME`) or a square turns on you
because a shutter fell over. It buys ATTENTION ONLY — wider notice radius, faster
re-notice, a `wary` line set. **It denies nothing**, which is what makes it safe against
199 authored tasks; the teeth went into four finds written knowing it exists.
`game.npcHeat(x,z,r)` counts watchers across both crowds. Measured 0.00→0.95 with five
watchers, 0 heat twenty seconds later.

npc.js owns three human brains and they are separate: `stepHuman` (Sydney/Quay),
`paStepHuman` (Pasto), and `locals` (the other fifteen chapters). Anything "global
about people" has to be done in at least two of them.

Related: [[capy3-shape-and-thread]], [[capy3-the-paper]], [[capy3-the-picture]],
[[capy3-dive-and-balloon]], [[capy3-the-locals]], [[capy3-external-forces-on-the-capybara]]
