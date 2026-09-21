---
name: headless-qa-harness
description: "How to actually test the capybara game when the Browser pane can't composite (unattended runs)"
metadata: 
  node_type: memory
  type: project
  originSessionId: c5e14a7a-bd1b-497a-acea-9e52b9b3f12e
  modified: 2026-09-11T15:59:43.448Z
---

The capy3 game exposes `game.tick(dt, render)` on `window.__capy` precisely so it can be
advanced by hand when `requestAnimationFrame` is throttled. In an unattended session the
Browser pane is not displayed, so `computer{action:"screenshot"}` fails and rAF never runs —
but everything still works if you drive it yourself:

1. `node server.mjs` from Bash with `PORT=5188` (5173 is often taken by another project), then
   `preview_start {url: "http://localhost:5188/"}`. `preview_start {name: ...}` is blocked in
   unattended runs; the `{url}` form is not.
2. In `javascript_tool`, dispatch real `KeyboardEvent`s on `window` and call
   `game.tick(1/60, false)` in a loop. That is a full deterministic playtest — physics, tasks,
   camera, everything — at hundreds of times real speed.
3. For pictures: `game.renderer.setSize(1280,760,false)`, `game.tick(1/60, true)`, then
   `canvas.toDataURL('image/png')` POSTed to `/shot?name=X` — server.mjs has a QA sink that
   writes it to `qa/X.png`, which the Read tool can then look at.

Steering the capybara from a script needs a closed loop, not held keys: movement is
camera-relative and `input.camYaw` drifts, so recompute the WASD set every few frames from
`game.input.camYaw` and the vector to the target.

USE PLAYWRIGHT FOR ANYTHING TIMING-, AUDIO- OR rAF-DEPENDENT. The hand-driven
tick loop above never unlocks the AudioContext and never runs a real frame, so a whole
class of bug is invisible to it — the 2026-08-18 sfxGull crash sat in the ambience path
and could only be reproduced under `playwright-cli`, which delivers trusted key events
(so audio unlocks) and runs rAF at real speed:

  playwright-cli -s=capy open http://localhost:PORT/
  playwright-cli run-code --filename=script.js     # async page => { ... }, real keyboard, real clock

run-code prints NEITHER console.log nor the function's return value — the only reliable
way to get data out is the same /shot sink: POST `btoa(unescape(encodeURIComponent(
JSON.stringify(out))))` to `/shot?name=result.json` and Read qa/result.json.png (the sink
base64-decodes whatever it gets; the forced .png suffix is cosmetic). The script file must
be a bare `async page => { ... }` — leading comments or a trailing semicolon are a
SyntaxError.

Hook `console.error` inside the page before starting, then soak ~90 s per world and read
back `game.state.lastError`. `playwright-cli close-all` when done.

**FOUR HARNESS TRAPS, ALL OF WHICH LOOK LIKE GAME BUGS (measured 20 Aug 2026):**

1. **Anything hooked onto `window` from inside `run-code` can vanish between the tool's
   invocations.** A long script that sets `window.__qaErrs` in one `page.evaluate` and reads
   it in a later one will sometimes find it undefined, and `game.state.time` and
   `performance.now()` come back RESET — `performance.getEntriesByType('navigation')[0].type`
   says `"reload"`. It is not the game: nothing in src calls `location.reload()` outside the
   end card, and after one of these the game reports `started === true` with no gesture, which
   the real game cannot do. Chasing it cost an hour. **Use playwright's own console capture
   (`playwright-cli console`) and `game.state.lastError` instead of an in-page hook**, and
   treat `state.time` going backwards as the tell.
2. **A single `page.evaluate` longer than ~20–30 s dies with "Execution context was
   destroyed".** Split long soaks into one evaluate per biome, or install a `setInterval`
   sampler and drain it with short `page.evaluate(() => new Promise(r => setTimeout(r, 5000)))`
   waits. A 20 s in-page sample is stable and never sees a reset.
