---
name: capy3-the-delight-review
description: "3 Sep 2026 six-agent post-polish review, ROADMAP-DELIGHT.md's seven areas and four batches D1-D4, and the two numbers that shaped it (a 29-level shadow, a two-colour sky)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ee850255-3249-4dd2-8e9f-9877152377ef
  modified: 2026-09-02T18:17:08.552Z
---

Written 3 Sep 2026 after P1–P8 closed `ROADMAP-POLISH.md`. Six read-only
review agents (picture, body/animation, world life, feel/camera, the frame,
and a code audit of every prior "left/spill/not landed" line) plus two live
instruments produced **`ROADMAP-DELIGHT.md`**: seven areas, four 2–3 h
batches (D1 depth = shadow+sky, D2 the body = stride/crouch/lean, D3 the
world answers = barge+witness+sway, D4 the payoff = ceremony freeze,
distance punch, landing dip, chapter:done) and a sized shelf D5–D9.

**The headline:** the systems exist and the wires between them do not. Every
D1–D4 item is one function reading a number another function already
publishes.

**Two measurements, and how they were taken:**
- `qa/rv-shadow.js` — render, read pixels, `sun.castShadow=false`, render,
  read, restore, in ONE JS turn. Shadow depth is 25–31 levels of 255 in
  Sydney/Kyoto/Venice/Sahara (frame means 108–174), because `hemi` 1.35 +
  `amb` + `fill` are unshadowed. The fix is a sky-occlusion scale in
  `sysInstallShadowFilter`, per-chapter, 1.0 for night/overcast rows — NOT a
  re-grade (P1 measured the veil and left it).
- `qa/rv-shots.js` — fifteen rest frames via picker key. `sysSkyPaint` reads
  only vertex Y: no azimuth, so no sun lobe/horizon band/stars in 15 chapters.

**Load-bearing code facts (all grep-verified 3 Sep):**
- `sysPUNCH_MIN = 0.55` is a fraction of `sysSHAKE_MAX` 0.34 → absolute floor
  0.187; `chapterCeremony` punches 0.18 (m=0.53) and a `wow` 0.14 (m=0.41).
  The comment says both freeze; neither does.
- `npcWitnessChain` returns 0 unless live is sydney or pasto.
- `capySTRIDE = 0.62` constant drives cadence while swing amplitude is speed-
  dependent → feet skate ~0.4 m/step at 1 m/s. `paMove` already has the fix.
- `capybara.js` bonk gates on `other.mass === 0`; NPCs are kinematic → a barge
  produces nothing.
- `grep -c sway`: venice/quay/monaco/manly/cave all 0.
- `capy:land` has ONE listener (props.js dust).
- `sysSHADOW_HALF = 22` (44 m box); Rio parasols at ~28 m are outside it.
- Shelf audit: `nextIn` exists in 6 chapters with no default; `sfx()` comment
  says eleven `force:true`, there are 31; minimap HAS a per-chapter relief bake
  (do not re-propose "no underlay"); Hanoi fold gate widened; underwater bus
  and per-room interiors DONE; speed streaks / photo poses / ω×r / Pasto
  timers / arrival `look` anchor NOT done.

**Harness notes:** `renderer.info.render.calls` reads 1 after `tick(dt,true)`
(composite quad is the last draw, counter resets per render). Adaptive DPR
drops to 0.90–0.95 headless in Kowloon/Manly/Antarctica/Hanoi — pin `dpr`
before a pixel count. A server was already on 5188 from a prior session;
`server.mjs` exits 1 with a clear message rather than clobbering it.

**How to apply:** start D1 by re-running `qa/rv-shadow.js` unchanged as the
before; every verify line in the roadmap is a paired A/B inside one session.
Not committed by the review session — the scheduled task asked for a roadmap,
not a commit.

Related: [[capy3-the-polish-review]], [[capy3-payoff-and-hood]],
[[capy3-the-subject]], [[capy3-faces-and-bodies]], [[capy3-the-penumbra]],
[[capy3-exposure]], [[headless-qa-harness]]
