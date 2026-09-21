---
name: capy3-the-chase
description: "P3 — sixty measured tasks nobody could identify, nine unstated clocks, the reward that was never counted, and the nextIn hook"
metadata: 
  node_type: memory
  type: project
  originSessionId: 58965c1c-b475-4eb2-bd2b-46df963489e0
  modified: 2026-09-02T11:38:11.705Z
---

Batch P3 of `ROADMAP-POLISH.md`, 2 Sep 2026, commit `952b5d8`. Contract section
**THE CHASE — P3**. Everything in it already existed and was invisible.

## THE SHAPE OF THE WHOLE BATCH

Three systems were built, shipped and then never surfaced: the records, the
cycle clocks, the incident chain. None of it needed new mechanics — it needed
the numbers put where the player looks.

## RECORDS WERE INVISIBLE UNTIL 100 %

The record board only renders inside `if (done >= rec.ids.length)`, so through a
whole first pass nobody could tell which tasks were races. Now: a `capyui-meas`
glyph on any row with a `RECORDS` entry, and the par on the clue via
`todoParLine` — three cases, because thirteen of the sixty rows have **no par**
and a silent row would make the glyph a promise the paper does not keep.

**The clue element needed `white-space:pre-line` and a taller `max-height`.**
Without the first the `\n` collapses and the par runs into the clue as one
sentence; without the second a clue that already wrapped clips the par under
`overflow:hidden`. Same fault the record board had before v51, and invisible
unless you read the RENDERED element rather than `textContent`.

Static cross-check `qa/p3-glyph.mjs`: **231 tasks, 60 timed, 60 RECORDS rows,
0 keys that are not task ids.** Re-run it after touching either table.

## `nextIn` — THE OPTIONAL HOOK FOR AN UNSTATED CLOCK

Nine "be there when" tasks ride clocks of 54–205 s. A biome may publish
`nextIn(taskId)`: seconds until the window, **0 while it is open**, −1 for "not
a clock". Same shape as `camFloor`/`camCeil`/`localWater`. Wired in iceland,
venice, kowloon, palawan, goreme, hanoi. Rendered rounded to whole seconds,
because the string is compared against the live one on every hint tick and a
decimal would fail that comparison four times a second.

Returning 0 for the whole window matters: reporting a countdown through an event
that is already running counts down to something already true.

## THE INCIDENT WAS NEVER COUNTED

`jrChapInc` / `jrChapScene`, per chapter, additive on the save like `chapms`.
Incremented at the line that decides a card is owed — not at the top of the
function, because the chain counts every witnessed thing and the incident is the
payout. DONE HERE became a score card off four facts already on the file.
`sysGHOST_KEEP` 8 → 24 (a long run is ~36 KB of JSON; 8 against 60 rows meant a
Kyoto ghost was evicted around Iceland by the act of playing).

## TWO PROBE DEFECTS, BOTH REPORTING A WORKING THING AS BROKEN

1. **`page.addInitScript(() => localStorage.clear())` fires on EVERY
   navigation** — so the `page.reload()` meant to prove the save survives wiped
   the file it was checking, and reported `inc: null` on a run that had just
   written `inc: {1:1}`. This is [[headless-qa-harness]] trap 10 and I walked
   into it in the exact shape it is written down in. Clear ONCE with
   `page.evaluate`.
2. **An incident needs a witness.** The chain is gated on `findPeople(x,z,16) >
   0`. The first attempt stood the animal on the Sydney lawn and threw eight
   props: nothing counted, correctly. Find the densest cluster of
   `game.npcs[i].group.position` and stand there. A prop also only counts if
   `prop.disturbed` is set — props.js's word for "the capybara did this" — so a
   script must set it, and use `game.props` (the record list) rather than
   guessing at `body.userData`.

## SMALLER THINGS WORTH REMEMBERING

- **Hanoi's fold was a rising edge on a damped value** (`was < 0.5 && k >= 0.5`)
  sampled once every 96 s: arrive two seconds late and the next chance is a
  minute and a half away. Now a STATE. Same shape kowloon.js removed from the
  Symphony ("the marquee is the show, not the first frame of it") — worth
  grepping for other `was < x && now >= x` gates.
- **`game.say(s)` is new**: `toast(sysSay(s))`, so a chapter can name a control
  and have it read B on a pad and WHEEK on a phone. The condor's wingbeat is its
  first caller and was the only control in the game never taught.
- **Two cards can be the same card.** `condor-ride` has `wow: 'GALERAS'` and act
  three has `kick: 'GALERAS'`; the act curtain fires at 2.9 s and the place card
  lasts 3.6 s. `showPlaceLast` guards it.
- **Backticks in a shell string are command substitution.** Inserting a comment
  containing `` `the-bloom` `` through `node -e` in Bash silently deleted the
  word. Use Write/Edit for anything with backticks or backslashes — trap 13/20
  again.

Verified: R1 green; 19/19 soak clean, 0 NaN, 0 errors, 0 record orphans.

Left as spill: the second lawn ring (all pars / all finds) and the place-heat
tier card — both new authored beats rather than exposures of existing state.

Related: [[capy3-pad-and-card]], [[capy3-the-subject]], [[capy3-the-polish-review]],
[[capy3-names-nothing-publishes]], [[headless-qa-harness]], [[capy3-the-paper]]