3. **The first `run-code` after a `goto` frequently fails.** Sleep 6–8 s after `goto`, and if
   it errors anyway, just run the same command again — the second one works.
4. **`sessionStorage`/`localStorage` counters survive `goto` within the same tab**, so a
   reload detector reusing a key from an earlier experiment reads as a false positive. Use a
   fresh key per experiment.

**TWO MORE, MEASURED 21 AUG 2026:**

5. **`playwright-cli navigate` to the URL that is already loaded DOES NOT RELOAD**, and the
   modules stay cached, so a source edit appears to have had no effect. Cost an hour of
   re-auditing a fix that was already correct. `close-all` then `open` is the only reliable
   reload; a cache-busting query string did not help either. The tell is a count that should
   have changed and did not (world.bodies.length after adding colliders).
6. **`run-code` operates on whatever the page currently IS**, not on a fresh one — a script
   that assumes the title card is up will silently measure the previous script's biome.
   Start every run-code with `await page.reload()` and a 4.5 s wait.
7. `page.evaluate` takes exactly ONE argument. Wrap extras in an object or it throws
   "Too many arguments".

8. **THE GAME SAVES TO `localStorage["capy3.journey.v1"]`, so completed tasks survive
   `page.reload()`.** Every task assertion in every earlier QA run in a session reads back as
   `true` for ever after. The tell is a task reporting done on tick 0 with the animal fifty
   metres from the thing. Start any run that asserts on task state with
   `await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} })` BEFORE the
   reload. Cost four invalidated runs on 24 Aug 2026 — see [[capy3-fifth-pass-ten-eleven-twelve]].

10. **`page.addInitScript(() => localStorage.clear())` FIRES ON EVERY NAVIGATION, not just the
   first.** It is the documented way to start a task-assertion run clean (trap 8), and it is
   exactly wrong for any test that must WRITE a save and then reload to check it survived — the
   harness wipes the file at every reload and the game gets blamed. On 24 Aug 2026 it produced a
   confident "save is 0 bytes at the title" against a save system that was working. For a
   write-then-reload test, clear ONCE with `page.evaluate(() => localStorage.clear())` followed by
   one reload, and never install an init script.

11. **Do not identify a scene object by `InstancedMesh.count`.** The four particle pools are dust
   30, foam 8, puff 24, shards 8 — and several biome-owned meshes also have a count of 8, so a
   `count === 8` match walks past the real foam pool, lands on a hidden Sydney mesh and reports
   `visible: false` in fifteen chapters: a pool-detach bug that does not exist. Identify by
   GEOMETRY TYPE (dust `TetrahedronGeometry`, foam `CylinderGeometry`, puff `SphereGeometry`), and
   note the pools are direct children of `scene` because they are added through
   `physSceneAddLoose`.

12. **`canvas.toDataURL()` needs the render and the read in ONE JS turn**, and even then a manual
   `renderer.setSize()` + single `tick(dt, true)` gives a stretched projection and a camera caught
   mid-transition — it looks like a camera bug and is not one. For a picture of what the player
   actually sees, let rAF run and use `playwright-cli screenshot`; keep `toDataURL` for cases where
   the Browser pane genuinely cannot composite.

9. **Prove a fix with a differential, not with a single green run.** `git stash push -- src/x.js`,
   `node build.mjs`, re-open, run the SAME clean script, `git stash pop`. It is the only thing
   that distinguishes "my fix works" from "this was never broken", and on 24 Aug it showed one
   of four claimed fixes was much smaller than assumed.

Also: `playwright-cli eval` wraps its argument as `() => (expr)`, so a multi-statement string
is a SyntaxError — wrap it as `(()=>{ ...; return x; })()`.

**TWO MORE, MEASURED 26 AUG 2026:**

