---
name: capy3-payoff-batch-four
description: "Payoff Pass batch 4 — the step that already happened, and the budget that stopped predicting anything"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1a36e184-25fc-45e9-970e-f9b71bb590e0
  modified: 2026-08-25T21:16:44.065Z
---

26 Aug 2026, CONTRACT §v27. Chapters 12-17 (Palawan, Cappadocia, Manly, the Pantanal,
Sơn Đoòng, Antarctica), the performance re-measure, the release sweep. Six chapter
subagents + a fuzz agent + a UI agent; fixes on the main thread. `qa/BATCH4.md` is the
handover and the found-vs-fixed across all four batches. **Batch 4 chains nothing.**

**THE BIGGEST FIND WAS NOT IN A CHAPTER.** `world.step` runs BEFORE capybara.js, so when
the idle snap decides the animal is stationary the solver has already integrated
`g·sin(θ)·dt` into the POSITION. Zeroing the velocity erases the evidence and keeps the
displacement, every frame, for ever. **A parked capybara slid down every slope in the
game** — Manly 13.36 m into the sea in 60 s, Palawan 3.65, Antarctica 3.12, Pasto 3.04,
the cave 1.34, all with `body.velocity` reading exactly 0.000 and `loaf` at 1.0.
**Two earlier batches wrote four of those up as separate chapter faults.**

The tell that made it a diagnosis rather than a guess: it is a FIXED-STEP quantity.
1/120 and 1/240 give the identical creep; 1/30 gives a different one. A real slide
scales with time, not with the step. And `24·slope/60` predicted the measured number to
three decimals in three places.

