# CLOSEOUT — the Payoff Pass, finished properly

Started 26 Aug 2026, on `claude-opus-5`. Predecessors: `qa/BATCH1.md` … `qa/BATCH4.md`.

Three jobs, in order:
1. **Fix or complete what batches 1-4 left open.**
2. **Run the five pillars on chapters 18 and 19**, which landed after the pass closed and
   were never covered by it.
3. **Formally close batches 1-4** — the record corrected, the audits current, one report.

## Job 1 — the remaining runs  ✅

### From batch 2, the two rows that were never ticked
- [x] **A1** The finale gathers no cast (`BATCH2.md:25`). No gather state exists in
      `systems.js` or `npc.js`; `sysFinaleStage` lays the keepsakes and nothing else.
- [x] **A2** The mischief economy does not reach chapters 1-2 (`BATCH2.md:61`, finding A).
      `environment.js` and `pasto.js` register ZERO `game.locals`; `biomeLive()` is
      hard-coded to `isActive('sydney')`.

### From batch 2, evidenced and handed forward
- [x] **A3** Chapters 1-3 carry neither `framed` nor `lit` (`qa/channels.mjs` says 14/17).
      Findings B and C. `frameShot` did not exist when batch 2 ran; it does now.

### From batch 4's handover, open and measured
- [x] **A5** A relocated keepsake still hovers in 3 of 17 (Göreme 1.74 m, Palawan 0.69 m,
      Sahara re-rescues). `physHomeLearn` learns only on the frame the body SLEEPS.
- [~] **A6** Pasto drifts at spawn+(9,9), 0.17-29 m across runs. Both known mechanisms
      fixed; a differential with all non-ground bodies removed still drifted 1.41 m.
- [~] **A7** Only 5 of 17 chapters register a critter.
- [~] **A8** Room tone is keyed per biome, not per space.
- [~] **A9** Iceland's snowcat track is at x=34; every glacier run ends at x≈-20.
- [~] **A10** Kowloon's roof is unreachable — tops out 0.65 m east of the deck.
- [~] **A11** Palawan's `inZone('shaft')` and cave's `nearestDrip()`/`echoReady()` have no
      readers repo-wide.

### The record
- [x] **A4** `BATCH3.md` and `BATCH4.md` both state batch 2 jobs 3-4 "were never run".
      They ran — `4c19859` 25 Aug 23:39 and `478e69b` 23:51. Correct both files.

### Deliberately declined, restated not re-litigated
- [~] **A12** The 130k triangle gate (10 over, 0 over the cost gate); the ground-sheet
      shadow lever in eleven chapters; `index.html:5` `user-scalable=no`.

## Job 2 — chapters 18 and 19  ✅
- [x] **B1** Every browser audit is hard-coded to 17 chapters: `channels.mjs`, `budget.js`,
      `stillness.js`, `fuzz.js`. Extend to 19 first, so the pillars have a baseline.
- [x] **B2** Five pillars — **18 Monte Carlo** (`src/monaco.js`)
- [x] **B3** Five pillars — **19 Hanoi** (`src/hanoi.js`)

## Job 3 — the close  ✅
- [x] **C1** CONTRACT.md new version section
- [x] **C2** Project memory
- [x] **C3** Tick the batch files; this file as the closing report
- [x] **C4** Full regression, `playwright-cli close-all`

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

### A3 — the two channels chapters 1-3 never had, and 18-19 shipped without (done)

**FRAMED.** Batch 2 measured Sydney's failure precisely and could not fix it; batch 3 built
the tool and did not come back. Measured on the podium, before and after, by projecting the
shell mesh's own vertices into the frame:

| | dist | pitch | sails in frame |
|---|---|---|---|
| the rig, at the payout | 2.97 m | 50.6° | **0 of 714** |
| with `env.operaShot()` | 17.25 m | 16.2° | **714 of 714** |

`qa/CO-opera-framed.png` is the moment. The first attempt at 21 m held all 714 too and left
a third of the frame as empty sky — **a projection test says the subject is present, it does
not say the shot is good**, and only the PNG separated those.

Chapters 2 and 3 got theirs with `over: true`. v27 built that flag and named the two
chapters it was for in its own comment — "Antarctica's `orca-ride` is at the helm and
Pasto's `condor-ride` is in flight" — then wired Antarctica and stopped. Half the cases the
flag exists for still could not reach the channel.