13. **A HEREDOC IN THE BASH TOOL EATS ONE BACKSLASH OF EACH PAIR**, even quoted (`<<'EOF'`).
   This is the same thing that cost a day on `qa/verbs.mjs` in v24 and it is not specific to
   that file: a node script written through a heredoc turns `"\\b"` into `\b` (a literal
   BACKSPACE, 0x08) and `'\\n'` into a real newline, so a regex silently stops matching and a
   string search silently starts. It happened again writing `qa/route.js`. **Use the Write or
   Edit tools for anything containing a backslash escape** — they do not go through a shell.
   `cat -A` is the way to see it: `\b` prints as `^H`.

14. **`run-code` has no `process`, no `require` and no `import`, and takes no argument.** A
   script that wants a before/after tag has to carry it as a literal and be rewritten between
   runs, and anything it needs from disk has to be `fetch`ed from the dev server instead —
   `index.html` serves `src/*.js` unbundled, which is how a probe can derive the chapter list
   from `CHAPTERS` in `shared.js` without a build step.

**TWO MORE, MEASURED 27 AUG 2026:**

15. **A PICKER KEY IS A ONE-BASED INDEX AND THE MAPPING IS EASY TO GET WRONG.** The nineteen
   chapters are `Digit1..Digit9, Digit0, Minus, Equal, BracketLeft, BracketRight, Semicolon,
   Quote, Comma, Period, Slash` — so chapter 12 (Palawan) is `Equal` and `BracketLeft` is
   chapter 13 (Cappadocia). A probe that pressed BracketLeft "for Palawan" spent ten seconds
   holding the dive key on a Turkish hillside and reported a clean zero, and a soak filed
   Cappadocia's numbers under Palawan's name. **Assert `g.biome.current` in every row of the
   result** — both scripts did, and that is the only reason it was caught.

16. **A SOAK THAT COUNTS SHOULD ALSO NAME.** Wrapping the channel under test
   (`const raw = g.recordLive; g.recordLive = function (id, v) { last = id; return raw.call(g, id, v); }`)
   and tagging every sample with the last id makes a hit ATTRIBUTABLE instead of a number.
   That is what turned "the Pantanal shows something for 60 s" into "the cowbird does", in one
   run. Cheap, and it does not change what is being measured.

**TWO MORE, MEASURED 27 AUG 2026 (batch 7):**

17. **`btoa` DOES NOT EXIST IN `run-code`'s OWN SCOPE.** The `/shot` idiom
   `btoa(unescape(encodeURIComponent(...)))` only works INSIDE `page.evaluate` — written at the
   top level of the script it is `ReferenceError: btoa is not defined` and the whole run is lost
   after it has already done the work. Pass the object into the evaluate and encode in the page.

18. **A SOAK THAT MEASURES A DECAYING QUANTITY MUST BE FASTER THAN THE DECAY.** The escalation
   probe held eight radii for two seconds each and walked between them, so ONE approach took
   forty-odd seconds against a ninety-second decay — and reported the accumulator pinned at its
   single-incident value for all three approaches in four chapters. It was destroying what it
   existed to measure, and it looked exactly like a feature that does not accumulate. Five radii
   at 1.2 s fixed it. Same family as the teleport: **a probe is part of the experiment.**

**TWO MORE, MEASURED 29 AUG 2026:**

19. **`page.addInitScript` PERSISTS FOR THE WHOLE BROWSER CONTEXT**, not for the run-code
   invocation that installed it. Trap 10 above says it fires on every navigation; what it does
   not say is that it goes on firing in EVERY LATER SCRIPT of the same `-s=` session. A probe
   that carefully avoids installing one, clears storage with `page.evaluate` and then reloads
   to check something survived still gets wiped — by a script that ran twenty minutes earlier
   — and reports a store that "does not survive a reload" against a store that does.
   `close-all` then `open` is the only way to be sure of a clean context.

20. **A BACKTICK INSIDE A COMMENT INSIDE A TEMPLATE LITERAL ENDS THE TEMPLATE.** Probes build
   their in-page code as a template literal, and a comment inside it that quotes an identifier
   in backticks is a SyntaxError in the evaluated string. The run dies before the /shot post,
   THE OLD RESULT FILE IS STILL ON DISK, and it reads as a fresh failure of the feature under
   test. **Check the output file's mtime before believing a bad result** —
   `ls --time-style=+%H:%M:%S` next to `date` is two seconds and it saved an hour. (Trap 13's
   heredoc problem has the same shape and bit again in the same session, writing this note.)

