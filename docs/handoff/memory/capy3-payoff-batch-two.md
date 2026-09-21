---
name: capy3-payoff-batch-two
description: "Payoff Pass batch 2 — the ending, the album, the first hour, and the gate that shuts chapters 1-2 out of the mischief economy"
metadata: 
  node_type: memory
  type: project
  originSessionId: ac0d3839-1dae-4bb1-a661-ee97027e0ac2
  modified: 2026-08-25T13:52:19.750Z
---

25 Aug 2026, CONTRACT §v24 (THE LAWN, THE ALBUM) and §v25 (THE FIRST HOUR AND THE
PILLARS OF 1-3). Four jobs, all closed. Batch 1's chain did NOT fire batch 2 — the
`mcp__scheduled-tasks` call is refused by the permission classifier mid-run, so
**the batch chain does not work unattended; start each one by hand.**

**THE LAWN.** Finishing the game was a receipt: the last tick anywhere scheduled
`showEnd`, which opened the ledger on top of wherever you stood (Antarctica, for a
completionist). Now: return to Sydney with all seventeen done and the seventeen
souvenirs are laid out on the picnic lawn in a horseshoe; walk into the mouth and
**sit down**. `physStageKeep` is the mover — `physSpawnKeep` is idempotent, which is
exactly what stops a caller ARRANGING anything. Two doors in, because Sydney emits no
`biome:enter`. `showEnd` could not be reused: `completeTask`'s `silent` early return
sits above the `doneCount` branch, so a reloaded complete save triggers nothing.

**THE ALBUM.** Photo mode existed since v22 and every picture left immediately. Now
288x180 JPEG thumbnails (~6 KB) under their OWN key — never the journey save, whose
single `setItem` swallows a quota throw and would take tasks/records/finds with it.
The journal has no page mechanism at all, so the album is the LEDGER'S SIBLING.

**FIVE TRAPS, and the last three generalise hardest:**

1. **`capyRestT` accrued behind the title card.** Six seconds on the menu put the loaf
   at 0.54 and pressing start put it at 1.00 — every new player's first sight of the
   animal was it already sitting. Only Sydney shows it; every other chapter arrives
   through a teleport, which zeroes both.
2. **Radius is a composition number.** The finale at 4.2 m was geometrically perfect
   and read as litter (a keepsake is a 24 cm box). A closed ring also puts a souvenir
   between the shoulder camera and the animal at every approach angle. Only the PNG
   said so.
3. **DECLARE ANYTHING READ DURING CONSTRUCTION ABOVE THE CONSTRUCTOR.** The title card
   asks the album for a postcard *while it builds*. As `const` the read threw a
   ReferenceError, swallowed by a try/catch. Changed to `var` it got WORSE: the
   declaration hoists, the assignment does not, so the key was `undefined`,
   `getItem(undefined)` answered null, and the album cached itself EMPTY for the
   session. Both measured identically from outside — 0 of 17 tiles, no error — and an
   audit called a moment later reported the album perfectly.
4. **An audit built from a string regex can be false-green.** `qa/verbs.mjs`'s blocker
   used `new RegExp('\b'+verb+...)`; the heredoc that wrote the file ate one backslash
   of each pair, the pattern became a literal backspace and matched nothing, so it
   passed clean against the exact clue it existed to catch — while its regex-LITERAL
   checks kept working and made it look alive. See [[headless-qa-harness]].
5. **`playwright-cli close-all` then `open` is a fresh context and localStorage does
   not survive it.** A script that writes a save, reopens, then checks is measuring an
   empty store. Take the pictures and check the title card in ONE session.

**THE BIG OPEN FINDING, evidenced in all three chapters:** the batch-1 mischief
economy is gated on `locals`, and **chapters 1 and 2 register none**. `localOwnerOf`
scans `locals`; the 20 m chain lives inside `localsStep`, which returns early on an
empty list; Sydney's produce/shoo is a duplicate that `biomeLive()` hard-codes to
sydney. **Pasto's 13 edible props can start no reaction at all.** Batch 1's "13 of 15
locals chapters" was true and hid this. Also open: **no chapter can frame its own
marquee** (`camYawTarget`/`camDistTarget` have no public setter — Sydney's wow pays
out with the camera jammed to 68.6° at 3.05 m against the Opera House sails); "lit" is
absent in chapters 1-2; `api.vanRiding()` has zero readers repo-wide.

Related: [[capy3-payoff-batch-one]], [[headless-qa-harness]], [[capy3-the-lift]],
[[capy3-mischief-radii]], [[capy3-things-that-are-simply-there]]