**LIT.** Five of nineteen chapters had no row in the event grade layer. The reason was
structural, and it is why three passes in a row wrote the finding down instead of closing
it: `sysAirT` carries six chapters and the other thirteen weights are hand-declared
scalars, so *using* the second channel meant first adding a damped weight in three separate
places. `sysChapT` is that table over all of `CHAPTERS`. No chapter has to again.

Measured, all five, before and during:

| ch | signal | before | during |
|---|---|---|---|
| 1 sydney | `stageGlow` 0 → 1 | bloom 0.220 · vig 0.140 · rad 1.150 | **0.380 · 0.090 · 1.160** |
| 2 pasto | `craterGlow` 0 → 0.45 → 0.67 | bloom 0.220 | **0.328** flying · **0.381** over the cone |
| 3 quay | `wake` 0 → 1 | bloom 0.340 · rad 1.150 | **0.480 · 1.330** |
| 18 monaco | `tunnel` 0 → 0.753 | bloom 0.460 · thr 0.620 · vig 0.300 | **0.656 · 0.304 · 0.451** |
| 19 hanoi | `trainGlow` 0 → 0.997 | bloom 0.220 | **0.519** at the peak |

**AND PASTO'S ROW WAS WRONG FIRST, IN EXACTLY THE WAY THE FINDING IT CLOSES WAS WRONG.**
Keyed on crater proximity alone it measured **0.000 across a whole ride**: the marquee is
`condor-ride`, which fires at the LAUNCH, and the launch is at the spawn — 104 m from the
caldera against a 70 m falloff. Tracked over two minutes the unsteered bird never came
within 95.4 m. A row written for a marquee, dark for the whole marquee. The ride is the
floor now (0.45) and the cone is the rest; `thermal-peak` and `crater-drop` both take the
player there, so the top of the range is reachable and earned.

### A2 — the mischief economy reaches chapters 1 and 2 (partly; done and bounded)

Batch 1 reported "13 of 15 locals chapters carry two of the three chains", which was true
and hid this: **Sydney and Pasto are not locals chapters at all.** They are the two oldest,
they predate `addLocal`, and their casts are npc.js's own `humans` and `paCast`. So every
gate in the reaction layer is shut in exactly the first two hours of the game —
`localOwnerOf` scans `locals`, `localsStep` opens `if (!locals.length) return`, and the
Sydney produce duplicate is gated by `biomeLive()`, hard-coded to `isActive('sydney')`.

**What made this tractable:** `paBuildLocal` calls the same `buildHuman` Sydney uses, so a
Pasto farmer and a Sydney commuter are the same record shape. Nothing new was built.

**Landed — the witness chain, in both chapters.** Differential, `git stash push -- src/npc.js`:

| | chain calls | people who looked | still facing at 0.2 s | at 1.7 s |
|---|---|---|---|---|
| sydney, before | **0** | — | — | — |
| sydney, after | 2 | 25 | **9** | **9** |
| pasto, before | **0** | — | — | — |
| pasto, after | 2 | 4 | **4** | **4** |

**Landed — produce in Pasto.** The graze handler now picks the live chapter's cast. Pasto
has THIRTEEN edible props, more than any chapter in the game including Sydney's seven, and
not one of them could start a reaction. Its own `paProduce` pool, not the chapter-neutral
one, for the reason that pool is neutral in the first place.

**TWO TRAPS, AND THE SECOND IS THE ONE WORTH KEEPING.**

1. **`gawpT` counts UP.** The obvious way to hold a look open is that timer, and in Pasto
   `paStepHuman` LEAVES the gawp when it passes 1.8 — so writing 2.6 into it *ends* the
   look. Same family as the catch-all state that reset the timer it was waiting on.
2. **A bare `lookX` write is worth nothing.** The first version set `lookX`/`lookZ` and
   measured beautifully on the frame it fired — 9 of 16 in Sydney, 5 of 13 in Pasto —
   and **2 and ZERO a fifth of a second later.** Twenty-odd sites inside the two state
   machines write `lookX` every frame, so the witness look loses to whatever the person
   was already doing before a player could see it. It needs `witT`, re-asserted AFTER the
   state machine has run. Deliberately not a state: a state needs a ceiling and an exit,
   and the cheapest way to obey the catch-all-state rule is not to add one.

**Not done, and why.** Ownership does not port. It needs a steering state with a hard
ceiling on two casts that already carry fourteen states of their own, and the value is
lower than its regression risk on the two most-played chapters in the game. Recorded as
open rather than faked. The other two chains are live in both.

