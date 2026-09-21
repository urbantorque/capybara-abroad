---
name: capy3-the-frame-d6
description: "D6 first session — motion tokens, the glyph sheet, the pen, and three ways a UI probe lies"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60501ba9-888e-42ec-bf5f-6720ba5e13a0
  modified: 2026-09-03T04:35:36.941Z
---

D6 first session (3 Sep 2026, commit "D6: the paper was right, the marks on it were
four different languages"). Nine of ten items; the **diegetic exit board is the second
session** and is still on the shelf. Contract section **THE FRAME — D6, FIRST HALF**;
instruments `qa/d6-frame.js` and `qa/p7-tokens.cjs` (which now also reads `index.html`).

**Motion tokens.** Four curves — `mSnap` (responds), `mGlide` (arrives under its own
weight), `mSpring` (lands and settles), `mHold` (starts and stops) — and three durations
(`dFast` .16s, `dMed` .3s, `dSlow` .5s), in `sysBuildCSS` beside the radii. The rule that
made the diff bounded: **a curve is a claim about mass**, so colour/opacity stay on plain
`ease` and only transform/height/width take a named curve. 13 un-named curves → 0.

**The glyph sheet** (`sysGLYPHS`, `sysBuildGlyph`, `sysGlyphEl`): nine filled-polygon
marks in the postcards' dialect. One chevron at four CSS rotations covers `▸ ▾ ← →` and
every arrow keycap. Two fills only: `currentColor`, and `--capyui-gbg` for shapes marked
`o` (that is how a solid disc gets a clock's hands cut out with no stroke or mask).

**The masthead** (`sysLETTERS`, `sysBuildWordmark`): a cut stencil face, caps only, every
stem 2.6 on a cap grid of y=2..14. **A D cut like every other letter is an O** — it read
UNTITLEO at 46px and needed a chamfered bowl polygon.

**FOUR TRAPS, three of them about probing a UI:**

1. **`vector-effect:non-scaling-stroke` moves the dash pattern into SCREEN units and
   bypasses `pathLength`.** `stroke-dasharray:1` becomes one pixel. It put a dotted line
   through every unticked task, and it MEASURED CLEAN because
   `getComputedStyle(...).strokeDashoffset` is the declared value. A phone-width
   screenshot caught it. Reveal a stretched path with `clip-path` instead.
2. **`getComputedStyle` on the frame a class lands returns the OLD value.** Toggling
   `.show` and reading the transform in the same turn reported "not dealt" on three
   cards that are all dealt. Wait out the transition.
3. **`document.querySelector('button')` finds the boot card's *Try again*, whose handler
   is `location.reload()`.** The run died on "Execution context was destroyed" three
   sections later and read as a harness fault. Scope UI selectors to `#hud`.
4. **The title card is torn out of the DOM the moment the game starts** — measure the
   masthead and its footer BEFORE the first chapter key.

...and one that is not about probes: **`uiSfx` calls the closure-local `sfx()`**, so
wrapping `game.sfx` sees none of the four UI voices. `game.hud.uiSfxAudit()` is the
counter.

Also shipped: `toast(text, kind)` — `say` is the DEFAULT because ~140 chapter call sites
are a sentence somebody would say; `note` for the game talking about itself; `last` held
5.2s and arriving alone. Stack capped at 3, and `sysToastPush(0)` clears it when the
ledger opens. Four UI sounds (`pop`/`rustle`/`tick`/`clink`) on one delegated `click`
listener plus `focusin` gated on `:focus-visible`, detents on a step not a pixel, all
gated on `sysCalmOn()`.

Related: [[capy3-the-paper]], [[capy3-pad-and-card]], [[capy3-two-pages-and-a-chart]],
[[capy3-the-punctuation]], [[capy3-the-waters-edge]]
