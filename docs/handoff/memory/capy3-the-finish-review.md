---
name: capy3-the-finish-review
description: "The 5 Sep 2026 seven-agent deep review after the title pass: five gaps, ROADMAP-FINISH.md's three batches F1-F3, the leak that was not one, and three arrival defects a teleport soak cannot see"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3438c0a0-f668-4a46-aecf-4e1f8f98ae17
  modified: 2026-09-05T14:02:12.989Z
---

Run 5–6 Sep 2026 on "do a deep review, five key gaps, three ~2 h batches".
Output is **`ROADMAP-FINISH.md`** (F1 the first ten minutes and the arrival;
F2 the world answers; F3 the sound over an hour and the safety net; gap 4,
the frame and the options, shelved and sized). Seven read-only agents
(onboarding, settings/accessibility, objectives, long-session health, audio,
NPC reactivity, regression hunt since 31 Aug) plus eight measured runs
(`qa/rv-*.js`). No source was changed.

**THE HEADLINE:** the game is finished; what is not is (1) the first ten
minutes and every arrival, (2) people reacting outside chapter 1 (12 of 19
chapters have zero person-reaction tasks; 216 crowd people never turn a head),
(3) repetition in the audio (all 43 noise voices play the same 45 ms because
no `start()` passes an offset; the six band chapters loop 7–19 s with the
breath gated off), (4) options (three faders and one switch), (5) three ways a
session can end without an error (a NaN AudioParam splices `systems` out of
the update loop at `main.js:2043`; camera NaN latches through `damp`; the
departures board re-adds one dead collider per re-entry — **measured 160 → 166
over six round trips**, `qa/rv-board.js`).

**THE LEAK THAT WAS NOT ONE.** `renderer.info.memory.geometries` rose 498 on a
second lap with mesh/object counts flat, Hanoi +155 in 7 s. Two probes
(`rv-churn.js` standing still, `rv-action.js` per verb) made **zero**. The
counter counts FIRST RENDERS, not creations: a random walk that brings
resident scenery into view raises it. Hook
`BufferGeometry.prototype.computeBoundingSphere` and attribute by `src/` stack
line before believing a rise. Likewise the lap-2 frame-time drift (+3 ms
medians) vanished in a same-session standing A/B (18.5 vs 18.5).

**THREE ARRIVAL DEFECTS A TELEPORT SOAK CANNOT SEE** (all from `rv-arrive.js`,
which uses `hud.cross`, not `switchTo`+`spawnOf`):
- `camDist` is not reset in `teleportCapy` (the reset list at systems.js
  ~24514 covers yaw, hand, dolly, clear, skyEye, titleT, shake — not dist), so
  **the arrival lens is composed at the previous chapter's zoom**. Manly from
  Cappadocia: sea fills half the frame, animal a head behind a bin; Manly from
  Sydney: fine. Arrival audits must arrive from a far-zoomed chapter too.
- Antarctica's boom is 3.5 m in every mode (`sysCAM_DEF` 9.5): the spawn sits
  against the hut. `MONACO_SPAWN` (`main.js:425`) is the precedent for a spawn
  declaring `dist`/`pitch`/`raise`.
- Monte Carlo ticks `chicane` with no input: cones spawn on the track on first
  `onEnter`, a car goes through them, one is in the harbour by 9.5 s. The
  `prop:water` handler has no "player touched it" term.
- Also: speech bubbles paint OVER the to-do paper (pool appended after the
  card, `.capyui-todo` has no z-index).

**FOUR D6 GLYPH-SHEET REGRESSIONS, verified:** `.capyui-setmute.off .cross
{display:inline}` discards the 16 px size (mute icon jumps to button size);
`toast(...,'last')` calls `sysToastPush(children.length)` which can never
push (the closing sentence never arrives alone; `sysToastPush(0)` is right);
`.capyui-back .capyui-g{margin-right:7px}` also hits the touch STUCK button;
touch glyphs inherit the old word `font-size:10px` so 1.6em = 16 px not 24.

**AGENT-REVIEW TRAPS THIS TIME:** `create*` is on
`BaseAudioContext.prototype`, not `AudioContext.prototype` (patched the wrong
one, read 0 nodes). A traverse counting `mesh.visible` cannot see a detach
(roots hidden, children true). `.capyui-todo .capyui-txt` returns chapter 1's
hidden rows in every chapter. `hud.cross(biome)` is the real crossing; every
older probe teleports and so never saw the three defects above.

Instruments left: `qa/rv-first.js` (first 75 s), `rv-arrive.js`,
`rv-spread.js` (task distance from spawn — Cappadocia 0 within 20 m, Monaco
median 199 m), `rv-long.js` (two-lap counters), `rv-churn.js`, `rv-action.js`,
`rv-monaco.js`, `rv-board.js`.

Related: [[headless-qa-harness]], [[capy3-the-title-audit]],
[[capy3-the-delight-review]], [[capy3-review-sweep-aug31]],
[[capy3-the-closing-four]], [[capy3-instruments-that-cannot-hold-a-line]]