### A1 — the finale gathers a cast (done)

Batch 2 built THE LAWN and marked "gather a cast" **PARTIAL**, for a reason it stated
exactly: Sydney registers zero `game.locals`, so there was no cast to gather — its people
are npc.js's own `humans`, and gathering them needed a state in that module.

Built as `gather`, on the terrace's `resit` idiom as batch 2 proposed: a slot assigned
once, an arrival test, a hard ceiling, then damp and stop. `sysFinaleStage` emits
`finale:staged`; npc.js answers. The finale does not learn what a `humans` array is, and a
chapter with nobody in it simply does not answer.

**Three faults, all found by measuring the walk rather than by reading the code:**

| | measured |
|---|---|
| the ceiling cut them off mid-walk | 4 of 5 recruits stopped at 6–9 m from their slots |
| one recruit never moved at all | 28.19 m → 28.08 m over 16 s: jitter, not walking |
| one slot was inside a flower bed | `navBlocked(29, 20)` **true** — a point nobody can stand on |

The first two are one fault: **the recruit radius and the ceiling did not know about each
other.** Sydney's cast is spread over a whole park — the five nearest to the lawn are 10,
16, 17, 19 and 28 m away — and at 14 s the reachable radius is 11.8 m. `npcGATHER_MAX_D`
is derived from the ceiling and the walk speed now, so it cannot disagree with it; the
ceiling is 30 s, which is not a wait, because the ending is reached by sitting down and
the loaf takes about ten seconds on its own. A blocked slot rotates round the ring until
the ground is clear.

**After:** 3 recruited, 3 slots clear, all three arrive — at 7 s, 9 s and 12 s — and hold
at 0.24–0.26 m. `qa/CO-lawn-cast.png`: the animal loafed in the middle of the horseshoe,
nineteen souvenirs round it, a gardener and a tourist standing either side watching.

### AND THE FINALE COULD NOT BE REACHED BY ANY OF ITS OWN TESTS

`keeps: 0` on the first run. **`qa/all-task-ids.json` was stale at 199 of 229 ids** — every
id from chapters 18 and 19 was missing — and `pf2-finale.js`, `pf2-finale2.js` and
`pf2-finshot.js` all write it into the save to reach the ending. So `sysFinaleAll()` had
been false since 18 and 19 shipped, and all three scripts were exercising **an ending that
cannot fire**, reporting whatever they happened to measure instead. Batch 4's regression
line — "the finale fires at second 11... 199 of 199 · 17 of 17 places · 17 kept" — was true
when it was written and has not been true since.

Regenerated, and `qa/audit-tasks.mjs` now BLOCKS on any drift between the fixture and the
task table. Proved by differential: truncated to 199 it prints
`BLOCKER 30 task ids missing … every finale script is testing an ending that cannot fire`
and exits 1; restored, 0 and 0. Regenerate with:

    node -e "const fs=require('fs'),s=fs.readFileSync('src/shared.js','utf8'),i=s.indexOf('export const TASKS'),b=s.slice(i,s.indexOf('\n];',i));fs.writeFileSync('qa/all-task-ids.json',JSON.stringify([...b.matchAll(/\bid:\s*'([^']+)'/g)].map(m=>m[1])))"

**Harness trap, paid for again and worth adding to the list:** `page.addInitScript(() =>
localStorage.clear())` persists on the BROWSER CONTEXT, not just the script that installed
it — so every later `run-code` in the same session silently wipes the save too. Three runs
reported an empty journey against a save system that was working, which is memory trap 10
one level further out. A write-then-reload test needs its own session.

## Job 2 — the five pillars on chapters 18 and 19

### Pillar 2, the cast — NOBODY IN EITHER CHAPTER REACTED TO ANYTHING YOU HAD DONE

Both chapters ship a good cast: 8 people in Monte Carlo and 7 in Hanoi, each with idle
lines, wheek answers, an `onTask` reaction and a two-hander `addExchange`. What neither had
was a single `after:` or `before:` line — **0 and 0**, against 15 to 42 in every other
chapter with its own cast.

`onTask` fires once, at the moment, and is gone. So the doorman who watched you walk out of
the casino eleven chips up greeted you next morning exactly as he had the first time, and
the woman whose pho you put your whole face in had nothing to say about it ever again.