The audits worth re-running (all in qa/): `fuzz.js` (random-input soak per biome — NaN, void
falls, solver saves), `npchealth.js` (states visited + distance travelled per NPC, the detector
in [[capy3-catch-all-state]]), `props.js` (props under the terrain or asleep in mid-air),
`pointers.js` (every task the card cannot point at), `audio2.js` (real keys, real clock, score
and ambience running), `kine.js` (kinematic bodies moving with zero velocity).

...and three of them do not hold a line at all: see
[[capy3-instruments-that-cannot-hold-a-line]] for how far `audit-solid.js`, `stillness.js` and
`budget.js` move with nothing changed between runs.

**ONE MORE, MEASURED 7 SEP 2026, AND IT PUT A FALSE ENTRY IN THE CONTRACT:**

35. **FORCING A STOCHASTIC SYSTEM ON IS ONLY HALF OF IT — THE FORCING PARAMETERS
   ARE PART OF THE EXPERIMENT.** Trap 18 says a probe must be faster than the
   decay it measures; this is the same law from the other end. The weather probe
   correctly forced `odds: 1` to beat the 56–130 s shower dice, and passed
   `hold: 90` to make sure the shower was still running when it looked — but
   `wxEnvelope`'s rise is **0.22 of the WHOLE hold**, so a ninety-second shower has
   a twenty-second attack, and the probe sampled four seconds in and read 0.000.
   It went into CONTRACT.md as "A5's rain terms are wired and have never been
   observed above zero" against a rain path that was entirely fine. `hold: 14` and
   a sampler instead of a glance resolved every term to three or four decimals.
   **The tell was that the term read EXACTLY 0.000 rather than something small**:
   a dead wire and a slow attack both look like nothing, and only one of them is
   ever exactly nothing.

**ONE MORE, MEASURED 7 SEP 2026 (B9), AND IT COST FIVE RUNS OF ONE PROBE:**

40. **A TELEPORT IS MOTION, AND THE ANIMAL DOES NOT STAY WHERE YOU PUT IT.**
   Any mechanic gated on the animal being STATIONARY cannot be tested by
   writing `capy.body.position` and pressing the key on the next frame: a 0.4 m
   correction in one frame reads as tens of metres per second for several
   frames afterwards, so the gate refuses and the mechanic reads as dead. And
   settling first does not fix it — over two seconds the animal slid a metre
   down a Hanoi road (1.84 m from a target with a 1.2 m reach), drifted out of
   reach on a Venetian quay between two samples, and TWICE had the prop taken
   out of its mouth by the chapter-neutral ownership walk, because a prop
   spawned beside a local belongs to that local. **Pin the body on a
   `setInterval` for the length of the test, and re-assert every precondition
   (still held? still in reach?) on the frame before the key goes down.** The
   tell is a feature that works in one chapter and not the next two, with a
   different chapter failing on each run.

Related: [[capy3-progression-chain]], [[capy3-module-drop-failure]], [[capy3-catch-all-state]],
[[capy3-the-paper]], [[capy3-lens-and-wall]]

**TWO MORE, MEASURED 29 AUG 2026 (evening):**

21. **`playwright-cli close-all` IS GLOBAL, NOT PER `-s=` SESSION.** Opening a second session
   (`-s=capy2`) to take screenshots while a ten-minute sweep runs in `-s=capy` is fine; calling
   `close-all` in the second one kills the first with "Target page, context or browser has been
   closed", ten minutes in, with nothing written. Use `close` (which is per-session) or just
   open a fresh URL.

22. **`playwright-cli ... &` INSIDE A BASH TOOL CALL DIES WHEN THE CALL RETURNS.** The tool
   reaps the process group, so the `&` form silently produces no output file and the page is
   left sitting on the title card — which reads exactly like a probe that crashed. Use the Bash
   tool's own `run_in_background: true`.