**Static friction is a POSITION and cannot be written as a velocity after the
integration.** The snap holds an anchor (in the FLOOR's frame) and returns the velocity
that restores it. 14 of 17 chapters now measure 0.00. **But the correction itself was
then a catapult** — `-ex/dt` answered a 0.50 m outside nudge with 26.4 m/s and overshot
backwards. The fuzz agent caught it. Cap the correction (`capyPIN_VMAX` 3.0); the
0.02 m/s creep is untouched.

**AND THE OTHER HALF LOOKED IDENTICAL: A WALKER BULLDOZING YOU.** `npcSeparate` settles
people at 1.05 m and the two colliders touch at **1.065** — parked exactly on the contact
boundary, so cannon resolved the residual by moving the DYNAMIC body, which is the player.
Displacement was 4.30 / 12.29 / 28.86 m on three runs of the same build (the parade's
phase). `steerTo` can never fix this: `navBlocked` forwards only to
`game.env.navBlocked`, **static world geometry — NPCs have never had a term for the
player at all.** Fixed in `npcPlaceBody`, the one place any of those bodies is written.
I spent a long time chasing this through steering before finding the collider arithmetic;
the differential that mattered was "hold the nearest body off and see if the shove stops".

**THE PERFORMANCE BUDGET HAS STOPPED MEASURING WHAT IT WAS FOR, and job 2 was
deliberately NOT DONE.** Ten of seventeen chapters are over 130k (not five). But:
- **rAF is pinned to the display**, so all seventeen read mean 16.67 ms and p95 16.8. A
  frame-time reading cannot distinguish 5% headroom from 90%. Useless as evidence.
- Rendering each chapter 40× back to back with `gl.finish()` — the only way past vsync —
  puts **the worst chapter at 1.6-1.9 ms of a 16.67 ms frame**, stable over three runs.
- **The count does not predict the cost.** Manly is the second SMALLEST chapter and the
  most expensive per triangle (1.95 ms/100k); Iceland and Quay are the second and third
  LARGEST and the two cheapest (0.43, 0.45). What predicts it is the SHADOW PASS and the
  draw-call count.
Reshaping ten chapters would have risked the thing this project guards hardest for a
fraction of a millisecond, against a metric demonstrably not doing the work. `qa/budget.js`
runs both gates (triangle one kept and reported as asked; the FAILING one is ms) and
`qa/BATCH4.md` names the structural offender in each chapter as a work list.

**THE REAL PERF LEVER WAS A ONE-LINE RULE.** `registerShadowTarget` ran an unconditional
`castShadow = true` over every mesh as the LAST line of every build, so every
`castShadow = false` in every chapter file was undone four lines later. `sysEnableShadows`
now skips `userData.noShadow` and any ghost material (transparent / no depth-write /
additive). **~145,000 triangles out of the shadow pass**, and it is a PICTURE fix too —
the Pantanal's transparent flood sheet was laying a hard shadow on the whole chapter.

**THE PATTERN ACROSS ALL SIX CHAPTERS, and it is batch 3's list again at scale:**
- **framed**: zero of 12-17 called `frameShot`. And it was UNREACHABLE for the two whose
  marquee is on a vehicle (helm/condor weight it to nothing) — added `over: true`. And it
  clamped `dist` to `sysCAM_MAX`, **which is the player's ZOOM limit**, so Antarctica's
  authored 26 m plate silently got 16.
- **audible**: 24 / 48 / 47 / 35 / 29 mono calls per chapter. Every one of those files
  ALREADY computes the source (x,z) to scale volume and throws it away. `placeCue` in
  shared.js. **It must COPY, not mutate** — these files fire everything through one shared
  options object, so writing `at` into it would make the next forty mono cues inherit a
  position, silently.
- **acknowledged**: the 40 m wow radius found NOBODY at three marquees (Antarctica 212 m).
  Four Antarctic locals had `onTask: 'orca-ride'` pools that were unreachable code. Now
  the line is HELD and delivered by the first person you come back to.
- **one-shot**: Antarctica fired 208 times and stacked 29 personal-best cards through its
  own marquee; Manly's ceremony ran on every qualifying ride. Same as Kyoto in batch 3.
- **surface ladder**: 3-4 rows covering a fraction of the map, every time.

**FOUR THINGS THAT MEASURED WRONG BEFORE THEY MEASURED RIGHT**
1. **Göreme's marquee bearing.** The obvious −π/2 put the sun at NDC (−0.13, 0.03) — dead
   centre, and therefore BEHIND THE PLAYER'S OWN BASKET. Project the subject into the
   frame and read the NDC; do not reason about it.
2. **Palawan's bloom.** Adding light to a bleached noon whitened white sand: blue rose
   LEAST. A light source is legible because THE DAY GOES AWAY — subtract first.
3. **The keepsake home.** `sp.y` is a DROP height (hovered 3.34 m); `terrainHeight` is the
   ground UNDER a deck (buried 1.23 m). **Only the solver knows what is under a point** —
   drop the prop and let it LEARN its home from where it rests.
4. **The photo lift.** Sub 62% and the cave went dark; the balance that worked was ~42%
   subtract with a bigger cyan add. Judge from the PNG mean per channel, not from the code.

**AND THE GRAZE WAS DELETING PROPS IN SIXTEEN OF SEVENTEEN CHAPTERS** — the restock drain
was inside `physPastoUpdate`. A clock is not a place. It could blank `seagull-chips`.

**HARNESS**
- **`playwright-cli close-all` closes EVERY session on the machine**, not just yours. Two
  concurrent agents killed my browser mid-run twice. Tell subagents not to run it.
- `qa/kine.js` is too noisy for a differential — 760 to 938 teleport events across
  identical builds.
- `qa/stillness.js` printed `slopeAt 0` both when the ground was flat AND when the chapter
  publishes no `slopeAt` at all (pasto's `biome.api()` returns no keys). Same
  false-equivalence as batch 3's `pf-mischief.js`.
- Patch scripts: **detect the file's newline** — `systems.js`, `palawan.js` and others are
  CRLF while most biome files are LF, and a heredoc patch silently misses. Write the patch
  to a `.mjs` in the scratchpad and run it; do not use bash heredocs (backticks in a
  comment will break the shell).
- The album is `{v, shots:[...]}`, not a bare array.
- `systems.js` latches `keys[c]` on keydown and clears on keyup — a probe that dispatches
  keydown alone gets ONE press per key for the whole session.

Related: [[capy3-payoff-batch-three]], [[capy3-payoff-batch-two]], [[capy3-payoff-batch-one]],
[[headless-qa-harness]], [[capy3-external-forces-on-the-capybara]], [[capy3-the-picture]]

---

**ADDED BY A SECOND BATCH-4 RUN (see [[capy3-two-runs-one-tree]]).** The task fired twice;
the second session picked the job-2 reallocation up rather than leaving it, and reached the
same cost conclusion above from its own measurements before finding this file.

**DETAIL IS A FUNCTION OF WHERE THE PLAYER CAN STAND, and three chapters were paying
near-field prices for their far field.** −79k triangles, no content removed, CONTRACT §v28:

- `driAddIsle(..., det)` — every island in the Drift got the same torn lip, spike fringe
  and three ribs whether it was the six-metre pebble under your feet or a far-field island
  400 m out. `det` scales the COUNTS and never the shape. `dri:under` 50,524 → 34,268;
  chapter 206,474 → 185,166.
- `quayHeadRouteDist()` — all thirteen Quay headlands got the same tree, and none of them
  is walkable. Past 60 m from the fairway a plant loses the fork inside its own crown, the
  second crown on top of the first, the sandstone at its foot and the grass tree beside it.
  **The plant count is untouched** — the canopy LINE is the read, the trunk is not.
  201,851 → 157,975, the biggest single saving in the game.
- the Pantanal's grass follows the causeway and thins going out. 224,488 → 210,776.

**THE AUDIT NEEDED A THIRD GATE TO BE USEFUL.** `qa/budget.js` reports the brief's 130k
line (ten chapters still over, on purpose), FAILS on a 5.5 ms cost gate (nothing within a
factor of three), and FAILS on a RATCHET — a recorded per-chapter ceiling. The ratchet is
the one that will catch something: quay went 132,423 → 202,391 in two days and nobody saw
it. Its 6,000 of slack is not generosity — the scatter helpers call unseeded `rand()`, so a
chapter re-measures within ±1,500 run to run, and `qa/audit-solid.js` has a ±9-hit noise
floor for the same reason. **A differential across a scatter change must be read against
the untouched chapters' drift, not against zero.**

**EVERY CHAPTER'S GROUND SHEET CASTS A SHADOW — found, measured, NOT taken.** The single
biggest shadow caster in venice, cave, kowloon, kyoto, cali, manly, rio, sahara, iceland,
goreme and palawan is that chapter's own terrain plane, receiving and casting. Antarctica
and the Pantanal already exclude theirs. It is the last lever with a real millisecond
behind it (kyoto's shadow pass is 0.88 ms, the largest in the game) and it is eleven
picture decisions, not one rule: a terrain with 91 m of relief casts shadows you can see.
`qa/b4-cast.js` is the probe.