**And `qa/lines.mjs` could not see it, twice over.** Its `FILE_CHAPTER` table stopped at 17,
so neither file was read at all; and its regression list named four specific files — the
ones the Delight Pass once fixed — so "this chapter has no conditional lines" was not a
condition it tested for anywhere. Both corrected: the table goes to 19, and **every** chapter
with a cast must now carry conditional lines, with a floor of 6.

Added 26 to Monte Carlo and 23 to Hanoi, in each character's own register. Verified at
runtime on a cleared save, not just parsed:

| | completing | measured |
|---|---|---|
| monaco | `high-dive` | the deckhand swaps *"Nobody has ever actually gone off it"* → *"You went off it. From the TOP deck. I have to write that up."*; the man on the quay gains *"Something came off the top deck this morning."* |
| hanoi | `cross-the-road` | the pho seller swaps *"You do not cross by waiting"* → *"You walked straight through it. Like somebody who lives here."* |

`qa/lines.mjs`: **477 conditional lines over 17 casts, 0 blockers** (was 428 over 15).

### A6 — Pasto's drift: half of it named and fixed, half still open

Batch 4 diagnosed this exactly and prescribed the fix, then built something else:
*"`navBlocked()` forwards only to `game.env.navBlocked` — static world geometry… so a
walker steers around a building and walks straight through the player. Fix belongs in
`npc.js`, gated OFF for the states that are supposed to reach the player."* It fixed the
separation radius instead, which made the shove smaller without removing it.

**Measured, parked at spawn+(9,9) with no input:** every displacement over 0.06 m in a
frame happened while a **kinematic (type 4, mass 0) `userData.npc` body doing 1.9 m/s**
was 1.3–1.7 m away, and the animal's own speed spiked to **3.04 m/s**. `capy.frame` was
`null` throughout — not the carry channel, a shove.

Built: `npcBlockedFor`, one squared distance per steering probe, gated off for
chase/flee/cornered/praise/chat/shoo/carry/photo/own/retrieve — a chase that dodges the
thing it is chasing is worse than a shove. Threaded through `steerTo` and `paRefuse`.
**After: 0 shoves in three consecutive 60 s runs.**

**AND IT DOES NOT CLOSE THE DRIFT, WHICH IS THE POINT WORTH RECORDING.** Differential,
three runs each way:

| | drift | shoves |
|---|---|---|
| without | 9.71 · 7.97 · 7.99 m | 0 · 0 · 0 |
| with | 7.97 · 8.11 · 7.97 m | 0 · 0 · 0 |

The shove is real and is now gone, and it was never the dominant term — one earlier run
with **14 shoves drifted 1.22 m**. What is left is a steady straight slide of about 8 m in
60 s, and it is **not the ground**: sampled along the path, `gradX`, `gradZ` and `slopeAt`
all read **0.0000**. The body holds *exact* velocities — `vz = -3.000` for five seconds,
then `vx = -0.368` for five more — while its position barely changes. A held exact value
is a **bare velocity write**, which `capy3-external-forces-on-the-capybara` says is the one
channel a body must never be moved through. That is the next thread to pull, and it is a
different bug from the one batch 4 named.

### Pillars 1, 3, 4 and 5 on chapters 18 and 19

**Pillar 1, the marquee.** Monte Carlo's `the-tunnel` was certified from the PNG and the
projection: the bore's own 253 vertices are 100% in frame from 0.3 s to 1.5 s. It was
0.6-1.5 s before — at `raise: 1.0` the lens sits level with the car roof and the first six
tenths are the back of a car — and the hold was cut 3.4 s → 1.9 s because past 1.5 s the
car has outrun the shot and the marquee was lingering on an empty road. **A shot that
outlives its subject ends on nothing.** Hanoi's is the big find, above.

**Pillar 3, feel of the ground.** The ladders were **three rungs for eleven zones** in
Hanoi and four for twelve in Monte Carlo — a city with a lacquered timber bridge, a
riveted steel one, a wet market floor and a lake path answered "asphalt, ballast, or the
same tile everywhere else". Six distinct pitches each now, narrow tests above broad ones
because chapter 3's ladder was found returning wharf timber for the whole of Manly.
Stillness: **both chapters clean**, 0 issues.

**Pillar 4, the signature toy.** No finding. Monte Carlo has the roulette wheel — the only
carrier in the game that is furniture — and the roof of a moving car; Hanoi has the scooter
and two hundred and forty engines as a medium. Both are already deep.