23. **`game.hintTarget(id)` NOW EXISTS** (systems.js, next to `game.taskDone`). `sysHINTS` and
   its dozen `hint*` helpers are closure-local, so an audit that wants a task's pointer target
   used to have to re-implement `hintObj`/`hintProp`/`hintNpc`/`hintZone`/`hintXZ`/... and got
   `ReferenceError` for its trouble. One getter, no setter, null for anything that throws.

24. **A DROP TEST FINDS FLOORS; ONLY A WALK FINDS ROUTES.** Dropping the animal on a grid and
   recording where it settles is the cheapest way to get the TRUE standable surface of a
   structure (it found the Monte Carlo sun deck buried inside its own deckhouse in thirty
   seconds, where reading collider extents took an hour). It is useless on a staircase — from
   14 m the animal bounces off a 0.72 m tread and the column is noise. For a route, walk it as
   a list of legs with a closed-loop steer and report per leg.

**THREE MORE, MEASURED 3 SEP 2026 (D7):**

25. **THE BROWSER CACHES ES MODULES ACROSS `page.goto` INSIDE ONE `run-code`
   SESSION.** The dev server sends `Cache-Control: no-store` and `curl` proves
   the edit is being served, and the page still runs the old module. A 19-chapter
   sweep came back identical to FOUR DECIMAL PLACES after a change that must have
   tripled one of its columns. This is trap 5's family and the fix is the same:
   `close` then `open` before any measurement run that follows a source edit.
   The tell is a column that cannot possibly be unchanged being unchanged.

26. **`input.camYaw` IS THE BEARING FROM THE ANIMAL TO THE CAMERA** — the same
   convention `game.frameShot` takes — so W walks the animal along MINUS
   `(sin camYaw, cos camYaw)`. Written the intuitive way round a walk probe
   sprints in exactly the wrong direction and reports the mechanic under test as
   dead (measured: 3.4 m -> 13.1 m in five seconds). And a four-key closed loop
   OSCILLATES: the reliable way to walk an animal at a thing is to let everything
   settle, THEN read camYaw, THEN teleport onto that line, THEN hold W within a
   quarter of a second — camYaw is damped and drifts while you wait.

27. **`canvas.toDataURL()` COMES BACK BLANK WHITE** (no `preserveDrawingBuffer`):
   six chapters wrote six byte-identical 21 956-byte PNGs of nothing, and a
   file-size `ls` is what caught it. This is trap 12 restated as a hard rule:
   inside `run-code`, always `page.screenshot({ path })`.

**SIX MORE, MEASURED 5–6 SEP 2026 (the finish review — see [[capy3-the-finish-review]]):**

28. **`renderer.info.memory.geometries` COUNTS FIRST RENDERS, NOT CREATIONS.** It rose
   498 on a lap in which nothing was made. Hook `BufferGeometry.prototype.
   computeBoundingSphere` and attribute by `src/` stack line, with the camera still,
   before calling a rise a leak.
29. **`create*` LIVES ON `BaseAudioContext.prototype`.** Patching `AudioContext.prototype`
   counts zero nodes and reads as "no audio ever played".
30. **A TRAVERSE COUNTING `mesh.visible` CANNOT SEE A DETACH.** Roots are hidden, children
   keep `visible = true`; the column climbs to 3 800 and means nothing.
31. **THE ARRIVAL LENS DEPENDS ON THE CHAPTER YOU CAME FROM** (`camDist` is not reset on
   travel). An arrival audit that always arrives from Sydney passes a frame that fails
   from Cappadocia. Arrive from a far-zoomed chapter as well, and use `hud.cross(biome)`
   — `switchTo` + `spawnOf` is a teleport and sees none of the arrival defects.
32. **`.capyui-todo .capyui-txt` RETURNS CHAPTER 1'S ROWS IN EVERY CHAPTER.** The paper
   keeps hidden rows; measure rendered rects.
