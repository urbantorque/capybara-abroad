---
name: capy3-the-front-of-the-game
description: "capy3's title card rebuild — the score on the menu, and the four layout traps that made the old one look broken"
metadata: 
  node_type: memory
  type: project
  originSessionId: 452efda3-488c-4968-b703-dbbc896aab77
  modified: 2026-08-23T13:11:21.392Z
---

Rebuilt 23 Aug 2026. The title card was the only screen in the game with no sound, and
three of its layout decisions had quietly rotted.

**THE MENU HAS A SCORE, AND IT IS THE SAME SCORE.** Not a new engine and not a stinger:
one more row on `sysMUS_PAL` (index 18, `sysMUS_PAL_TITLE`, appended so no chapter's
`pal` moved) plus `titleAudio()` — `audioUnlock()` + `musSetPalette(TITLE)` + `musicStart()`.
So `startGame` GLIDES into the chosen chapter rather than starting anything; the explicit
`musSetPalette(cdef.pal || 0)` after `musicStart()` is the only writer for Sydney, since
Sydney is not travelled to and never emits `biome:enter`.

- **The palette must be set BEFORE `musicStart()`** — it voices its opening chord out of
  `musPal`, so setting it after opens the card in the wrong key and drifts for 5 s.
- **Hovering a tile changes the key.** `titleLean(d, wait)`, 420 ms dwell on hover / 0 on
  focus, calls the same `musSetPalette` a real arrival uses. Hover Cali on the menu and
  the salsa band starts — verified: `game.music.playing` goes true. Nothing is reverted on
  pointerleave, only cancelled; a mouse crossing the shelf would otherwise fire seventeen
  key changes.
- **`game.music.playing` is NOT "is there music".** It means "is there a PULSE", i.e.
  `musBeatLen > 0`, false for every pad palette in the game. Added `game.music.live`
  (`ac && musVol && running`) because nothing could see the title score from outside.
- A browser gives no AudioContext without a gesture, so `titleAudio()` is wired to every
  press on the card that does NOT start the game: the first keydown, `goEl`, `backEl`, the
  extras `<summary>`, the picker tiles, the more-below chip, and the page-two backdrop.

**FOUR LAYOUT TRAPS, ALL OF WHICH LOOKED LIKE RENDERING FAULTS:**

1. **`height` + `overflow:hidden` on a box of clamp()-sized text.** The hero was
   `height:clamp(84px,13.5vh,124px)`; at 13.5vh of a 700 px viewport that is 94 px and the
   body wanted 118, so 'Sydney's subtitle was sliced in half lengthways. This is the
   user-reported "the Sydney text cuts out". `min-height` and defend the card's height
   budget on the SHELF, which is the only thing that grows without limit.
2. **...but `min-height` hands the panel to the `<svg>`.** With `aspect-ratio:auto` the
   64x40 mark's intrinsic ratio drove the hero to 205 px. Give the hero art an explicit
   letterbox (`64 / 25`) — and RESTATE it in all three places, because `.capyui-pickart`'s
   own rules come later in the sheet at equal specificity.
3. **Same-specificity rules stated before the rule they must beat do nothing.** The
   `@media (max-height:900px)` shelf budget sat forty lines above the base `.capyui-picks`
   and had never once applied — measured 319 px (42vh, the base), not the 380 it claimed.
   Source order is the whole argument.
4. **`offsetTop` is measured from the offsetPARENT.** `.capyui-picks` is not positioned, so
   the tiles' offsetParent is `.capyui-card` and the "how many are below the fold" count
   came out as twelve when four were hidden. Use `getBoundingClientRect()` — one frame of
   reference by construction — and do every READ before every WRITE, or a class toggle
   mid-loop forces eighteen reflows per wheel notch.

**What else changed.** The blinking `.capyui-begin` key dump (`1 2 3 … - = [ ] ; ' , .`
under seventeen tiles that each print their own key) became `sysTitleFoot(rows, note)` — a
still rail of `<kbd>` chips saying how to MOVE. Arrows now walk the shelf (`pickMove`,
column count read off the resolved `gridTemplateColumns` so it is right in all four media
queries); left off the first tile turns the page back. The shelf fades and says "N more
below" only while something genuinely is. A `.capyui-glow` behind the card takes the
hovered chapter's `sysMarkTint` — `currentColor` inside the gradient, because `color` is
animatable and a gradient stop is not; no `filter:blur()` on it, the gradient IS the blur.
`sysDrawShapes` grew an `'e'` ellipse primitive for the masthead capybara.

Verified at 1280x720/760, 1366x768, 1600x900, 1920x1080, 900x620, 390x844: footer above
the fold at every one.

Related: [[capy3-layouts-that-scale]], [[headless-qa-harness]], [[capy3-the-lift]],
[[capy3-two-pages-and-a-chart]]
