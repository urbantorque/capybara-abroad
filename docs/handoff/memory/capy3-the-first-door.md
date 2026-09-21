---
name: capy3-the-first-door
description: "R1 of the release pass — Sydney's exit zone, the board that was a ledger, and the two latches that only broke once chapter 1 had a door"
metadata: 
  node_type: memory
  type: project
  originSessionId: c356c5ad-fa32-44aa-823c-dde5c8405f3a
  modified: 2026-08-31T22:08:16.360Z
---

Batch R1 of `ROADMAP-RELEASE.md`, done 1 Sep 2026 (`8fc7aa8`).

**The hole.** `homeOk` in systems.js ORs one `at*` predicate per chapter and Sydney's
had never been written — chapter 1's only exit was `ferry-ride`, task 18 of 19, which
the four-row paper does not surface for an hour. `atSyd` is the **ferry wharf**: the
static box at (−40, −16.9) half-extents 3.5 × 7.3, so the zone is x −43.4…−36.6,
z −24.2…−17.6, with `p.y < 2.3` to keep the shelter roof (2.85 m) out of it. Ungated,
like the Pantanal's and Hanoi's. The ferry's own deck spans x −47.9…−43.7 at the
berth, so it does not overlap — no need to test for "standing on the boat".

**Three things only broke once Sydney had a door:**

1. `homeHinted` was latched per session with exactly ONE reset, inside `jrTravel`.
   Every border crossing went through the board — except `ferry:departed`, which
   calls `biomeFadeTo` directly. Get the wharf's line, stow away, and Circular Quay's
   "up the Corso" is dead for the rest of the run. The reset belongs on `biome:enter`.
2. Sydney's `sysMAP_WORLDS.way` was `{get:'ferry'}` — the arrow followed the boat
   round the harbour. Fine for "stow away", wrong for a door: a door that moves is
   not a door. It is the wharf literal now, and `mapMarkPos`'s both-getter-and-literal
   note went stale with it.
3. `wayClue()` told Sydney players "or open the board with Tab, from anywhere". That
   was **never true** — see below.

**The board Tab opens is a ledger, not a departures board.** `jrTravel` opens
`if (!jrShown || !jrDepart) return`, but `jrRefresh` disabled rows on `jrOpen(n)`
alone, so read-only mode had nine focusable, undimmed buttons that did nothing.
`const live = open && jrDepart`. The old comment argued the other way ("a keyboard
player can tab down and hear where they can go") — a disabled button is still read
in browse mode, so nothing is lost.

**Teaching a verb with no task.** The slide was on the front of the legend and asked
for by nothing in nineteen chapters. Two toasts in Sydney: one at `>5.2 m/s` held
1.2 s (capyWALK is 4.2, so it cannot fire at a walk), one on the first `capy.sliding`
— which was published in v44 and had **no reader at all** until this. Latched on a
new additive `slid` field on the save, alongside `fin`. Wrap any keyboard-naming
toast in `sysSay()` or it names a key a phone does not have.

**A trap this batch nearly walked into.** `to-pasto`'s pointer must be gated on
`isActive('sydney')`: every chapter is authored in the same coordinates, so an
ungated `hintXZ(-40, -21)` on a row that can be listed in Pasto is an arrow into
Galeras. Same family as [[capy3-shared-space-leaks]].

**Legend layout.** The core table's description column wraps past ~19 characters and
a wrapped row breaks the grid rhythm for the two rows under it. "dive · where it is
deep enough" wrapped, "dive · deep water only" wrapped, "dive · deep water" fits.
Judge it from the rendered title card, never from the string length.

Probes: `qa/r1-door.js` (fresh localStorage → walk spawn to wharf → three wheeks →
Digit2 → Pasto), `qa/r1-slide.js` / `qa/r1-slide2.js` (the beat, and that it survives
a carry-on), `qa/r1-hint.js` (the `homeHinted` latch across a border). Note
`r1-slide.js` first reported the beat re-firing after a reload: a save with **zero
ticked tasks** reads as a first run (`jrFileCount`), so Enter takes the fresh-start
branch and `saveClear()`s it. Tick something before testing persistence.

Related: [[capy3-progression-chain]], [[capy3-release-review]], [[headless-qa-harness]],
[[capy3-the-paper]]
