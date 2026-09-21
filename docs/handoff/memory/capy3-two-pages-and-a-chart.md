---
name: capy3-two-pages-and-a-chart
description: "capy3's title card after the split into two pages, the six-verb legend, and the one line that had been deleting six landmarks from every chart"
metadata: 
  node_type: memory
  type: project
  originSessionId: 77c748fb-b63b-405b-88c5-6ccb693f86fc
  modified: 2026-08-20T15:45:17.653Z
---

Rebuilt 21 Aug 2026, from "the title screen is too congested" and "15 controls, not 5".

**THE CARD WAS ASKING TWO QUESTIONS AT ONCE.** Masthead, carry-on row, hero tile, a scrolling
shelf of sixteen places, a rule and thirteen keys — six blocks of unrelated information on one
sheet. The two questions have nothing to do with each other:

    page one   what is this and how do I move        the name, and six keys
    page two   where am I going                      sixteen places

`titlePage(n)` is the whole of the state: a class on the card and two `hidden` flags, never a
rebuild, so the shelf keeps its scroll position and the deal-in animation cannot run twice.
`[hidden]` is only `display:none` by a UA rule that ANY later `display` outranks, and
`.capyui-page` carries one — restate `.capyui-page[hidden]{display:none}` or both pages are in
the flow and the card is twice as long as before the split.

**THIRTEEN KEYS IS NOT A CONTROL SCHEME, IT IS A MANUAL.** Nothing was unbound — a key a
player has already learned must never stop working. The list became two lists. `sysLEGEND` is
the six VERBS (WASD, Shift, Space, E/click, Q, drag+wheel) at a size meant to be read;
`sysLEGEND_MORE` is the FURNITURE (camera keys, F, held R, Tab/Esc, P, mute/music/volume),
one fold away. `sysFillLegend(el, 'core'|'more'|'all')` — the journal takes `'all'`.

**Interaction traps, all four found by testing every path rather than by reading:**

- The backdrop's catch-all "click to start" must be gated to page ONE. Around a grid of sixteen
  tiles, a click that misses by four pixels is common, and starting Sydney because somebody
  missed Reykjavik is the worst thing this card can do.
- **stopPropagation goes on the SUMMARY, not on the `<details>`.** A `<details>` is a block:
  at 640 px that is a strip across the middle of the page, and guarding it swallowed every
  click in that band. Measured, a click at (400, 400) on a 1280×720 window did nothing at all.
- Space on page two turns BACK rather than starting a chapter you did not point at; Escape
  turns back too, and did nothing at all on this card before.
- Two filled accent buttons is no hierarchy. With a journey on file, "Start somewhere fresh"
  drops to an outline so "Carry on" is unambiguously the primary.
- The hero tile has a fixed `height` with `overflow:hidden`; under 520 px it stacks and the
  words get clipped off entirely. `height:auto` in that media query.

**THE CHART. `mapMarkPos` NEVER CALLED A GETTER.** The biome api contract is "a fixture is an
object, a thing that MOVES is a method — ask, never cache", and every biome honours it. The
minimap's reader knew about objects and `{position}` and nothing else, so a mark whose getter
was a method failed `typeof v.x === 'number'` and was dropped **without a word**. That silently
deleted the Rialto and the gondola, the Star Ferry, Manly's flags and surfboat, and the
Pantanal herd — which is not a random six. They are the moving things, and Manly's flags are
that chapter's own way out. `game.hud.mapMarkAudit()` now lists resolved vs missing per chart;
all sixteen come back with zero missing.

The rest of the chart pass: a dashed LEADER LINE from the animal to the goal (a direction, not
two positions to subtract), the goal as a haloed pin rather than a ring competing with eight
landmark dots, "you" as a white disc with a hard dark rim (the eye finds the rim on any
ground), a metres chip under the chart, landmarks stepped back, and the whole thing widened
from 94–132 px to 118–164.

Related: [[capy3-layouts-that-scale]], [[capy3-the-paper]], [[capy3-controls-one-voice]]
