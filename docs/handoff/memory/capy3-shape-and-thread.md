---
name: capy3-shape-and-thread
description: "The v18 pass — acts/win give chapters a shape, keep/shelf/ledger give the journey a thread; and the four sequencing traps it hit"
metadata: 
  node_type: memory
  type: project
  originSessionId: 523d7d9d-8842-4500-9f66-9279a484d41a
  modified: 2026-08-23T10:35:20.921Z
---

23 Aug 2026. Two macro gaps closed in `src/shared.js` + `src/systems.js` only — no biome
file was touched, which is the whole test of whether a change is global or seventeen changes.

**Chapters had one shape.** A row may now carry `act: 2|3`; `CHAPTERS` carries `acts:
[{kick,line}]` and `win` (paper window, default 4). The paper shows the LOWEST act with
anything open — a derived value, never a counter, so nothing about the act is saved and a
restored file lands on the right movement. Six chapters carry one (3, 7, 8, 10, 17 acts;
16 just `win: 2`); eleven stay flat lists on purpose.

TWO INVARIANTS, and the second is why it is safe: `completeTask` has never heard of an act
(an act stages the TELLING, not the world), and F/tap still reach every open row in the
chapter because `todoStep`/`todoPinTo` run on the full open list. Measured: one F from act 2
in Iceland puts both act-3 rows on the paper. So an act can never be a wall.

**The journey had no thread.** `CHAPTERS.keep` is one noun per place, and you hold it iff
`chapComplete(n)` — a PROJECTION of the ticks, so there is no new save field, nothing to
migrate and no way to desync. Drawn from `sysKEEPS` (same shape table as `sysMARKS`, on a
32-square, `xMidYMid meet` because an object is not a scene). It surfaces on the chapter
ceremony's second beat, the journal's shelf, the title postcards and the ledger.

**`showEnd` was a receipt.** Now a ledger built from postcards + souvenirs + records +
`jrChapMs`, one leaf per place STOOD IN, openable from the journal at any time (the board
answers "where can I go", the ledger "where have I been"), and Escape closes it instead of
`location.reload()` being the only exit.

**FOUR THINGS THAT MEASURED WRONG FIRST:**

1. **The final tick of the game is always also the final tick of a chapter.** `showEnd` at
   +900 ms opened UNDER the ceremony card at +1100. It now waits the whole ceremony
   (`1100 + sysKEEP_WAIT + sysKEEP_CARD + 500`). Same class of bug: an act card scheduled
   at +2900 ms fires after the chapter has been finished inside the wait — guard on
   `chapComplete(n)`, not just on "still here, still that act".
2. **`jrChapAt.lastTotal` started at 0 on a restored save**, so the first chapter finished
   after a reload reported its duration as every session ever played. Pre-existing; seed it
   from `jrCarriedMs`.
3. **`sysFmtTime` only ever counted minutes** — an eight-hour journey printed as `504:11`
   in the journal header. Hours added; under an hour is unchanged to the character.
4. **`role="listitem"` on a `<button>` REPLACES the button role.** The shelf slots became
   unpressable list items to a screen reader. `role="group"` on the container, no role on
   the buttons.

Also: a ticked row LINGERS on the paper for `sysTODO_LINGER`, so any headless snapshot of
"what is on the card" must filter `.done` or it reads as an act leaking into the next one.
Cost twenty minutes of chasing a bug that was not there.

Harness note beyond [[headless-qa-harness]]: the Bash heredoc on this machine eats
backslashes even with a quoted delimiter, so a `<<'EOF'` script containing a RegExp silently
becomes a different regex. Use the Write tool for any script with backslashes, or splice
strings with indexOf instead.

Related: [[capy3-the-paper]], [[capy3-progression-chain]], [[capy3-the-lift]],
[[capy3-the-middle-rung]], [[capy3-two-pages-and-a-chart]]
