# W6 — the closeout: extra anchors

You are the LAST agent of ROADMAP-WOW2. Every one of V1-V6, N1-N4 and T is built,
committed and green on `lift-pass` (24 commits since `00f3b72`, ending at
`bf56992`). Your job is not to build a visual term — it is to MEASURE the whole
pass together, honestly, and write it up in the two places this project always
writes a closed pass up: CONTRACT.md (a new top entry, "THE TWELFTH LIFT") and
ROADMAP-WOW2.md (a "## Closed" section, the same shape ROADMAP-WOW.md's own
Closed section has — read that section in full as your template:
`grep -n "^## Closed" ROADMAP-WOW.md` then read to the file's end).

## Files you touch
CONTRACT.md (prepend a new entry above the current top line, "## THE ELEVENTH
LIFT..." — newest entries go at the very top of the file), ROADMAP-WOW2.md
(append a "## Closed (21 Sep 2026) — the six numbers, as measured" section at
the very end of the file, after "## Held (named, not built)"), qa/ (new
closeout instruments only — do not edit any wave's existing qa/*.js). Do not
touch src/ at all unless you find and fix a genuine regression one of the six
waves left behind (see "If you find a real bug" below) — your job is measurement
and writeup, not new features.

## The six numbers you are closing out (roadmap's own "What another notch
## means here, measured" section — read it again before you start)
1. **Motion at rest** — animal + crowd two-frame diff ≥ 2x W0's baseline.
   W0's baseline (in ROADMAP-WOW2.md's own "## W0 — the motion sheet, before"
   section): animal median 11,864 px/s (mask ~17k px), crowd median 30,178
   px/s (skewed by traffic — read that section's per-chapter table). V1/V2's
   own instruments (`qa/wow2-alive.js`, `qa/wow2-people.js`) measured a
   SUBSET of chapters live-vs-cut, not all 19 against the W0 baseline
   directly. Re-run `qa/wow2-alive.js`/`qa/wow2-people.js` (or copies of them
   scoped to more chapters) across as many of the 19 as time allows —
   honestly report coverage, do not claim 19/19 if you measured fewer.
2. **The far plane** — planes-only far share rises in every open chapter; a
   horizon everywhere; something moving. V3's own report has real numbers for
   the 12 chapters it built in (`qa/wow2-far-depth.js`, `qa/wow2-far.js`) —
   re-run `qa/wow2-far-depth.js` fresh (close/open session first — ES module
   cache) across all 19 for a clean CURRENT table (some chapters never got a
   far layer by design — Pasto/Kyoto/Sahara/Drift/Venice/Goreme/Cave were not
   in V3's build list; say which and why, per V3's own write-up in the
   roadmap).
3. **Tracks** — decal pixels behind the animal at 0/10/20s, a wake. V6's own
   `qa/wow2-tracks.js` has numbers for Palawan/Antarctica/Kyoto. Read them;
   re-run once to confirm they still hold after V4/V5/Part N's later edits to
   shared files (shared.js in particular was touched by W1, Part N and V5 —
   a regression in the tracks pool from a later edit is exactly the kind of
   thing this closeout exists to catch).
4. **The reason, counted** — glimpses 19/19 (N2, `qa/wow2-glimpse*.js`); the
   shelf 1:1 with the ledger (N1, `qa/wow2-shelf.js`, verified at 0/7/19);
   the regular's "you were gone" line on ≥20min away not 5min (N3,
   `qa/wow2-waits.js`); the companion's homecoming in its `from` chapter for
   ALL SIX kinds (N3's own report says only pigeon/Venice was independently
   verified live, the other five "share identical code" — RUN THE OTHER FIVE
   LIVE (cat, silver gull, gentoo, heron, ibis) if the companion-taking
   mechanic lets you force-equip each kind for a fast test; if it genuinely
   cannot be forced within your time budget, say precisely that instead of
   claiming 6/6).
5. **Three minutes** — T's bot: 10/10 runs, median 70.8s wall / 66.5s game,
   worst 96.1s (well under 180s cap — CLOSED). The "stranger playtester names
   all six verbs unprompted" part is NOT closed — T's own report says the
   stranger was scripted, not a real independent read, and flags "a human
   stranger is still owed." You do not have a human tester either. Write this
   miss into the Closed section by name rather than papering over it — this
   project's convention (see every wave's write-up) is to name a miss
   honestly rather than claim it.
6. **16.7ms held** — THIS IS THE ONE NUMBER NO WAVE MEASURED TOGETHER. Every
   wave tested only ITS OWN flags in isolation. Build
   `qa/wow2-frametime-final.js`: the FULL flag list from every wave —
   noAlive, noFootfall, noTracks, noGesture, noUmbrella, noCompany, noFar,
   noSub2, noRainbow, noPuddle, noStrip, noShelf, noGlimpse, noTut (grep
   `game.state.no` across src/ to confirm you have the complete list; add
   any you missed) — live (all false) vs fully cut (all true), interleaved
   A/B exactly like `qa/wow-frametime.js`'s own pattern (5 reps of 60
   frames per arm), across the same eight chapters L11 used (sydney, kyoto,
   pantanal, monaco, hanoi, sahara, iceland, goreme). Target: live-minus-cut
   median ≤ 0.6ms total, rung 0 held. THIS IS THE REAL TEST OF THE PASS'S
   OWN PERFORMANCE RULE and it has not been run yet — do it carefully, one
   chapter per run-code invocation, and if the headless machine's noise
   floor (several waves report ±0.5-3ms swings) makes the whole-frame number
   unusable, fall back to the tick-only sim A/B pattern V2's report used
   (isolates JS cost from the renderer's own jitter) and say so explicitly.

## Other things to close out
- **Nineteen arrival frames, re-shot and read.** Adapt `qa/wow-sheet.js`'s
  pattern (fresh boot, arrival via `hud.cross`, raw screenshot) across all 19
  chapters — one chapter per run-code invocation is too slow for 19 individually
  if each needs a full ~9s settle; batch several per invocation if you can stay
  under ~4 minutes, or split across a few invocations. Read every PNG with the
  Read tool and describe by eye: does the new far layer/umbrella/shelf/rainbow
  read as a beat in the frame, or is it invisible from the resting lens (V3's
  own report already names Kowloon and Hanoi as NOT visible from arrival —
  confirm that finding still holds and check the other 17 honestly, don't
  assume they are fine).
- **A regression sweep.** `node build.mjs` and `npm test` clean (confirm).
  Additionally: since shared.js was edited by three different waves in
  sequence (W1's tracks pool, Part N's CHAPTERS/save-shape additions, V5's
  puddle/rainbow), and systems.js by three waves (T, Part N, V5's dome hook),
  read the diff of shared.js and systems.js against `00f3b72` end to end once
  (`git diff 00f3b72..HEAD -- src/shared.js` etc.) looking specifically for:
  a function edited by one wave whose surrounding context a later wave's Edit
  might have shifted incorrectly, a duplicate declaration, an unreachable
  branch, or a comment that now describes code that moved. This is a review
  pass, not a rewrite — only touch src/ if you find something genuinely
  broken (see below).
- **If you find a real bug**: fix it minimally, `node --check` +
  `node build.mjs` + `npm test`, commit it separately with its own honest
  message naming which wave's code it was in and what was wrong — do not
  fold a bug fix into the closeout commit silently.
- **The harness lessons.** Read every wave's report for a NEW harness trap
  that is not already in the memory note (e.g. V3's "`camYaw` closure decays
  back to rest within ~3s, measure immediately"; the two "cherry-pick a
  worktree agent's commit" and "isolated worktree for a baseline agent"
  patterns from W0; the frame-time A/B being unusable at whole-frame
  resolution on this headless box and the tick-only fallback). List them for
  CONTRACT.md's entry the way L11's entry closed with "Two harness rules
  learned the hard way, now in the memory."

## Writing the two documents

**CONTRACT.md** — a new top entry in the same voice/format as "THE ELEVENTH
LIFT" (read it in full as the template: one paragraph naming the source
roadmap and commit count, then short paragraphs per capability shipped, then
a closing paragraph or two on harness lessons). Title format:
`## THE TWELFTH LIFT — <a short name for what this pass actually was> (L12 —
20-21 Sep 2026)`. Keep it SHORT — this is the "short version," full detail
stays in ROADMAP-WOW2.md's own Closed section, exactly as L11's CONTRACT.md
entry points back to ROADMAP-WOW.md's Closed section rather than repeating it.

**ROADMAP-WOW2.md's Closed section** — the full accounting, in the voice this
file already writes in (see every "### Vn/Nn/T — shipped" block already in the
file for the register: concrete numbers, named misses, no hedging language).
Cover: commit count and range; what shipped per part (V1-V6, N1-N4, T) in one
or two sentences each (do not re-explain what's already documented in each
wave's own shipped block — synthesize, point at it); the six numbers as
measured HERE, at closeout, with every honest miss named (reflectTex() export
wanted for V4; bubble count 19-30 of a 40 target; Kowloon/Hanoi far layers
invisible from arrival; Manly's ferry clips the frame edge; the stranger
playtester still owed; the companion homecoming independently proven for
fewer than all six kinds if that's what you find; Sydney's jacaranda gust
reusing the existing petal skitter; N4's opening beat as a held establishing
shot rather than a literal sleeping pose (capybara.js out of scope for that
agent); the gardener's sit-down pose not built; V0 not started at all —
correctly optional per the roadmap, name it as such, not as a failure); a
"Left open, named" closing paragraph the way ROADMAP-WOW.md's does.

## Report
A final report to the user-facing thread (this is read directly by the
orchestrator, who will relay it) — the six numbers as closed, the CONTRACT.md
entry title, the Closed section's location, any bug you found and fixed, and
confirmation that `node build.mjs` + `npm test` are green on the final commit.
Keep it under 50 lines; this is the summary of the WHOLE roadmap, not just
your own increment.
