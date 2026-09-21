---
name: capy3-the-thumb
description: "R5 — the modal a phone could not close, and the three ways a touch probe destroys what it measures"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1945dbd8-cc52-47cc-a02f-21d96d647160
  modified: 2026-09-01T12:25:47.667Z
---

Batch R5 of `ROADMAP-RELEASE.md`, committed 1 Sep 2026 (`8233067`). One `MENU`
button on the touch layer, in the right-hand column with the chart and STUCK —
the things you read rather than aim at — and never in the fan, which is what a
thumb stabs at during a chase. It opens R4's pause card, and that one button is
the whole batch: pause, the faders and mutes, the journal, the ledger, the
album, the records and the way back to the title were every one of them a
keyboard letter or Escape.

**THE FIND WAS NOT ON THE ROADMAP'S LIST.** The departures board was a trap on
touch. Three wheeks at the way out opens `.capyui-jr`, it pauses the world, and
that element had **no pointerdown listener at all** — the ledger and the album
have both closed on a tap on their surround since they were built; the one card
a phone player can actually reach had not. Its own foot said "ESC to stay". The
only exits were to travel (irreversible, unasked-for) or to reload a three-hour
game. **The lesson generalises: when a codebase has an idiom (surround-tap
closes a modal), audit every instance of the shape, not the ones you happen to
be editing.** Five furniture strings also named ESC; `sysScheme(keyWords,
touchWords)` picks the sentence — note the name, because `sysSay` already
existed as the §3 hint *substitutor* and the collision was caught by
`node --check`, not by review.

**R4's card was designed at 1280×720 and eleven of its controls were under
44 px at 390×844** — four menu rows at 33, three faders at 24, three mutes at
31×27, the calm checkbox at 16×16. 44 px is Apple's floor, 48 dp Android's, and
WCAG 2.2's AAA target size. A touch-only `@media (hover:none) and
(pointer:coarse)` block grows the hit areas only: the slider's box goes to 44
and its 4 px track is untouched. **Any card authored on desktop needs this
measurement before it ships to a phone** — the probe now asserts it.

## Testing touch: three ways the probe destroys the experiment

1. **`page.setViewportSize` moves pixels and nothing else.** The game switches
   its entire scheme on `(hover: none) and (pointer: coarse)`, and
   `page.emulateMedia` cannot reach those two features. CDP can, and it works
   from `run-code`:
   ```js
   const cdp = await page.context().newCDPSession(page);
   await cdp.send('Emulation.setEmulatedMedia', { features: [
     { name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
   await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
   ```
   Set it **before** the load: `sysIsTouch()` and the touch layer both resolve
   at module time.
2. **THE FIRST REAL KEYDOWN REMOVES THE TOUCH LAYER** —
   `addEventListener('keydown', ..., {once:true})`, and it is correct behaviour
   (a keyboard means you are not holding a phone). A probe that starts the game
   with `Digit1` and then measures the layer gets a **0×0 box at the origin with
   correct CSS and a `display:none` parent**. Cost a full diagnostic pass. Start
   the game with a tap on `.capyui-title`.
3. **`page.mouse` does it too**, via `sysSawMouse` on the first real mouse
   `pointermove`. Dispatch synthetic `PointerEvent`s with `pointerType:'touch'`
   on the element instead; `setPointerCapture` throwing on them is already
   caught in `bindBtn`. Real `<button>`s inside cards listen for `click`, so
   `.click()` is the faithful stand-in there.

Also: a screenshot taken immediately after the HUD appears can catch it
mid-fade — the first `r5-hud.png` had no MENU in it while `getBoundingClientRect`
said 58×58 at (320, 196). **Measure the rect; do not judge presence from one
frame.**

Phone geometry as built: chart 284–378 × 12–106, STUCK 320–378 × 126–184, MENU
320–378 × 196–254, at 390×844. The pause card is 367×512 and the container
already carried `max-height:92vh; overflow:auto`, so landscape scrolls rather
than clips.

Closes both remaining items in `ROADMAP.md` §3. The standing decision there
still holds and R5 respects it: **this is not a phone game and should not
pretend to be one** — one button, no second UI.

Related: [[capy3-the-frame]], [[capy3-the-first-door]], [[headless-qa-harness]]
