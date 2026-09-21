---
name: capy3-light-on-the-shelf
description: "The v38 look-and-feel pass on the title card and picker, and the WCAG ceiling that sets how strong a colour wash may be"
metadata: 
  node_type: memory
  type: project
  originSessionId: 23f9586c-2de7-4da3-a043-f344b918961e
  modified: 2026-08-29T12:10:48.542Z
---

Second polish pass on the front of the game (29 Aug 2026, v38). Everything is in
`sysBuildCSS()` plus one line in `buildPick()`. Five changes, and the number that governs one
of them was measured rather than chosen.

1. **Light in the postcards.** `.capyui-pickart:after` — sky down the top third, ground shade
   along the bottom, and an inset box-shadow vignette. Nineteen hand-cut marks had flat fill on
   flat tint and no sun anywhere. `::after` not `::before`, so it lies over the player's own
   album photograph too; `.capyui-pickkey/-picktally/-pickkeep` get `z-index:2` to stay clear
   of it. The vignette is 13 px on a shelf tile and 30 px on the hero — a fixed blur is a
   whisper on a 410 px panel and soot round a 150 px one.
   First pass used 22% white on top; that blows out the six marks whose top band is already
   near-paper (Sydney, Cali, Manly, Palawan). **13% reads as light on all nineteen.**

2. **The place's colour bleeds into its words.** `--pt` set per tile from the same
   `sysMarkTint` the picture uses, drawn as a gradient on `.capyui-pickbody` that is gone by
   76%. **THE CEILING IS WCAG 1.4.3, NOT TASTE.** At alpha 0.20, measured worst-case (head of
   the gradient) with a script that composites `--pt` over the tile paper and computes the
   ratio: the four night-sky chapters — Iceland, the Drift, Hong Kong, Son Doong — took the
   10.5 px SUBTITLE from 5.57:1 to **4.38–4.48**, under the 4.5 floor. Fixed at **0.15** plus
   lifting the subtitle from `rgba(ink,.82)` to `.86`; worst row is now 5.16 and every tile
   passes. `qa/uicontrast.js` re-runs the measurement.

3. **A sheen across the ticket on hover.** `.capyui-pick:after`, a narrow band swept on
   transform+opacity, inside `no-preference`, and the selector includes `:focus-visible` so the
   keyboard gets it too.

4. **The title card is a STACK.** `.capyui-card:not(.two):before` — one more sheet, rotated the
   other way, `z-index:-1` inside the card's own stacking context. Page one only: the picker
   already dropped the tilt because a grid on the skew reads as a mistake. Three-layer shadow
   (contact / form / room) instead of one 24/60 blur.

5. **The ornament breathes.** 1 px over 5 s on `.capyui-orn svg`, `transform-origin:50% 100%`.
   Centre-origin scaling sank the animal into the rule it stands on every other second and read
   as a wobble; pinned at the feet only its back rises.

Verification for any future pass on this screen: `qa/titleshot.js` (both pages at 1440/1280/900),
`qa/uiclose.js` (clipped close-ups plus a mid-sweep hover frame — hover, then screenshot at
230 ms), `qa/uicontrast.js` (the contrast table), `qa/uimobile.js` (390 px plus a click-through
that actually starts a chapter). All of them need the dev server on 5188 and
`playwright-cli close-all` first — see [[headless-qa-harness]] trap 19.

Related: [[capy3-the-front-of-the-game]], [[capy3-two-pages-and-a-chart]],
[[capy3-layouts-that-scale]]
