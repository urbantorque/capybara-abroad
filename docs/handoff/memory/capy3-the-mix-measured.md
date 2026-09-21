---
name: capy3-the-mix-measured
description: "11 Sep 2026 sound pass (S1/S2): the score has no top end, the harshness is the sfx bus; how to tap the master post-limiter from a probe; the title autoplay rule; the game is Capybara Abroad"
metadata:
  type: project
---

**Tap the master from a probe** by wrapping `AudioContext.prototype.createDynamicsCompressor`
in `addInitScript` — the game makes exactly one (the limiter) — and hanging an
AnalyserNode off it (`qa/s1-spectrum.js`, `qa/s1-sfx.js`). Mute one bus with
`hud.setSfxVolume(0, true)` / `hud.setMusicVolume(0, true)` to measure the other.

**What it found:** the score has ~0% energy above 5 kHz in all 19 palettes and its
loudest bin is 23–105 Hz (bass drone). Every harsh thing is a NOISE VOICE on the sfx
bus (cicada 67% >5k, geyser 38%, rustle 32%, hiss, cheer, splash) and the burner peaked
+1.1 dBFS. Fix was two nodes on the sfx bus (shelf −5 dB @5.5k, LP 11k), a 38 Hz HP on
the score, the lift bed/figure/lean trimmed (it peaked 8 dB over the bed on the hush
palettes). Don't edit fifty voices when one bus will do.

**Title autoplay:** try `resume()` at load and listen for `statechange`; headless
Chromium stays suspended (one warning per load), a returning player's Chrome runs.
Any document pointerdown/touchend in capture phase is the fallback; a press on the
page-1 backdrop starts the game (pre-existing rule).

**The name is CAPYBARA ABROAD**; the masthead is cut from `sysLETTERS` — add a letter
before using it in the wordmark (missing letters render as spaces). O exists now.

Related: [[capy3-the-mix]], [[capy3-the-sound-review]], [[capy3-the-big-ones]]
