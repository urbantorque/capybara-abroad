# CLOSEOUT — the Payoff Pass, finished properly

Started 26 Aug 2026, on `claude-opus-5`. Predecessors: `qa/BATCH1.md` … `qa/BATCH4.md`.

Three jobs, in order:
1. **Fix or complete what batches 1-4 left open.**
2. **Run the five pillars on chapters 18 and 19**, which landed after the pass closed and
   were never covered by it.
3. **Formally close batches 1-4** — the record corrected, the audits current, one report.

## Job 1 — the remaining runs

### From batch 2, the two rows that were never ticked
- [ ] **A1** The finale gathers no cast (`BATCH2.md:25`). No gather state exists in
      `systems.js` or `npc.js`; `sysFinaleStage` lays the keepsakes and nothing else.
- [ ] **A2** The mischief economy does not reach chapters 1-2 (`BATCH2.md:61`, finding A).
      `environment.js` and `pasto.js` register ZERO `game.locals`; `biomeLive()` is
      hard-coded to `isActive('sydney')`.

### From batch 2, evidenced and handed forward
- [ ] **A3** Chapters 1-3 carry neither `framed` nor `lit` (`qa/channels.mjs` says 14/17).
      Findings B and C. `frameShot` did not exist when batch 2 ran; it does now.

### From batch 4's handover, open and measured
- [ ] **A5** A relocated keepsake still hovers in 3 of 17 (Göreme 1.74 m, Palawan 0.69 m,
      Sahara re-rescues). `physHomeLearn` learns only on the frame the body SLEEPS.
- [ ] **A6** Pasto drifts at spawn+(9,9), 0.17-29 m across runs. Both known mechanisms
      fixed; a differential with all non-ground bodies removed still drifted 1.41 m.
- [ ] **A7** Only 5 of 17 chapters register a critter.
- [ ] **A8** Room tone is keyed per biome, not per space.
- [ ] **A9** Iceland's snowcat track is at x=34; every glacier run ends at x≈-20.
- [ ] **A10** Kowloon's roof is unreachable — tops out 0.65 m east of the deck.
- [ ] **A11** Palawan's `inZone('shaft')` and cave's `nearestDrip()`/`echoReady()` have no
      readers repo-wide.

### The record
- [ ] **A4** `BATCH3.md` and `BATCH4.md` both state batch 2 jobs 3-4 "were never run".
      They ran — `4c19859` 25 Aug 23:39 and `478e69b` 23:51. Correct both files.

### Deliberately declined, restated not re-litigated
- [ ] **A12** The 130k triangle gate (10 over, 0 over the cost gate); the ground-sheet
      shadow lever in eleven chapters; `index.html:5` `user-scalable=no`.

## Job 2 — chapters 18 and 19
- [ ] **B1** Every browser audit is hard-coded to 17 chapters: `channels.mjs`, `budget.js`,
      `stillness.js`, `fuzz.js`. Extend to 19 first, so the pillars have a baseline.
- [ ] **B2** Five pillars — **18 Monte Carlo** (`src/monaco.js`)
- [ ] **B3** Five pillars — **19 Hanoi** (`src/hanoi.js`)

## Job 3 — the close
- [ ] **C1** CONTRACT.md new version section
- [ ] **C2** Project memory
- [ ] **C3** Tick the batch files; this file as the closing report
- [ ] **C4** Full regression, `playwright-cli close-all`

## Log

### B1 — the audits could not see chapters 18 and 19 (done)

`channels.mjs`, `budget.js`, `stillness.js` and `fuzz.js` all carried a hard-coded 17.
Extended to 19, and the chapter count is now DERIVED in `channels.mjs` rather than spelled,
so the next chapter cannot ship into the same hole.

**Three things the extension found immediately:**

1. **Chapters 18 and 19 have no row in the event grade layer** — `lit` is not a channel
   either of them has. Same absence as sydney/pasto/quay. Now 14/19, not 14/17.
2. **Hanoi is the largest chapter in the game: 236-241k triangles**, over the brief's 130k
   gate by ~110k — half again over the Pantanal, which batch 4 called the worst offender.
   Monaco is 133k, just over. Neither had a ratchet ceiling, and `budget.js` passed them
   SILENTLY: `if (c && r.tris > c)` treats "no ceiling recorded" as "within its ceiling".
   Now reported as `noCeil` and fails the audit.
3. **The cost gate reported a confident `FAIL cost` that was pure machine noise.**
   Single-mean readings swung 1.68 → 5.31 ms for the same chapter minutes apart, and
   `msNoShadow` came back GREATER than `ms` in iceland — turning the shadow pass off cannot
   make a chapter slower, so the measurement was contaminated. Now: minimum of five
   repeats (noise only ever adds time, so the min is the robust estimator), plus that
   impossibility as an explicit self-check. A contaminated run reports
   `COST GATE UNUSABLE` and is forbidden from failing anything.

**And the ratchet was sized against a noise floor measured on the wrong axis.** The scatter
helpers call unseeded `rand()` when a chapter is BUILT — at page load, not on `switchTo`.
Re-entering a chapter inside one session re-measures within ~1,500 because it is the same
build. Across four page loads: **goreme 10,116** · hanoi 2,756 · pantanal 2,684 ·
sahara 1,834 · quay 780 · monaco 100. Göreme's 214,000 line sat inside its own noise and
tripped by 630 on the run that found this. Raised to 222,000 with the measurement recorded
beside it; the slack is per chapter now, not one global figure.

`qa/budget.js` is green: `PASS · 12 of 19 over the 130k brief gate · 0 fail · 0 noCeil`.
