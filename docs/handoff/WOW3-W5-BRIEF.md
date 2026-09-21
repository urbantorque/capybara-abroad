# W5 — the WOW3 closeout: extra anchors

You are the LAST agent of ROADMAP-WOW3. All of Part D (12 items), X1, X2, X3,
X4 are built, committed and green on `lift-pass` (18 commits since
ROADMAP-WOW2 closed at `dfde990`, ending at `ba5b4f7`). Your job, exactly
like WOW2's own W6, is to measure the whole pass together for the first
time and write it up in CONTRACT.md (a new top entry, "THE THIRTEENTH
LIFT") and ROADMAP-WOW3.md's own "## Closed" section (append at the very
end of the file, after "## Held").

## Files you touch
CONTRACT.md (prepend above the current top entry, "## THE TWELFTH LIFT"),
ROADMAP-WOW3.md (append the Closed section at the end), qa/ (new closeout
instruments only). Do not touch src/ unless you find a genuine regression
(see "If you find a real bug" below).

## New flags this pass actually added (confirmed via diff)
`noRemember` (X1b, the world-changes trigger), `noLens2` (X3.2, the
far-mover glance only — X3.1 shipped no code), `noVoice2` (X2.3+X2.4, the
shelf chime + glimpse footstep). `noFar`, `noStrip`, `noSub2` are REUSED
existing WOW2 flags (W2's truss/jacaranda/reflectTex ride them), not new.

## The six numbers, WOW3's own version (grounded in what each wave reported)
1. **The twelve debts.** All twelve of Part D closed — read every "###
   shipped" block for W1/W2 to confirm each item's disposition (built /
   found-already-correct / genuinely re-declined with a number). Write the
   one-line-per-item summary the way WOW2's own Closed section did for
   V1-V6/N1-N4.
2. **Motion at rest, to full coverage.** THIS IS THE ONE MEASURE NO WAVE
   TOUCHED THIS PASS — W1-W4 all worked on Part D/X1-X4, none extended
   `qa/wow2-alive.js`/`qa/wow2-people.js` past the 4/19 crowd coverage WOW2
   left at. You have two honest choices: (a) spend real time extending
   coverage now (copy the existing instruments, run them across the
   remaining 15 chapters, one or a few per invocation), or (b) report
   coverage UNCHANGED at 4/19 and say plainly that this pass did not
   extend it — do not claim extension that did not happen. Prefer (a) if
   your time budget allows at least a partial extension (even 4/19 → 10/19
   is real progress worth reporting precisely); if you only have time for
   a subset, report exactly which chapters you added.
3. **The still-pixel floor.** ALREADY CLOSED by W3's X4 work: 6 of 9
   mask-blamed chapters now meet -40% under the extended mask (sydney,
   pasto, cali, kowloon, goreme, cave); 3 do not (manly +208%, antarctic
   +295%, hanoi +36%). This is a genuine, complete number — report it as
   closed, name the 3 misses as real shimmer or instrument artefact per
   W3's own finding (read its shipped block for which).
4. **The place remembers.** X1a (shelf in earn order, verified 3/3 orders
   live), X1b (world changes in 3 chapters: quay/kyoto/venice, verified
   live short vs long absence), X1c (companion comes over, verified live
   for 2/6 kinds: pigeon/heron). **Extend X1c's live verification to the
   other 4 kinds if your time budget allows** (cat/goreme,
   gull/manly, gentoo/antarctic, ibis/sydney — the same forced-stow-clear-
   teleport-walk-up pattern W3 already used for pigeon/heron) — this is
   the same kind of gap W6 closed for WOW2's own companion homecoming
   (1/6 live → 6/6 live), and it is cheap to repeat.
5. **A voice for what became visible.** W4's own report: footfalls
   already-built-confirmed, drip already-built-confirmed (not per-mote
   positioned, named), shelf chime genuinely built (two real bugs fixed
   along the way — AudioContext resume timing, voice-ceiling drop), the
   glimpse's walk-off genuinely built (was silent), companion approach
   already-built-confirmed by code read (not re-soaked live by W4 — you
   may re-soak it live if time allows, otherwise report it as W4 left it).
