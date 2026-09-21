---
name: capy3-the-paper
description: "capy3's to-do card, journal and hint arrow after the 20 Aug 2026 pass — what the player can now steer, and the two tables that keep going stale"
metadata: 
  node_type: memory
  type: project
  originSessionId: 86e0d10e-7c57-4cdd-92c0-e6e37cbbccaa
  modified: 2026-08-20T03:23:31.797Z
---

Built 20 Aug 2026. The game's guidance surfaces were complete and correct and all THREE of
them were things that happened TO the player rather than things the player could aim.

**THE TRACKED TASK IS NOW THE PLAYER'S CHOICE.** The row that owns the clue, the bearing and
the metres was always the first unticked task in chapter order. Every one of these lists
contains something you cannot do yet — the bloom is forty seconds away, the tide has not come
in — and until you did that one, the whole of the card's navigation pointed at the thing you
had already decided not to do. `todoPin` + `F` (Shift+F back, tap a row on a phone) moves it,
and the four-row window slides with it, so the card is also how you read the rest of the place.
The window is CLAMPED at the end of the open list, not wrapped: the `<li>`s are built once and
live in a fixed DOM order, so a wrapped window would draw its last two entries above its first
two and put the clue in the middle of the card.

**A HINT IS THREE NUMBERS NOW.** `hintOut` carries an optional `y` (NaN where nobody knows
one) and the readout appends ↑/↓ past `sysHINT_RISE` = 6 m. Measured: silent on all nine
Sydney tasks (as it must be), and correct on every submerged task in Palawan and every deck in
the Drift. `hintObj`/`hintProp`/`hintNpc` pass it through; `hintAt(x, z)` alone does not.

**TWO TABLES THAT KEEP GOING STALE, AND BOTH WENT STALE AGAIN:**

1. **Keys that map to chapters.** The departures board's traveller was
   `c >= 'Digit1' && c <= 'Digit9'` — so Venice, Hong Kong, Palawan and Cappadocia could not be
   travelled to by keyboard at all, while the card's own footer said "press its number". The
   title card's picker had already had this exact fix (`sysPICK_EXTRA`); the board never got
   it. `sysPickFromKey(code)` is now the one mapping, used by both, and the board's row badge
   prints `sysPickLabel(n - 1)` — the KEY, not the chapter number, because for the last four
   they are different.
2. **Biomes that have relief in them.** The task beacon's ground height read
   `(inPasto || inKyoto || inCali || inRio || inIce || inSah || inDri) ? sysGroundY(...) : 0` —
   the seven chapters that existed when it was written. The four that arrived afterwards drew
   their beacon at y = 0.04, which is under the paving in Venice, under the sand in Palawan and
   eight metres beneath the town in Cappadocia. `sysGroundY` already asks the LIVE biome and
   answers 0 where there is no relief, which is what the list was reaching for.

**THE OTHER FIVE, ALL SMALL, ALL NO-REGRET:** the control legend is one table (`sysLEGEND`)
built into the title card AND folded into the journal, because the title card is REMOVED FROM
THE DOM 900 ms in and was the only statement of the scheme a three-hour game had; `H`/`?` open
that card with the fold already up; `Escape` opens it too, because it did nothing at all
before unless the board was already open; hold `R` for 0.55 s to be put back — see
[[capy3-put-me-back]]; `P` takes the furniture off the window, naming the elements to hide
rather than hiding everything under `#hud`, so a place card, a moment card and a toast still
get through.

`qa/pointers.js` is the audit worth keeping: it cycles the pin through every open task in every
chapter and lists the ones the card cannot point at. All thirteen come back clean — the only
rows with no pointer are the arrival tasks, "press Q anywhere", "wheek in mid-air" and the
condor pair before it is summoned.

Related: [[capy3-progression-chain]], [[capy3-put-me-back]], [[headless-qa-harness]]