33. **FRAME TIME UNDER HEADLESS MOVES 3 ms WITH NOTHING CHANGED** between two random-walk
   laps. Only a same-session, standing, fresh-vs-after A/B is evidence.

**ONE MORE, MEASURED 6 SEP 2026, AND IT IS THE MOST DANGEROUS ON THIS LIST:**

34. **A BACKTICK INSIDE A SINGLE-QUOTED `node -e` STRING IS STILL A SHELL
   COMMAND SUBSTITUTION.** The Bash tool's argument is parsed by the shell
   before node ever sees it, and single quotes do not protect backticks the way
   they protect `$`. Writing prose that quotes an identifier in backticks
   (```run once on a `git stash`ed baseline```) inside a `node -e '...'` splice
   script RAN `git stash`, silently, mid-task: four tasks' worth of uncommitted
   work left the working tree, `git status` came back clean, and the next probe
   reported the feature under test as absent ("shin has no color attribute").
   It reads exactly like a build that did not take. **The tells are a clean
   `git status` you did not expect and the stash message appearing inside the
   text you were writing.** Recovery is `git stash pop`; verify with `diff -q`
   against a snapshot before trusting it. Same family as trap 13 and trap 20:
   **never put a backtick in a Bash-tool argument. Use the Write or Edit tool,
   or a `.cjs` file written with Write and then run.**

**THREE MORE, MEASURED 7 SEP 2026 (B1 of ROADMAP-FUN):**

36. **`biome.switchTo(name)` DOES NOT MOVE THE ANIMAL.** It swaps the world;
   `biomeGo` is what teleports, and `hud.cross(biome)` is the only honest
   arrival. A nineteen-chapter probe built on `switchTo` read the spawn as
   Sydney's grass in all nineteen — Hanoi reported (5.6, 1.5, 25.1) against a
   `HANOI_SPAWN` of (-60, 2.4, -78) — and every distance in the table was
   measured from the wrong place. The tell is nineteen spawns that are all
   suspiciously the same point.

37. **A RAYCAST THAT READS `o.visible` CANNOT SEE A DETACHED BIOME EITHER.**
   Trap 30 says a traverse counting `mesh.visible` cannot see a detach; the same
   is true of occlusion. A detached chapter's ROOT is hidden and every child
   keeps `visible === true`, so an unoccluded-line-of-sight test named
   `pastoChurch` as the occluder in Palawan, Cappadocia and Antarctica, and
   `palBackRooms` in Monaco. Walk the parents:
   `for (let p = o; p; p = p.parent) if (!p.visible) return false`.

38. **A PROBE THAT SAMPLES A STATE AT ONE END OF A WINDOW MUST SAMPLE IT AT
   BOTH.** A UI element present at t = 3 s and absent in the t = 90 s screenshot
   reads exactly like the feature decaying, and a quarter of an hour went into
   that hypothesis before another chapter's screenshot in the same run showed it
   intact — it was correct behaviour (the thing it names had been ticked). One
   end-of-window sample of the same flag, plus the time the event it depends on
   fired, makes the two readings impossible to confuse. **Your own screenshot
   becomes evidence for whichever story you thought of first.**

**ONE MORE, AND IT IS ABOUT WHAT AN AUDIT FLAG IS ALLOWED TO SAY:**

39. **A FLAG THAT REPORTS A TABLE IS NOT A WAY OUT FOR A FEATURE THAT IS
   INVISIBLE BY DESIGN.** `musAudit().second` answered `!!sysMUS_2ND[musPalN]` —
   "this palette has a second-voice row" — and stayed true for the whole time
   the voice was throwing before it could schedule anything. The feature shipped
   as measured. Only a COUNT OF THINGS ACTUALLY DONE (`secondN`) answers the
   question. Same family as [[capy3-names-nothing-publishes]].

**TWO MORE, 10 SEP 2026 (the depth Tier 4 pass):**

