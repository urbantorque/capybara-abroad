---
name: capy3-the-sheet-and-the-turn
description: "T2 and T3 (5 Sep 2026): the card got a scale and moved off centre, and animation-fill-mode:forwards had been killing the shelf's hover lift for four passes"
metadata: 
  node_type: memory
  type: project
  originSessionId: baff573d-bbf0-4095-850d-69d7b12bdd6f
  modified: 2026-09-05T10:35:48.623Z
---

Batches T2 (`d1725a4`) and T3 (`8e17978`) of `ROADMAP-TITLE.md`, committed
5 Sep 2026 on `master`, on top of T1 (`0e1c8d2`). Contract sections **THE
TITLE, BATCH TWO** and **BATCH THREE**. The roadmap is now fully executed.

**`animation-fill-mode: forwards` PINS THE PROPERTY FOR EVER, AND AN ANIMATION
OUTRANKS A NORMAL DECLARATION.** The find of T3 and it predates it by four
passes. The shelf's deal-in was `opacity:0` in the rule plus `animation:
capyui-deal … forwards`, whose last keyframe said `transform:none` — so the
v38 hover lift on every picker tile (`translateY(-4px)`, described in its own
comment as "the difference between a shelf that responds and a shelf that
feels like paper") did nothing from the day the deal-in landed, and `:active`
died with it. Measured: hover, computed transform before `matrix(1,0,0,1,0,0)`,
after `matrix(1,0,0,1,0,0)`. **The sheen, the border and the picture's own
scale all still worked** — none of them is a transform on the tile itself —
which is why four passes read it as fine.

**`backwards` is the fill a deal-in wants**, and dropping the `to` keyframe
with it: an omitted `to` means "this element's own computed style", so one
animation serves a card rotated `-0.8deg` on page one and `none` on page two,
and nothing is pinned afterwards. Now the rule for every animation on the card.

**AN AUTO MARGIN ON A FLEX ITEM CANCELS THE STRETCH.** `.capyui-p1` is a flex
column. Aligning the legend's label by giving it the legend's `max-width` plus
`margin:0 auto` did not centre a full-width block — it shrank the block to its
own text (676 px to 212 px) and floated it, which is further from aligned than
it started. The fix is that the label is a **cell of the same grid** spanning
every column: two boxes cannot drift apart when there is only one box.

**`zoom` IS THE SCALE TOKEN, AND THE TWO PAGES CANNOT SHARE ONE.** `--ui` from
`titleFit()`, floored at 1 and ceilinged at 1.35. Sized so page two fits a
1080 window, page one's wordmark is 25.9 % when it wants 26-30; sized for page
one, page two ends 24 px past the bottom. Page one measures against 820 px of
height, page two against 1010, width term shared. Wordmark 21.5 % → 28.4 %.

**THE CAMERA MUST ASK THE LAYOUT, NOT MODEL IT.** T1 derived the card's edge
from `sysCARD_W` and the viewport; T2 gave the card a zoom and a margin and
that arithmetic went stale instantly. `titleFit()` publishes the measured NDC
edge on resize and on a page turn, and the rig reads a number knowing nothing
about media queries. `sysVW` and `sysCARD_PAD` died with it.

**A TURN IS TWO HALVES, NOT A CROSSFADE.** Both pages in the flow at once
makes the card as tall as both (the standing note over `.capyui-page[hidden]`);
lifting the outgoing one out with `position:absolute` means giving it a height
it no longer has. 130 ms out, swap, 130 ms in. A **timer, not `transitionend`**:
the outgoing page transitions two properties and would fire twice, and a page
that never transitions (background tab, collapsed duration) never fires once.

**GATE MOTION IN BOTH HALVES OR IN NEITHER.** The CSS collapse keys on
`prefers-reduced-motion`; `calmOn()` is the player's switch and only follows
the media query when they have set nothing. A player who turned calm off on a
reduce-motion system would get collapsed transitions AND a JS half waiting
130 ms for them. `titleStill()` is both.

**A COMMENT THAT WAS WRONG:** `titlePage` claimed the deal-in "can never run
twice". An element leaving `display:none` **restarts its descendants' CSS
animations**, so the shelf has re-dealt on every visit to page two since the
split. Left alone (it reads well); only the claim moved.

Also: the hero picture was sized for an 880 px card and the card is 1140 —
40 % → 57 %, and its `--pt` wash turned 90 degrees, because a vertical wash is
right where the picture is ABOVE the words and a stain where it is beside them.

**Two targets not met, stated rather than fudged:** the card exceeds the
roadmap's 46 %-of-width bar at 1280 (50.4 %) and 1366, because `--ui` floors
at 1; and page two at 390x844 ends 1 px past the fold, down from 21 px, proved
pre-existing by differential.

**A rAF sampler must be installed BEFORE the thing it samples exists.** The
first arrival probe waited 4.2 s after reload and read a finished animation
(all opacities 1) — same family as harness trap 18.

Instruments: `qa/title-fit.js`, `title-buttons.js`, `title-legend.js`,
`title-p2phone.js`, `title-turn.js`, `title-arrive.js`, `title-hoverlift.js`,
`title-redeal.js`.

Related: [[capy3-the-title-pose]], [[capy3-the-title-audit]],
[[capy3-the-front-of-the-game]], [[capy3-light-on-the-shelf]],
[[capy3-layouts-that-scale]], [[headless-qa-harness]]