**Pillar 5, route life.** Measured against four chapters that passed it, after the probe
was fixed: **monaco 14 · kyoto 6 · hanoi 1 · goreme 0 · venice 0 · manly 0**. Monte Carlo
is genuinely the thinnest and the dead cells all sit on one walk — the climb from the port
to the casino, which is how act one becomes act two. Fifteen instanced lamps close it to
12 by differential. Said plainly rather than rounded up: closing the rest needs content on
that hillside, which is a design decision about somebody else's chapter.

### A7-A12 — the rest of batch 4's open list, re-measured not re-litigated

| | state |
|---|---|
| **A7** critters | **5 of 19** now, not 5 of 17. Neither new chapter has a ground animal drawn to register, so this stays content and not a flag — unchanged in kind. |
| **A8** room tone per biome | Unchanged. Global; Venice and Palawan remain its worst cases. |
| **A9** Iceland's snowcat at x=34 | Unchanged. Moving the track moves the beacon, the headlights, the ramp meshes and the fox's orbit centre, all derived from `iceCAT_X`. |
| **A10** Kowloon's roof | Unchanged. `symphony` is not blocked. Do not lower `hkSCAF.top`. |
| **A11** Palawan's `inZone('shaft')`, cave's `nearestDrip`/`echoReady` | Still no readers repo-wide. |
| **A12** the 130k gate · ground-sheet shadows · `user-scalable=no` | Deliberately declined in v27-v28 and **restated, not re-argued**. 12 of 19 are over the triangle gate; the cost gate is green and now knows when it cannot be trusted; the ratchet is the gate that catches things and it caught two this run. |

### AND ONE THE AUDIT NEARLY GOT BACKWARDS

`qa/journey.js` reported **`picks 17 · boardRows 17`** against a nineteen-chapter game,
which reads exactly like Monte Carlo and Hanoi being unreachable — the worst possible
defect in a chapter, and one worth stopping everything for.

**It was the audit.** The script had no reload, so it measured whatever the previous
`run-code` had left on the page (harness trap 6), and its unlock loop and traversal list
were both hard-coded to the eleven chapters that existed when it was written. Measured on a
true fresh save with a clear-once-reload-once preamble: **19 picker tiles, 19 board rows.**
The game was fine.

That is the more dangerous way round, and it is the last word on this pass: a stale audit
does not merely fail to find things, **it invents them**, and the invented ones cost most
because they look urgent. Fixed: `journey.js` clears and reloads first and walks all
nineteen — 19 entered through the departures board, gravity restored after the Drift, 0
errors.

## Job 3 — the close

| suite | result |
|---|---|
| `qa/audit-tasks.mjs` | 0 blockers, 0 warnings · 229 tasks · 19 chapters · **now blocks on a stale finale fixture** |
| `qa/lines.mjs` | 0 blockers · **477** conditional lines over 17 casts (was 428 over 15) |
| `qa/verbs.mjs` | 0 blockers · Q/E/Shift/Space all first named in ch 1 |
| `qa/pacing.mjs` | every chapter in band at 75 s a task |
| `qa/channels.mjs` | **19/19** carry all three source-visible channels · 0 fail · 0 warn |
| `qa/budget.js` | **PASS** · 0 fail · 0 noCeil · 0 noisy · 12 of 19 over the 130k brief gate |
| `qa/fuzz.js` | 19 chapters · **0 errors** · no keepsake hover over 0.5 m anywhere |
| `qa/stillness.js` | 19 chapters · only the two known: pasto, and drift's fall off the Shelf |
| `qa/audit-solid.js` | 19 chapters · monaco 15 of 2,958 samples (a water plane and a sky sphere — the cry-wolf categories), hanoi **0** |
| `qa/journey.js` | 19 picks · 19 board rows · **19 chapters entered** · 0 errors |
| `qa/route.js` | new · monaco 12 · kyoto 6 · hanoi 1 · goreme 0 · venice 0 · manly 0 |

**Audits extended from 17 chapters to 19:** `channels.mjs` (and its count is derived now),
`budget.js`, `stillness.js`, `fuzz.js`, `lines.mjs`, `audit-solid.js`, `journey.js`.
**Audits given a check they did not have:** the stale-fixture blocker in `audit-tasks.mjs`,
the no-ceiling report and contaminated-cost self-check in `budget.js`, the
has-no-conditional-lines blocker in `lines.mjs`.