40. **`page.mouse.click(400, 400)` DOES NOT RELIABLY START THE GAME, and every
   keyboard test silently passes when it has not.** `game.biome.switchTo()` and
   direct body writes work perfectly with `state.started === false`, so a probe
   can enter a chapter, park the animal, screenshot it and measure geometry —
   and then every `page.keyboard.press` is dropped, because the keydown handler
   is gated on `started`. Two hours of "the wheek does not reach the herd" was
   this. **THE GESTURE THAT WORKS IS `document.querySelector('.capyui-go').click()`** — the Begin button, which routes through the same startResume() door as Enter and the backdrop. `page.mouse.click(400,400)` hits the backdrop only sometimes. Assert `state.started` before any key test, and prove the branch
   separately by poking `input.honkPressed = true` in an evaluate**: that one
   line separates "the key did not arrive" from "the code is wrong", and in this
   case the poke moved the number from 6.51 to 0 while the real key did nothing.

41. **A PARKED CAPYBARA CANNOT TEST ANYTHING THAT DEPENDS ON INFORMATION GOING
   STALE.** Marrakech's trader-to-trader shout measured ZERO hand-offs from a
   held position, and the zero was correct: parked, every pursuer who has ever
   seen the animal holds the *same* belief, so a shout is never news. The term
   was fine; the experiment had no chase in it. Anything gated on "is this
   news / has this changed / is this stale" needs the subject MOVING — drive a
   lap. Related to trap 38: the first plausible story was "the term is dead".

42. **SUB-AGENTS RUN `playwright-cli close-all`, AND IT IS GLOBAL.** Two probes died
   mid-run with "Target page, context or browser has been closed" while a
   background agent finished its own task. Re-open the session and re-run; or tell
   agents not to close-all. Also `git add -A src` while agents edit sweeps their
   half-done files into your commit — stage by file while any agent is live.

43. **BASH HEREDOCS EAT BACKSLASHES HERE, EVEN WITH A QUOTED DELIMITER.** A regex
   written `/\s*done/` in a `<<'EOF'` heredoc landed in the file as `/s*done/`.
   Any patch script with a backslash or a newline escape goes through the Write tool.

**TWO MORE, 12–13 SEP 2026 (the fourth lift):**

44. **TRAP 25 IS NOT A RULE.** A probe run in a session opened BEFORE a source
   edit, with a plain `page.goto` per chapter, served the EDITED modules — the
   E3 "before" measured the after (its gaps were exactly the budget's own 6.0 s
   constant). Whether the ES-module cache holds across a goto depends on things
   the harness cannot see. A before/after is a `git stash push -- <files>` on
   each side, with close-all/open between; nothing less is a differential.

45. **`page.mouse.click(640, 400)` WAS THE START GESTURE OF MORE THAN ONE
   PROBE.** qa/b5-cam.js (the horizon instrument) had it as well as the fuzz;
   every keyboard band read as a gap and the idle band was the title's drift
   rig, and it went into a review as "the horizon is off the top in 19/19". Use
   the Begin button and assert `state.started` in every row.

**THREE MORE, 18 SEP 2026 (the L8 balance pass):**

