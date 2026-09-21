---
name: capy3-layouts-that-scale
description: "capy3's two per-place structures that had to stop being arithmetic — the title card's picker and the atmosphere ladder"
metadata: 
  node_type: memory
  type: project
  originSessionId: dcc928c7-6698-466c-a306-96ba0ca82238
  modified: 2026-08-20T10:59:49.355Z
---

Rebuilt 20 Aug 2026 while adding chapters 14-16. Both of these were CORRECT and both
were built in a way that could only ever be correct for one particular number of
chapters, which in a game that keeps getting chapters is the same as being wrong.

**THE PICKER WAS A BENTO, AND A BENTO IS ARITHMETIC.** Four columns, chapter one
spanning 2x2, therefore exactly twelve other chapters — or a ragged half-row that reads
as a mistake. Three fixes and none of them knows how many places there are:

- **The hero leaves the grid.** Chapter one is a full-width row above the shelf. It
  gets more space than it had and the count no longer has to divide by anything.
- **`sysPickCols(n)`** tries 4, 5 and 6 columns and takes the one leaving the fullest
  last row (remainder 0 wins outright). 15 → 5, 17 → 6, 19 → 5. Nine lines.
- **The shelf is a SCROLL REGION, not a taller card.** A card that grows without limit
  pushes the control legend off the bottom of a 720p laptop, which is the commonest
  window this game opens in. Measured: 803 px in a 720 px window before, 717 after.
- Tiles must be the same OBJECT: subtitles run three words to nine, so clamp the hint
  to two lines and put a floor under the body or the shelf is a ragged wall.
- The hero's picture needs `preserveAspectRatio="xMidYMid slice"`. The marks are drawn
  with `none`, which is right on a tile that is nearly 64x40 and turns the Opera House
  into five vertical spikes on a panel twice as wide as it is tall.
- Give the hero an explicit `height`. Left to its content it took 197 px.

**THE ATMOSPHERE WAS THIRTEEN HAND-WRITTEN BLOCKS**, each with its own `xxxT`, its own
six constants and its own rung in `atmosPrime`. Every one correct; three more would have
been three more chances to ship missing a rung, which this codebase has now done FOUR
times (the beacon's ground height, the board's digit keys, the spawn point, the far
plane). `sysAIR` is one row per place — `fogN fogF haze hazeK bg bgK sun sunK hemi gnd
hemiK amb` — one loop, one damping line, one rung in `atmosPrime` that already works for
chapters not written yet.

**The rule: a chapter whose air is a CONSTANT goes in the table; a chapter whose air is
an EVENT keeps its own block and layers on top.** The old thirteen are left alone —
they do things the table cannot (an aurora, a tide, a sandstorm, a sun clearing a ridge)
and rewriting thirteen working atmospheres to prove a point is how you break eleven.

**AND THE TWO SELECTION SURFACES SHOULD SPEAK ONE LANGUAGE.** The title card was a shelf
of postcards and the departures board was sixteen lines of text, answering the same
question — which of these places do I want to be in. Sixteen lines of text is a
timetable. The marks already existed; one 44 px thumbnail per board row makes it
scannable by COLOUR, which at sixteen rows is the only way anybody scans anything.

`sysPICK_EXTRA` now runs to twenty chapters (`- = [ ] ; ' , . / \`, and NOT backquote,
which is the stats key). A row past the end simply gets no badge and stays clickable.

Related: [[capy3-the-paper]], [[capy3-progression-chain]], [[capy3-the-picture]]