6. **16.7 held, THE COMBINED NUMBER.** Nobody has run every WOW2 AND WOW3
   flag together. Build `qa/wow3-frametime-final.js`: the FULL flag list —
   every WOW2 flag (`noAlive`, `noFootfall`, `noTracks`, `noGesture`,
   `noUmbrella`, `noCompany`, `noFar`, `noSub2`, `noRainbow`, `noPuddle`,
   `noStrip`, `noShelf`, `noGlimpse`, `noTut`) PLUS every new WOW3 flag
   (`noRemember`, `noLens2`, `noVoice2`) — confirm the complete list via
   `grep -oE "game\.state\.no[A-Za-z0-9]+" src/*.js | sort -u` before
   trusting this list. Live (all false) vs fully cut (all true),
   interleaved A/B, 5 reps of 60 frames, the same 8 chapters (sydney,
   kyoto, pantanal, monaco, hanoi, sahara, iceland, goreme). PIN THE
   GOVERNOR RUNG to 0 first (`capy3.prefs.v1 = {v:1, pf:1}` — WOW2's W6
   found a headless box settles at rung 3 on its own, which parks every
   term in both arms and hides a real cost). Target ≤ 0.6ms live-minus-
   cut total, rung 0 held. If the whole-frame number is unusable (several
   WOW3 waves reported ±1.5-3ms noise at the individual-flag level), fall
   back to the tick-only sim A/B the WOW2 closeout used successfully.

## Other things to close out
- **A regression sweep.** `node build.mjs` + `npm test` clean (confirm).
  `src/systems.js` was touched by ALL FOUR waves this pass (W1's item 9,
  W2's items 7/8, W3's X1a/b/c, W4's X2.3/X3) — read
  `git diff dfde990..HEAD -- src/systems.js` end to end (it will be a
  large diff) looking for the same class of thing WOW2's W6 checked for:
  a later wave's edit landing inside an earlier one's function, a
  duplicate declaration, an unreachable branch. `src/npc.js`,
  `src/weather.js` and `src/capybara.js` were each touched by 2-3 waves —
  same check, lighter (smaller diffs). A scripted duplicate-declaration
  check across all touched files (the WOW2 W6 pattern) is cheap and worth
  repeating.
- **If you find a real bug:** fix it minimally, gate it, commit it
  separately with its own honest message — do not fold into the closeout
  commit.
- **Part H, named plainly.** ROADMAP-WOW3.md's own "Part H" section lists
  two items no agent can build (a real-GPU frame budget, a human
  stranger playtester). Confirm neither was attempted by any wave (they
  should not have been — no wave's brief asked for them) and name them
  in the Closed section exactly as still owed, the same honest way T's
  own scripted-stranger gap has now been named twice.
- **Harness lessons.** Read every wave's report for a new trap worth the
  memory note (e.g. W1's texture()/texture2D() GLSL300 fix, W2's
  discovery that `game.tick` runs regardless of `started`, W3's finding
  that `ensureBuilt()` only runs once per session ever, W4's finding that
  internal `sfx()` calls never route through the externally-published
  `game.sfx`). List the two or three most reusable ones for CONTRACT.md's
  entry.

## Writing the two documents
**CONTRACT.md** — new top entry, `## THE THIRTEENTH LIFT — <short name for
what this pass actually was> (L13 — 21 Sep 2026)`, same short-version voice
as L11/L12's own entries (one paragraph naming the source roadmap and
commit count, short paragraphs per capability, a closing paragraph on
harness lessons). Point back to ROADMAP-WOW3.md's Closed section for full
detail rather than repeating it.

**ROADMAP-WOW3.md's Closed section** — commit count and range; what
shipped per part in one or two sentences each (synthesize, point at each
wave's own shipped block, do not re-explain); the six numbers as measured
HERE with every honest miss named (motion-at-rest coverage exactly as
extended or not; the 3 still-pixel misses; however many companion kinds
got live-reverified; the drip's shared-not-positioned sound; anything a
regression sweep found); Part H named as still owed; a "Left open, named"
closing paragraph in the same voice as WOW2's own.

## Report
A final report to the orchestrator — the six numbers as closed, the
CONTRACT.md entry title, confirmation `node build.mjs` + `npm test` are
green on the final commit, and total commit count for the whole WOW3 pass.
Keep it under 50 lines.
