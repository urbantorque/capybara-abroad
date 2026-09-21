---
name: capy3-the-front-door
description: "v52 — the publication pass: the game was fine and the thing delivering it was not, and the $' that split the bundle in half"
metadata: 
  node_type: memory
  type: project
  originSessionId: 54c25a9c-9f6d-438b-a873-1025f6bd1770
  modified: 2026-08-30T19:56:22.396Z
---

Ran 31 Aug 2026 on a scheduled "review what is holding this back from
publication, then fix it" task. **Uncommitted**, on `master`, on top of the
uncommitted v51 tree. Architecture in **CONTRACT.md ➜ "THE FRONT DOOR (v52)"**;
the forward plan is **ROADMAP.md** (new, repo root).

**THE FINDING THAT SET THE WHOLE SHAPE: there was nothing wrong with the game.**
Nineteen chapters entered through the picker, driven nine seconds each, seventy
frames sampled — **0 console errors, 0 NaN, 0 solver saves, 16.5–17.0 ms
everywhere**. Meanwhile the file the README told you to double-click could not
start without a CDN and said *nothing at all* when it could not. After fifty-one
passes of content and picture, **the delivery is the weakest part of the
product**, and a review that goes looking for a content bug because that is
where the work went will invent one. Say "the game is not the gap" out loud.

**THREE FAILURES, ONE SYMPTOM: a permanent `warming up the harbour…`.** No
WebGL, a blocked CDN, or a throw during boot. A module script whose bare
specifier will not resolve **never reaches `window.onerror` with anything
readable**, so the CDN case was completely silent. All three now get a card in
the palette naming which one it was. Two rules:

- **Ask for EXACTLY the contexts three.js asks for, in its order** (`webgl2`
  then `webgl`). The probe fell back to `experimental-webgl`, which Chrome still
  answers — so the probe passed, the renderer failed on its own request, and the
  player got the generic card. *A capability check more generous than the thing
  it checks for is worse than none.*
- **The watchdog is cleared by a FRAME, not a module.** `window.__capy` is set
  in the first ten lines of `mainBoot`; clearing on that calls it off before any
  of the twenty-three modules run. `main.js` sets `__capyRunning` after two rAFs.

**`String.replace(pat, string)` INTERPRETS `$&`, `` $` `` AND `$'` IN THE
REPLACEMENT — AND three.js CONTAINS A `$'`.** Inlining it spliced
"everything after the match" (`</script></body></html>`) into the middle of a
string literal 1.2 MB into a 9 MB bundle. Right size, looked fine, died with
`SyntaxError: Invalid or unexpected token`. **Use a replacer function**
(`replace(pat, () => s)`) for anything containing code. The bug was latent in
`build.mjs` for the life of the project; the game's own source just never
happened to contain a `$` sequence. Same family as the heredoc-backslash trap.

**VENDORING, AND WHY THE IIFE.** `vendor/three.module.js` + `vendor/cannon-es.js`
(MIT, notices + SHAs in `vendor/README.md`). Each is wrapped in its own IIFE, not
concatenated flat: **three and cannon both declare a top-level `Material`**
(also `Quaternion`, `Shape`, `Plane`, `Sphere`). Both are single-`export`,
import-free, alias-free — `build.mjs` re-checks all three before wrapping, and
refuses to emit a bundle naming a CDN. `dist/` now really does run from
`file://` with the network off (verified: booted, 148 bodies, 49 props, 0
errors), which its own header had claimed since day one.

**A LOST GL CONTEXT HAD NEVER BEEN LISTENED FOR.** Driver reset, laptop waking,
another tab taking memory. Black rectangle, HUD still drawn over it, keys still
answering — looks like the player is doing it wrong. `webglcontextlost` **must**
`preventDefault()` or the browser will not try to restore. `game.tick` returns
early while it is gone.

**TOUCH WAS ~60 % OF A SCHEME, AND THE MISSING PART WAS THE RESCUE.** The
plumbing was fine; a phone player was *shown* keys they do not have. Fixed: a
`sysLEGEND_TOUCH` chosen by the same media query the touch layer uses;
`sysSay()` rewriting the **39 of 191 clues that name a key** (`press E at the
fire`) — applied **before** the `clue !== textContent` compare or it rewrites 4×
a second; a SLIDE button; a quiet dashed STUCK button (**not** in the action
fan, and **not** bottom-left, which is inside `.capyui-zone`); and pinch-to-zoom,
which had to be *written* because putting it on the legend made the legend a lie.
**`movementX` is a mouse concept and is not reliably filled for touch pointers** —
take the delta from the last clientX. Don't pointer-capture the second finger.

**FOUR INSTRUMENTS LIED, WHICH IS THE USUAL RATE HERE:**

1. A soak pressing `Digit1..Slash` **during play** measured Sydney nineteen
   times — picker keys only work on the picker page (`ArrowRight` first).
   Always assert `g.biome.current` in every row; it is the only reason it showed.
2. `hasQualityApi: false` — **the adaptive DPR already existed and is correct**
   (`sysMaxDPR()` + a 2 s sampler to 0.7). Fourth time a review's opening probe
   has lied about a built feature. See [[capy3-five-things-already-built]].
3. A touch-layout probe that forced `.capyui-touch.on` without emulating the
   media query reported the map covering 100 % of the WHEEK button. The real
   phone rule moves the map to the top right. **Emulate the media query**
   (CDP `Emulation.setEmulatedMedia` + `setTouchEmulationEnabled`), don't force
   the class.
4. A probe that dispatches ANY synthetic `keydown` **retires the touch layer**
   (`keydown → classList.remove('on')`, `{once:true}`), so the screenshot after
   it showed no buttons. Start a touch run with a `pointerdown` and never a key.

Also: `page.route('**://**')` aborts the `file://` navigation itself — scope it
to `http://**` and `https://**`. And trap 20 bit again: a rerun wrote nothing and
the **old result file was still on disk**; check mtime before believing anything.

Left undone deliberately: **there is no `LICENSE` and that is the author's call,
not mine** — it is the one remaining hard blocker for sharing, and `package.json`
is marked `private` with no `license` field until it is made.

Probes: `qa/v52-boot.js`, `v52-gpu.js` (resolution sweep: 1.96 ms @720p,
8.12 @1440p, **17.4 @1800p**), `v52-soak2.js` (all 19 via the picker),
`v52-touch2.js`, `v52-pinch.js`, `v52-desk.js`, `v52-file.js`, `v52-nowebgl.js`,
`v52-verify.js`.

Related: [[capy3-the-second-hour]], [[headless-qa-harness]],
[[capy3-five-things-already-built]], [[capy3-instruments-that-cannot-hold-a-line]]