46. **A SECOND PLAYWRIGHT SESSION DURING `npm run soak` CONTAMINATES THE SOAK.** A
   three-minute smoke of a bot in `-s=l8b` while the soak's fuzz ran in `-s=soak`
   stole the fuzz tab's focus at Hanoi: maxSpeed 0 in every chapter from there on
   (the F4-fixup's stuck-paused artefact), the file:// boot probe timed out at 30 s
   under the CPU contention, and the load probe's longest frames read 14 s. The
   row looked like a build that broke everything. Run the soak ALONE; drop a row
   from qa/soak-history.jsonl if you did not.

47. **A DISPATCHED PRESS HAS TO BE A HOLD.** The grab's wind-up reads `input.action`
   across frames (capybara.js's own latch-at-source comment); a keydown+keyup in
   one JS turn from a bot is cancelled on the next tick, and a bot stood 1 m from a
   yuzu pressing E for thirty minutes and took nothing. Hold ~0.35 s of sim time
   (qa/l8-balance.js's `tap(code, dur)`). And a held MOVEMENT key has to be re-sent
   each step — the game clears `keys[]` on its own cards, and a bot that only sent
   the edge once stood still for the rest of the half hour (23 "stuck" events).

48. **AN IN-PAGE `setInterval` TICK LOOP RUNS AT ~1x**, whatever it is asked for:
   the game's own rAF tick+render eats half the CPU and the timer is throttled.
   Drive `game.tick(1/60)` from one-second `page.evaluate` chunks and, for the
   duration, patch `game.tick` to return early on `render === true` (mainLoop
   reads it off the object) — ~3x real time at ~7 ms a tick on this machine.

49. **TRAP 46 WAS HALF RIGHT. THE FUZZ OPENS THE BAG AND NEVER CLOSES IT.** The
   soak's "maxSpeed 0 from chapter N to the end, animal parked at the previous
   chapter's end point, `paused` true, every card at opacity 0" is F2's bag
   (L8): the fuzz's eight keys include E, the traveller stands at the way mark
   in all nineteen chapters now, a short E on him opens a card that pauses the
   world and swallows every key but Escape, and qa/fuzz.js had no Escape. It
   reproduced ALONE three times; the F4 fixup's `visibilitychange` story and my
   own "focus steal" story were the same symptom misread. Fixed in the fuzz: if
   `g.state.paused && !document.hidden`, press Escape. Any key-spamming probe in
   a chapter with a traveller needs the same line. A second session during a
   soak is still a bad idea (the file:// boot timed out under it), but it was
   not the freeze.

50. **A `localStorage.clear()` BEFORE `page.goto` IS UNDONE BY THE GAME'S OWN
   DEBOUNCED SAVE ON THE WAY OUT.** The second chapter of a multi-chapter probe
   booted onto a carry-on card of the first chapter's half-finished file and
   its Begin did nothing for thirty seconds ("the door did not open"), while
   the same door worked twice in a row from a cold page. Clear, goto, clear
   AGAIN, goto — the second reload sees no file.

51. **A BOT THAT PRESSES E ON EVERY ROW TAKES THE HELM IN QUAY** and quay.js owns
   the body from then on — a half hour read as "ground income 4, 62 stuck
   events" and was a ferry being steered at fruit. `capy.atHelm` is the tell;
   "E to step away" is the chapter's own line.

**FOUR MORE, MEASURED 19-20 SEP 2026 (ROADMAP-WOW, six to eight agents in parallel):**

52. **ONE TOOL CALL PAST ~600 s KILLS THE AGENT THAT MADE IT** ("Agent stalled: no
   progress for 600s"). A nineteen-chapter playwright sweep in one `run-code` is
   exactly that under load; four agents died at once, twice. Rule: one chapter
   per `run-code` invocation, under ~4 minutes, and commit after each verified
   increment so a stall loses nothing. Uncommitted edits survive on disk; the
   agent resumes by SendMessage with its work intact.
53. **`playwright-cli close-all` CLOSES EVERY AGENT'S BROWSER.** One agent's
   "clean up when done" killed another's run mid-evaluate ("Target page,
   context or browser has been closed"). Parallel agents close only their own
   `-s=<session>`.
54. **THE DEV SERVER SERVES src/ UNBUNDLED, SO ONE AGENT'S BROKEN EDIT BREAKS
   EVERY AGENT'S PROBES.** A `const` read above its own declaration inside
   grain() (`wetOnly`, the TDZ the file's own comment warns about) took every
   module load down for an hour of everyone's runs; the tell was probes
   reading "0 instances / nothing drawn" in unrelated chapters. Check the
   console's first lines before trusting a zero.
55. **THE GIT INDEX IS SHARED.** An agent's `git add <file>` can be swept into
   another agent's `git commit` seconds later; attribution muddles, code still
   lands. `git status` before every commit, and stage only right before it.
   Also: the resting lens is NOT deterministic between arrivals (three agents
   measured 0.3 rad), so before/after depth bins need a pinned pose.
