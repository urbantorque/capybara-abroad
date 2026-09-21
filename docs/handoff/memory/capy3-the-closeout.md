---
name: capy3-the-closeout
description: "Finishing the Payoff Pass: the seventeen-chapter blind spot, four instruments that lied, and the pillars on 18-19"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2a34ba76-0e27-47ea-a91f-658f28b3595c
  modified: 2026-08-26T10:23:37.910Z
---

The pass that closed batches 1-4 and ran the five pillars on Monte Carlo and Hanoi,
26 Aug 2026. `CONTRACT.md` §v30, `qa/CLOSEOUT.md`.

**The through-line: ten of the findings were invisible to an audit that was reporting
green.** A green run from an instrument nobody has checked is worth less than no run,
because it is believed.

## A CHAPTER LIST IN AN AUDIT IS A BUG WAITING FOR A CHAPTER

`channels.mjs`, `budget.js`, `stillness.js`, `fuzz.js`, `audit-solid.js` and `lines.mjs`
all carried a hard-coded 17. For a fortnight after chapters 18-19 shipped they were the two
nothing checked, and every audit printed a confident `17/17`. It hid: no event-grade row in
either (nor in 1-3, third version running); no ratchet ceiling, which `budget.js` passed
SILENTLY because `if (c && ...)` reads "no ceiling" as "within ceiling" — **Hanoi is the
biggest chapter in the game at ~245k triangles**; and **zero `after:`/`before:` lines in
either**, which `lines.mjs` missed twice over (file absent from its table, and its
regression list named four specific files rather than testing "has none at all").

Derive the count from the table. Never spell it.

## FOUR INSTRUMENTS THAT PRODUCED CONFIDENT WRONG NUMBERS

1. **Cost gate, machine load.** Single-mean readings swung 1.68→5.31 ms for one chapter,
   and iceland measured SLOWER with shadows off — impossible. Now min-of-five (noise only
   ADDS time) plus that impossibility as a self-check; a contaminated run may not fail.
2. **Ratchet slack, wrong axis then wrong script.** Scatter randomises at page LOAD, not
   `switchTo`, so re-entry in a session is the same build — goreme spreads 12,652 across
   loads against a ±1,500 global figure. Then a side probe with a shorter settle under-read
   hanoi by 9,000 and its new ceiling tripped by 546 with nothing added. **Size a ratchet
   with the script that enforces it.**
3. **`fuzz.js` keepHover read `keepOut('sydney')` in all 19 chapters** — it was testing
   whether a Sydney plaque could be rescued onto the origin of Monte Carlo. 3.41 m there;
   the chapter's own keepsake in its own place, 0.34.
4. **The route-life probe took an `InstancedMesh`'s bounding-box CENTRE as one object**, so
   90% of every chapter's dressing was invisible (Monte Carlo: 253 meshes, 2,780 things).
   It read 48 dead cells, and adding 15 lamps on the line it complained about moved it UP
   to 53. **A detector that gets worse when you fix what it points at is not measuring what
   it says.**

## THE FINALE COULD NOT BE REACHED BY ITS OWN TESTS

`qa/all-task-ids.json` stayed at 199 of 229 ids when 18-19 shipped. All three `pf2-finale*`
scripts write it into the save to get there, none checks it, so `sysFinaleAll()` has been
false ever since and every one was exercising an ending that cannot fire. Found from
`keeps: 0`. `audit-tasks.mjs` now BLOCKS on fixture-vs-table drift.

## THINGS THAT MEASURED WRONG FIRST

- **A row keyed on a position must take it from whatever moves the thing.** Hanoi's new
  `trainGlow` derived `x0 + s` when the train runs `x1 + 60` downward → 0.00 at the exact
  moment its marquee paid out.
- **Pasto's new grade row measured 0.000 across a whole ride**: keyed on the crater, but
  the marquee fires at the LAUNCH, 104 m away against a 70 m falloff. The unsteered bird
  never came within 95.4 m in two minutes. v25's finding reproduced inside its own fix.
- **A bare `lookX` write is worth nothing.** The witness look landed on 9 of 16 people and
  was down to 2 a fifth of a second later — twenty-odd sites in the state machines write
  `lookX` every frame. Re-assert AFTER the state machine runs. And **`gawpT` COUNTS UP**:
  writing 2.6 into it ENDS the gawp instead of extending it.
- **Ceilings and radii must be derived from each other.** The finale's gather recruited
  people 28 m away with a 14 s ceiling that reaches 11.8 m; four of five were stopped
  mid-walk and one never moved. One slot landed in a flower bed — a point nobody can
  stand on.

## CHAPTER 19'S MARQUEE FIRED WITH THE TRAIN BURIED

`the-train` paid out in the DESPAWN branch — 17.7 s after the train passed, with
`visible = false` and the body at **y = -900** set three lines above it. Move a payout into
the pass; **the moment is not the same thing as the score** (the record still files at
despawn, because closest-approach is not known until the pass ends).

Then two the PNG found and no number could: the bearing was a literal `1.5708` across the
tracks, and **any z term at all points the lens at a wall** — the frame was flat beige with
the wow card over it while the train was present, visible and 82% inside the frustum. And
**no distance or raise survives that alley**: 11 m asked → 1.4 delivered, 6.4 m raise →
2.7. That is the occlusion ray being right. The request is a BEARING ALONE.

## SYDNEY AND PASTO ARE NOT LOCALS CHAPTERS

Batch 1's "13 of 15 locals chapters carry two of three chains" was true and hid it: they
predate `addLocal`, their casts are npc.js's own `humans` and `paCast`, so the whole
reaction layer is shut in the first two hours. Both come from the same `buildHuman`, so the
witness chain and produce port with nothing new built. Ownership does not port (needs a
steering state with a ceiling on casts that already carry fourteen) and is recorded open,
not faked.

## STILL OPEN

- **Pasto's drift is NOT the walker shove.** `npcBlockedFor` adds the player to NPC
  steering (0 shoves in three runs) and the drift is unchanged: 7.97-9.71 m with and
  without. An earlier run with 14 shoves drifted 1.22 m. The residual is a steady 8 m slide
  on ground sampling `grad 0.0000`, with the body holding EXACT velocities (`vz -3.000`,
  then `vx -0.368`) while barely moving — a bare velocity write. Next thread to pull.
- Only 5 of 19 chapters register a critter; 18 and 19 have no ground animal drawn.
- Monte Carlo's route is the thinnest of six measured (14 dead cells vs 0 for goreme,
  venice, manly); lamps closed it to 12, the rest needs content.
- Kowloon's roof, room tone per biome, Iceland's snowcat track — all unchanged from v27.

Related: [[capy3-payoff-batch-four]], [[capy3-two-runs-one-tree]], [[capy3-monte-carlo]],
[[capy3-hanoi]], [[headless-qa-harness]], [[capy3-external-forces-on-the-capybara]],
[[capy3-catch-all-state]]
