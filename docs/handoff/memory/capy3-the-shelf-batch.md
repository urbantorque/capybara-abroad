---
name: capy3-the-shelf-batch
description: "F4 — three features that had never once run, the sed that hid a const inside a comment, and the two marks that measured wrong at the size they are used"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3438c0a0-f668-4a46-aecf-4e1f8f98ae17
  modified: 2026-09-06T05:32:56.375Z
---

Batch F4, 6 Sep 2026: `ROADMAP-FINISH.md`'s three "if the clock allows" lists
and most of its shelf, in seven commits `d2b29db`..`0adc0a5`. CONTRACT.md
carries the F4 section; the roadmap closes with **STILL OPEN AFTER F4**.
See [[capy3-finish-three-halves]].

**THE PATTERN, AGAIN AND HARDER: WRITTEN, CORRECT, UNREACHABLE.** Three
separate features had never run once.
- `capy:wheek`'s handler in systems.js played a plain `sfx('wheek')` on the
  EMIT, five lines before capybara.js's own placed, variant-chosen call — which
  then landed inside `sfxGap.wheek` (0.16 s) and was dropped. **The
  capybara's call created 0 audio nodes.** The soft wheek had never been
  audible and every wheek in the game was mono.
- `condor.js` called `game.say('press Q to beat the wings.')` — but `game.say`
  is npc.js's `sayAt(x, y, z, text)`, which begins `if (!text) return`.
  **`game.hud.say` is the one that takes a sentence**, and it is the only
  caller of `sysSay`, the substitution written for exactly that string.
- Every `t` in `sysMAP_WORLDS` — nineteen authored landmark labels — had only
  ever been read by a test hook.

**A `sed` THAT COLLAPSES ITS OWN NEWLINES PUTS THE CODE INSIDE A COMMENT.**
`sed -i "502i\ ...multi-line..."` landed a `const` at the end of a `//` line.
It PARSED, `npm test` passed, and it failed at runtime as "not defined". Use
the Edit tool or a node heredoc for anything multi-line; `node --check` cannot
see this and neither can the suite.

**AND A SOURCE FILE THAT DOES NOT PARSE USED TO PASS `npm test`.**
`qa/strip-test.mjs` is the only thing in the suite that parses `src`, and on a
failed BASELINE parse it printed a parenthetical and `continue`d — so the suite
reported "10 checks, 0 failed" on a systems.js with a hard syntax error. It
fails now. **`npm test | tail -3` hides exactly this class of line; read the
whole output.**

**TWO MARKS THAT MEASURED WRONG AT THE SIZE THEY ARE ACTUALLY USED.**
- A four-point sparkle at outer 10 / inner 3.2 renders as a **PLUS SIGN** at
  ten CSS pixels: there is not enough width left in the arm for the eye to see
  it taper. Inner 4.8. **Render a glyph at its real size before believing it** —
  clone it out of the live DOM, never rebuild it in the probe.
- Drawn in the ACCENT it read as part of the "▲ 20 m" beside it rather than as
  a fact about the row. Two marks that describe a row are ink; the one that
  describes where you are going is accent.

**A FEATURE WORKING EXACTLY AS WRITTEN CAN STILL BE UNUSABLE.** Routing
off-screen speakers to the toast put **26 pills in 20 seconds** standing in
Sydney's crowd — because in a crowd most speakers are off-frame most of the
time, which is the normal case and not a bad test. A nine-second fence: 1 in
twenty seconds now.

**`physRescue` DOES NOT RESTORE A BODY TYPE.** It repositions and nothing else.
Any code that pins a prop KINEMATIC must remember the previous type and restore
it on **every** path out — including the chapter change, which the owning
update loop cannot see because it does not run in a dead chapter.

**BLENDING TWO BEARINGS BY A WEIGHT GOES THE LONG WAY ROUND** whenever the pair
straddles ±π. Put the weight on the TURN RATE (Venice, which has a damped yaw
per person) or do a shortest-arc subtraction (the Quay, six floats a person
with no spare).

**PROBE SITING IS HALF THE MEASUREMENT.** Standing at Venice's crowd centroid
is standing at the campanile, so "they are looking at me" and "they are looking
at the tower" were the same number. The Quay's people only ever pause at the
two ENDS of their route, so a probe sited off the centroid finds nobody
stopped. And the pause card pauses the world: a camera-sensitivity test run
with it open measures 0.002 rad at every setting.

**AND A CARD OPENED BEFORE THE GAME MUST NOT PAUSE IT.** `pauseShow` set
`state.paused` unconditionally; opening the new pre-start settings and closing
them left the flag true and **the game then started paused**. Also: `hidden` on
a button does nothing when its class sets `display:block`.

Instruments: `qa/f4-*.js` (nineteen of them). Hooks added:
`game.forceErrand(prop)`, `mixAudit().prog/shim/scrape*`, `musAudit().beatLen/
barAt/busy`.

Related: [[capy3-finish-three-halves]], [[capy3-finish-two-and-three]],
[[capy3-the-finish-review]], [[headless-qa-harness]], [[capy3-the-frame]],
[[capy3-the-frame-d6]]
