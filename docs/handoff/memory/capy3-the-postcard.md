---
name: capy3-the-postcard
description: "The postcard the camera composes (W1) — the drawing buffer's real sizes, PNG vs JPEG cost, the two premises that were false, and why the album must keep the raw frame"
metadata: 
  node_type: memory
  type: project
  originSessionId: a3c28ee5-fd4b-4f8e-b699-73fd732dbf2e
  modified: 2026-09-09T03:27:02.086Z
---

ROADMAP-NEXT item 5, first batch, built 9 Sep 2026. `K` then Enter composes a
postcard — the frame cover-cropped, the place, the journey clock, up to two
stamps and one caption in the world's voice — and it leaves by share (phone),
clipboard (desktop) or file (fallback). `photoCard`/`photoLine`/`photoSend` in
systems.js; `game.cardDebug()` composes one without taking a photograph.

**The numbers that decide everything here** (`qa/w1-premise.js`): the renderer
caps its own pixel ratio, so an 1800×1200 window has a **1530×1020** drawing
buffer and a phone has **390×844**. A 1200×750 PNG dataURL costs **44 ms and
1.6 MB**; JPEG at .85 costs **11 ms and 113 KB**. That is why the auto-shots
(the nap's, every 90 s) are not postcards — and why, if they ever become them,
they become JPEG ones.

**Two premises the roadmap asserted were false.** There is no `@font-face`
anywhere in the repo — the HUD is Trebuchet/Segoe/system-ui — so
`document.fonts.ready` has nothing to wait for; the same string measures 583.6
px on a canvas both before and after it, 580.2 in the DOM, and 593.8 in a
deliberately-absent face. And **playwright does NOT block `clipboard.write`**
(it returns ok); it is `navigator.share` that throws AbortError. So the desktop
rung is testable.

**Stamps are drawn from the primitive list, never from a serialised SVG.**
`sysDrawShapes` is `['r',x,y,w,h,key]` / `['c',...]` / `['e',...]` / polygon —
so `sysPaintShapes` draws the same list on a canvas. The shutter renders and
reads in ONE JS turn (no `preserveDrawingBuffer`), so nothing asynchronous —
including an image that has to decode — can be part of it.

**The album must keep the RAW frame, not the postcard.** The ledger's leaves,
the title card and the shelf all draw album thumbnails at 288×180 as pictures
*of a place*; a letterboxed card with a caption baked in is not one. See
[[capy3-water-and-witness]] and [[capy3-the-paper]] for those surfaces.

**Two wording traps, both caught by looking at the render.** A headline is not
a sentence: sentence-casing the gossip pool gives "Hanoi asked to secure its
bins." — a fragment with the verb missing — so it stays in capitals as the
clipping it is. And neither the stunt names nor the souvenir names want an
article supplied: 26 of the 40 names in [[capy3-the-repertoire]] begin with
"THE", and the souvenirs are authored as "a tea whisk, slightly chewed", so a
template that adds one says "the the flat white".

**A card fixed at 1200 px is soft on a phone** (2.9× upscale from a 390 buffer).
It is sized off `canvas.width` instead, floored at 760 and ceilinged at 1600,
with every drawn number going through one scale factor.

**The contact sheet (W2) is the same camera and the opposite constraint.**
The postcard reads the LIVE drawing buffer, so it must finish in one JS turn.
The sheet reads nothing live — every tile is a stored dataURL — so its
nineteen image decodes can be awaited. That is the only reason a sheet can
exist at all. One tile per chapter, always all nineteen, in three states:
your photograph, the authored postcard at full strength, or the same postcard
at a third for a place you have never been. Measured: 1504x1196, 27 ms and
206 KB empty, 74 ms and 1.28 MB full.

**`jrSeen` never recorded the chapter you start in.** It is written on
`biome:enter`, and the first chapter of a session fires none — Sydney lands
with `biomeGo` skipped, and a start abroad is a `biomeGo` for the place you
are going TO. Measured: nine seconds in Sydney and a crossing to Venice left
`seen: [10]`. The ledger had been dropping that leaf all along (`if (!d &&
!jrSeen[n] && !anyFind) continue`). Fixed in `startGame`; if you add a fourth
reader of `jrSeen`, this is the trap.
