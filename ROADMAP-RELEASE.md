# The release pass — what stands between this and strangers playing it

Written 31 Aug 2026, from a four-way deep review (save/persistence, settings and
audio surface, onboarding and difficulty, cross-chapter parity) plus the
delivery items already recorded in `ROADMAP.md` and the finished
`REVIEW-2026-08-31.md`. The game holds 60 fps in all nineteen chapters with
zero errors — the code-quality war is won. What is left is **seven areas**, and
they are almost all about the player's first hour, last hour, and the frame
around the game rather than the game itself.

Every batch below is sized 2–3 h, one commit, verified with the headless
harness (`playwright-cli` for anything timing/audio/rAF-shaped) and judged from
rendered PNGs, never frame-mean metrics. The instruments that lie are in memory
(`instruments-that-cannot-hold-a-line`, `visibility-metrics-that-lie`).

---

## The seven areas, ordered by what they cost a stranger

### 1. The first door — a new player can be walled in chapter 1 ⚑ ship-blocker

- `homeOk` (systems.js:22752–22756) ORs eighteen `at*` exit predicates and
  **none is Sydney's**. The only way out of chapter 1 is the ferry — task 18 of
  19 on Sydney's list, which the 4-row paper will not surface until ~14 ticks.
  A player who never presses Tab has no visible door out of the first chapter.
- The journal's travel rows are live-looking dead controls: `jrRefresh` sets
  `disabled = !jrOpen(n)` (systems.js:14684–14686) but `jrTravel` bails unless
  `jrDepart` — open the card with Tab and every row is a focusable button that
  silently does nothing. One clause: `disabled = !(live && jrDepart)`.
- Slide is on the legend but nothing in Sydney asks for it; dive is on **no
  legend** and is first needed in chapter 12.

**AAA principle:** the first 20 minutes decide retention; every verb the player
owns must be asked for once, and every visible door must open or say why not.

### 2. The last door — the intended ending is skipped by default ⚑ ship-blocker

- `showEnd` (the "MISCHIEF COMPLETE" receipt) fires wherever the 231st tick
  lands (systems.js:17541–17542); `sysFinaleCheck` — the lawn, the horseshoe of
  souvenirs, "and that is the lot." — only runs on arrival in Sydney
  (systems.js:20927). Sydney is almost never finished last, so the receipt
  covers the real ending and a tap anywhere on it reloads the page. The file's
  own header (systems.js:17624) calls the receipt a mistake.
- **The finale has not been run since chapters 18–19 landed**: `qa/pf2-finale.js:14`
  seeds `seen: [1..17]` against a 19-chapter `sysFinaleAll()`. The only finale
  artifact on disk predates Monaco and Hanoi.

**AAA principle:** the ending is the review paragraph. It must be the authored
one, reachable on the default path, and rehearsed at current content.

### 3. The save — hours of trust, flushed nowhere ⚑ ship-blocker

- `sysSAVE_DEBOUNCE` (700 ms) drains only inside the rAF loop
  (systems.js:23694–23696); there is **no beforeunload/pagehide handler** and
  the `visibilitychange` branch (systems.js:19854) does not `saveWrite()`.
  Background the tab, close it from the strip → the latest tick is lost, even
  the one that closed a chapter. One line.
- A corrupted save presents as a **first run** (saveRead → null → first-run
  title with no Carry on) and the first tile press then `saveClear()`s the
  recoverable bytes (systems.js:16022 → 18044). Quarantine non-empty
  unparseable strings instead of destroying them.
- `saveClear()` removes only the journey key; the album and ghosts survive a
  "start over" whose confirm copy promises otherwise (systems.js:12860).
- The two silent degradations already in `ROADMAP.md`: private-mode/quota
  localStorage failure says nothing (a three-hour journey that will not be
  there tomorrow), and `__capySoftGL` (index.html:153) is read by nothing.

**AAA principle:** never lose player progress silently; corrupted state is
quarantined, not deleted; degraded modes are announced once, kindly.

### 4. The frame — no pause menu, no settings, and touch cannot pause

- Escape opens the journal card; there is **no pause menu** — no resume /
  settings / quit-to-title anywhere. The only route back to the title is
  finishing the game or F5.
- There is **no settings surface at all**: audio control is four unlabelled
  keys (M, N, `[`, `]`), master volume is hard-coded 0.85, sfx has no
  independent level, and none of it persists (the save schema has no
  preference fields; `muted` is a session `let`, systems.js:6901).
- **Touch players can neither pause, travel, mute, nor open the journal** —
  no HUD target calls `jrShow`, the touch legend has no audio row, and the
  collapsed fold still tells phones to press M/N/[/]. The title foot rail
  still shows ENTER/→/M/N keycaps on touch (`ROADMAP.md` §3).
- Calm-motion is read once at load (`sysCalmMotion` const, systems.js:1892);
  no in-game toggle. No key remapping, no text-size, no colorblind option —
  decide which of these are in scope and say so; a pause card is where they'd
  live.

**AAA principle:** options are player agency; every input surface (keyboard,
pad, touch) must reach pause, volume, and travel or the platform isn't
supported, it's implied.

### 5. The wall and the second chapter — difficulty and depth outliers

- **The salsa floor is the game's one true wall**: 114 ms step window, 8
  consecutive, one miss zeroes the combo (cali.js:68–72, 3764–3766). It blocks
  100%, not progression — but it is the single hardest thing in the game with
  no assist. AAA answer: invisible mercy — widen the window slightly after
  each failed streak (rubber-band the window, never the target), or a
  3-strike combo shield. Never a "skip" button; the crowd already escalates.
- **Pasto (chapter 2) is the weakest chapter on every axis at once**: 11
  tasks, one mini, no acts, 2 records, **one ambience sound** (`hiss`, three
  lines, systems.js:22830), 7 sfx calls (quay has 32). It is the second place
  a player sees, holding the steepest mechanic (condor soaring). Manly and
  Monaco are the other audio-thin rows (4 and 3 generic sounds) relative to
  their content weight; cali/goreme/drift are the other no-acts/one-mini
  chapters.

**AAA principle:** difficulty saturates, never gates; the second level is the
retention cliff and gets density before the finale does.

### 6. Replayability — set pieces that die when ticked (finish the v53 idiom)

The in-flight v53 work (uncommitted: cane run, Kyoto dry-crossing re-arm,
`cane-run` record, aria-live board) established the idiom. The parity sweep
found the stragglers, checked latch-by-latch:

- **rio.js:3280 — the calçadão run is the strongest find**: `if (rioCalcDone)
  return` at line 2 kills the whole 132 m span tracker, its four-stage tick
  ladder and the sparks payoff — the escalation is built and switched off, and
  the 132 m measurement has **no RECORDS row**. Exact pre-v53 torii shape.
- rio.js:3856 — Arpoador applause one-shot (22 people off their heels, once
  ever); inconsistent with the same file's wave-ride clap which re-fires.
- drift.js:3881 — the weathervane watch dies after one tick; `driVaneWatch` is
  the HUD's only wind readout.
- Venice measures the Rialto crossing and the calli span in metres and throws
  both away (venice.js:5041, 4552) — two records sitting unclaimed in the two
  2-record chapters.
- Deliberate and to be left: antarctic breach, venice flood / HK show
  frameShot gates (arguments in situ).

**AAA principle:** a set piece that can be performed can be re-performed and
measured; the record board is the endgame.

### 7. Shipping it — the non-code gate (from `ROADMAP.md`, still true)

- **LICENSE** — the one hard blocker, and an owner decision, not a batch.
- Pick a host, deploy, put the address in the README.
- CONTRACT.md triangle-budget reconciliation; stale count comments
  (systems.js:13954 "hundred and ninety-nine… seventeen places", 14558
  "Sydney is eighteen tasks").
- A final stranger's-eyes soak of all 19 chapters on the deployed address.

---

## Review — 1 Sep 2026, after R1–R4

The seven areas above are the 31 Aug snapshot and are left as written. What has
moved since, checked against the source rather than against the batch notes:

- **Every line number in §1–§4 is now wrong.** R1–R4 moved several thousand
  lines in `systems.js`; the references are archaeology, not addresses. The
  symbol names all still resolve, and those are what to grep for.
- **§6's premise is stale.** "The in-flight v53 work (uncommitted: cane run,
  Kyoto dry-crossing re-arm, `cane-run` record, aria-live board)" has landed —
  `cane-run` is in `RECORDS` at par 8 (`shared.js:2946`) and `cali.js` files it.
  R7's first bullet is therefore already done; the rest of R7 is untouched.
- **§6's other finds are all still live**, re-verified: `rio.js:3281`
  `if (rioCalcDone) return` still kills the calçadão tracker, and `calcadao` is
  a TASK (`shared.js:2069`) with **no** `RECORDS` row; `driVaneWatch` still
  zeroes; Venice's calli and Rialto crossings are both still one-shot and still
  measured-and-discarded.
- **§5 is unchanged and confirmed.** `caliBEAT_WINDOW` 0.19 beats,
  `caliDANCE_TARGET` 8, combo zeroed by `caliDANCE_DROP` — no assist of any
  kind. Pasto is still the thin chapter.
- **§7 is unchanged and confirmed.** No `LICENSE`; `package.json` still carries
  no `license` field, on purpose. One named stale count survives R2's sweep:
  `npc.js:8216` still says "Sydney is eighteen tasks" (it is nineteen), and the
  wider "seventeen"/"hundred and ninety-nine" prose drift across `src/` — around
  sixty lines — was deliberately left alone. **Counts as of now: 231 tasks, 19
  chapters, 56 records.**
- **§4's last bullet is still an open question and is not mine to close.** It
  asks somebody to decide whether key remapping, text-size and a colourblind
  option are in scope. R4 shipped the card they would live on and none of the
  three; R5 is touch parity and does not cover them either. **This needs an
  owner decision, like LICENSE does.**
- **Sizing.** R4 was written as one 2–3 h batch and is not one: ~800 lines
  across three files, a fourth storage key, a new audio bus and a new
  cross-module channel for calm-motion. R8 and R9 (a chapter's worth of
  ambience and sfx each) should be expected to run the same way.

## The batches

Ordered so the ship-blockers land first, each one commit, 2–3 h.

**Batch R1 — the first door.** ✅ **done 1 Sep 2026** (`8fc7aa8`). The exit zone
is the ferry wharf (x −43.4…−36.6, z −24.2…−17.6, ungated); the read-only board's
rows are disabled unless `jrDepart`; `to-pasto` and `wayClue` point at the wharf
and the "travel with Tab" line is gone; `homeHinted` now resets on `biome:enter`
(it was latched per session and the ferry crosses a border without touching
`jrTravel`); the slide is taught by two lines in Sydney, latched on a new `slid`
save field; the dive is on both legends. Probes: `qa/r1-door.js`,
`qa/r1-slide.js`, `qa/r1-slide2.js`, `qa/r1-hint.js`. Original scope:
Sydney exit zone in `homeOk` + a taught way out
(surface the ferry earlier or make the exit prompt appear as it does in the
other eighteen); `jrTravel` dead-rows clause; slide taught by one Sydney beat;
dive added to the legend (greyed or footnoted until ch12). Verify: fresh
localStorage, scripted first-session run reaches the departures board without
Tab; PNG of the exit prompt.

**Batch R2 — the last door.** ✅ **done 1 Sep 2026.** `showEnd` refuses to draw
the receipt until `sysFinDone`, so the lawn is the only ending on the default
path; the 231st tick anywhere but Sydney raises a place card ("THAT IS
EVERYTHING — go home to Sydney, the lawn is waiting") and the tick that lands
IN Sydney runs `sysFinaleCheck` instead; `sysEndSayHome` covers the returning
player whose restore triggers nothing; `ended` moved to `sysFinaleClose`, which
is what the ledger's "press Enter" line was actually promising. The four
`qa/pf2-*` fixtures are on 19 chapters. Differential (`qa/r2-lastdoor.js`,
stash/pop): before, MISCHIEF COMPLETE at +8 s over Antarctica with the game
paused; after, the home card and no ledger. `qa/pf2-finale.js` stages 19
souvenirs in chapter order; `qa/r2-horseshoe.js` measures all 19 at r = 2.60 m
and shoots `qa/r2-horseshoe.png`. `qa/pf2-finale2.js` still closes the lawn beat
and writes `fin: 1`. Stale counts fixed in the ledger header, `jrOpen`, and the
lawn block; the wider "seventeen" prose drift elsewhere in `src/` is untouched
and still stale. Original scope: Receipt suppressed (or rewritten to point home)
until `sysFinDone`; lawn remains the one true ending; update
`qa/pf2-finale.js` to 19 chapters and re-run it; PNG of the horseshoe with 19
souvenirs. Fix the stale count comments while in the file.

**Batch R3 — the save.** ✅ **done 1 Sep 2026.** `saveFlush()` on `pagehide` and
on `visibilitychange`-hidden (first statement in that branch), unconditional so
the journey clock is kept too, and gated on `started` so the title card never
manufactures a file. Unparseable non-empty bytes are moved to
`capy3.journey.broken.v1` by `saveRead` before anything can clear the key, and a
quarantine already on file is never overwritten. `saveClear` now removes the
album and the ghosts and drops both in-memory caches, matching what the confirm
copy promises. Three toasts, said once, after the game starts
(`saveSayDegraded`): storage that will not take a write — probed, not guessed —
a quarantined file, and `__capySoftGL`, which nothing had ever read. `told` is
gone from the written file. Probe: `qa/r3-save.js`, 11 assertions, all passing;
differential against stashed source failed all six items (the tick was written
nowhere and the reload found no file at all; the broken bytes were deleted; the
album and ghosts survived "start over"; neither toast was said). Original scope:
Flush on `visibilitychange`-hidden + `pagehide`;
quarantine unparseable saves (never `saveClear` over non-empty bytes);
`saveClear` clears album+ghosts to match its copy; the two toasts
(localStorage unavailable, `__capySoftGL`); kill the dead `told` field.
Verify with a scripted tick→hide→reload loop and a corrupted-save fixture.

**Batch R4 — the pause card.** ✅ **done 1 Sep 2026.** Escape opens a real pause
surface (resume / settings / the journey so far / quit to the title, the last
with a confirm whose copy tells the truth about the save); master, music and
effects faders with per-bus mutes; a "less motion" switch that works at runtime;
everything in a fourth key, `capy3.prefs.v1`, never in the journey file. Gamepad
Start opens it (it used to open the departures board, which has no resume).

Three things worth keeping: **`sysVOL_CEIL` stays 0.85** and the master fader is
a scale on it, so at the default the graph is bit-for-bit the one the ~110
hand-set sfx volumes were balanced on. **A third bus** (`acSfxBus`) now carries
everything that is not the score — the synths via the existing acMaster swap,
the room's wet return, the ambient bed and the weather voices — so "effects"
means effects. **Calm-motion became one channel** at the foot of `shared.js`
(`calmOn`/`calmSet`), replacing three independent module consts; the third copy
was in `weather.js`, so without it the switch would have moved everything except
two hundred tumbling petals.

Probes: `qa/r4-pause.js` (18 assertions — card, faders, per-bus gains, mute
echo, calm, prefs file, survival across reload, quit confirm, journal round
trip), `qa/r4-gaps.js`, `qa/r4-shot3.js` → `qa/r4-pause.png`. R1, R2 and R3
re-run green underneath it.

**Two defects found in review and fixed here**, both the shape R3 had just
removed from this file: `prefsFlush()` was on `pagehide` but not on
`visibilitychange`-hidden, so a slider moved with the card still open and the
tab then backgrounded was lost; and `sysPrefsOff` was written in two places and
read in none. Wiring it up exposed a third, in R3's own code: `saveSayDegraded`
had a single latch on the whole function and is called once at +700 ms, so any
degradation discovered LATER — a full store, which is size-dependent and passes
the two-byte probe — was silent for ever. It now carries one latch per sentence
and is idempotent, and the prefs writer calls back into it.

Original scope: A real pause surface on Escape (resume /
settings / journal / quit-to-title with confirm); master/music/sfx sliders and
mutes on it; a calm-motion toggle that works at runtime; settings persisted in
a fourth key (`capy3.prefs.v1` — not the journey file). Gamepad Start opens
it. Verify: settings survive reload; sliders audibly move each bus.

**Batch R5 — touch parity.** ✅ **done 1 Sep 2026.** One `MENU` button on the
touch layer, in the right-hand column with the chart and STUCK — the things you
read rather than aim at — never in the fan, which is what a thumb stabs at
during a chase. It opens R4's card, and that one button is the whole batch:
pause, the three faders and their mutes, the journal, the ledger, the album,
the records and the way back to the title were every one of them a keyboard
letter or Escape. The touch legend gained the row that says so; the title
foot rail no longer draws four keycaps naming keys a phone does not have.

**The find this batch existed to catch was not on the list: the departures
board was a trap.** Three wheeks at the way out opens it, it pauses the world,
and `.capyui-jr` had no pointerdown listener at all — the ledger and the album
have both closed on a tap on their surround since the day they were built, and
the one card a phone player can actually reach had not. Its own foot said "ESC
to stay". Measured before the fix: open, paused, surround tap does nothing, no
close control of any kind, and the only exits were to travel — an irreversible
move nobody asked for — or to reload a three-hour game. It now closes on its
surround like the other two, and five furniture strings that named ESC
(`sysScheme`) say the gesture instead. At the true ending, where a tap
anywhere reloaded, the surround becomes "stay" on touch so the ledger's own
promise can be kept; desktop behaviour is untouched.

**And R4's card was designed at 1280×720.** Measured at 390×844 with touch
emulation, **eleven of its controls were under 44 px** — four menu rows at 33,
three faders at 24, three mutes at 31×27 and the calm checkbox at 16×16. 44 px
is the floor in Apple's guidelines, 48 dp in Android's, and WCAG 2.2's AAA
target size. One touch-only media block grows the hit areas and nothing else;
all thirteen targets now clear 44.

Probe: `qa/r5-touch.js` under CDP media emulation (`page.emulateMedia` cannot
reach `hover`/`pointer`; `setViewportSize` moves pixels and nothing else), plus
`qa/r5-shot.js` → `qa/r5-hud.png`, `qa/r5-pause.png`. R1–R4 all re-run green on
desktop. **The probe had to be rewritten once:** it started the game with
`Digit1`, and the first real keydown removes the touch layer by design — it
reported the MENU button as a 0×0 box at the origin, with correct CSS and a
`display:none` parent. Everything in it is now done with a finger.

Original scope: A pause/menu HUD target on touch (opens R4's
card, which gives touch pause, travel, journal, mute in one move); touch
legend audio row; foot-rail keycaps hidden on touch; the `ROADMAP.md` §3 loose
ends. Verify under mobile emulation: pause, mute, travel, journal all
reachable by thumb.

**Batch R6 — the wall. Done, 1 Sep 2026.** One rule in `cali.js`: the salsa
window opens by 15% every time a streak is broken, four times and no further,
and shuts back to 114 ms the moment the eight land. The target never moves, only
a *miss* counts (being knocked off the floor already lapses the combo and is
documented as not a punishment), and nothing on the screen changes. **The condor
was measured and left alone** — see below, which is what the conditional in the
original scope asked for.

**The floor was measured first, and it deserved the change.** A scripted dancer
on the real code path — the tick is wrapped, so it sets `input.jumpPressed`
inside the frame and cali's own judge answers it — with Gaussian timing spread
σ, seeded so the same mistakes come in the same order:

| dancer | before | after |
|---|---|---|
| σ = 60 ms, near-clean | 1 attempt, 4.25 s | **1 attempt, 4.25 s — identical** |
| σ = 90 ms, the gate | 5 / 2 / 8 attempts (three seeds) | 2 / 2 / 3 |
| σ = 120 ms | **26 attempts, 65.4 s** | **3 attempts, 7.9 s** |

Paired: same probe, same seeds, run against stashed and current `cali.js`, with
the offset distributions agreeing to ±0.02 across the two passes. One run per
condition cannot separate a working assist from a lucky seed, so every starting
phase of each measured sequence was replayed through both rules — 134
realisations a condition, the real timing errors in their real order:

| | before | after |
|---|---|---|
| σ = 60, within 3 attempts | 100 % | 100 % |
| σ = 90, mean / median / p90 | 3.3 / 3 / **7** | 2.3 / 2 / **4** |
| σ = 90, within 3 attempts | 65 % | **86 %** |
| σ = 120, mean | **19.3** | **3.8** |

Both halves of the gate hold: ±90 ms clears within ~3 attempts (86 % do), and a
clean run does not notice — at σ = 60 the before and after runs are identical to
the frame, and 83 % of those dancers never earn a single step of mercy.

**The ceiling had never run.** Across all ten paired runs the highest mercy
reached live was 2, so levels 3, 4 and the cap itself had never once executed in
the game. A σ = 160 dancer walks the whole ladder — 131 → 151 → 173 → **199 ms,
capped** — clears on the fifth attempt, and the window shuts to 114 at the tick.

**And the record does not get the assist.** `salsa-dance` is one of the twenty
measured numbers and the floor keeps scoring for ever after the tick, so a
record set through a 200 ms window would not be the same number as one set
through 114 ms. Mercy increments only while the task is unticked and resets when
it lands: measured, the post-tick hit rate matches the pre-tick rate in every
condition (σ = 90: 0.867 → 0.863; σ = 120: 0.754 → 0.743).

**The condor does not need softening, and the measurement says so.** Four
scripted pilots on `thermal-peak` — within 15 m of the caldera, above the rim,
hanging off the talons, from a launch 104 m away:

| pilot | result |
|---|---|
| **none** — hands off the stick | never closer than **80.8 m**, dropped three times, no clear |
| **naive** — points at the mountain, 0.9 s between corrections, 0.55 s lag, never flaps | cleared on the **second** ride, 84 s |
| **average** — 18° aim error, five corrections a second, 0.32 s lag, flaps when slow | cleared on the **first** ride, 47 s |
| **good** — aims true, circles in lift | first ride, 33 s |

The zero-input row is the calibration and the reason to believe the other three:
`pasto.js` records that an unsteered bird "never came closer than 95.4 m" over
two minutes, and hands-off here reproduces that shape. So the task is not free —
and it is also not a wall: **a pilot who does nothing but point at the volcano
clears it**, because the flight model already carries its own invisible mercy
(the flap fires automatically below 5.4 m/s of airspeed, so the save arrives
without the player knowing the key exists).

That last clause is a finding, but it is a *legibility* one and not a difficulty
one, so it is left for R8 rather than done here: **the flap is never taught.**
`input.honk` is unbound in flight and bound to the wingbeat, the mount toast says
"hold on", and nothing ever mentions it. It is the difference between the naive
pilot's two rides and the average pilot's one — and neither of them fails, which
is why it is not R6's business.

Probes: `qa/r6-dancer.js` (the first baseline, 100 s a condition),
`qa/r6-mercy.js` (the paired differential, run twice), `qa/r6-cap.js` (the
ceiling), `qa/r6-condor.js` (four pilots, pumped in slices — a single
`page.evaluate` of that many hand-driven ticks dies at the ~20 s context limit),
`qa/r6-shot.js` → `qa/r6-floor.png`. R1–R5 re-run green, zero console messages,
build clean at 9065.8 KB.

**One probe defect worth recording**, because it produced a confident wrong
number: `r6-mercy.js` first sampled the window *after* the frame, and reaching
eight resets mercy inside the same frame that scores the eighth step — so every
clear in the run reported a 114 ms window and looked like proof the assist had
done nothing. It was the instrument.

Original scope: Salsa mercy (window widens ~15% per failed streak,
capped, resets on success — the target stays 8); condor's chapter-2 sting
softened only if a scripted average-input run says it needs it. Measure: a
mid-skill scripted dancer (deliberate ±90 ms jitter) must clear the floor
within ~3 attempts; a clean run must not notice the change.

**Batch R7 — replayability closeout. Done, 1 Sep 2026.** The last five set
pieces in the tree that switched themselves off the first time they paid out,
plus the three records the parity sweep left unclaimed. Every one of them was
the same single line — an `if (xDone) return` at the top of the checker — and
in each case the task keeps its latch while the THING re-arms.

| | first | again |
|---|---|---|
| rio calçadão | 181.4 m, ticked, line said | 181.5 m, no line |
| rio Arpoador | clap 5.7 s, ticked, line said | clap 5.7 s again, no line |
| drift vane | watched 42 s, ticked | watched 20 s — **was 0 before** |
| venice Rialto | 4.5 s, ticked, line said | 4.3 s the other way, no line |
| venice calli | 48.0 m, ticked, line said | 48.0 m, no line |

**The drift vane was the one that mattered beyond replayability.** It is the
chapter's only wind readout, and `long-gap` — the Drift's hardest task — is
impossible into the breath, marginal in calm and easy with it behind you. The
tick switched off the instrument at the exact moment the player learned it
existed. The ripple of paper off the post, and `driVaneWatch`, now run for the
life of the chapter.

**Three records, all three pars measured, machine floor first**
(`qa/r7-pars.js`, `qa/r7-pars2.js`, three runs each):

| record | floor / ceiling measured | task ticks at | par |
|---|---|---|---|
| `calcadao` longest run | **181.8 m** ceiling, of a 188 m band | 132 m | 165 |
| `the-calli` crossed | **48.0 m** hard ceiling | 36 m | 44 |
| `rialto` over the top in | **4.3 s** floor | — | 5.5 |

**A RECORDS key has to be a TASK id.** The chapter board and the picker both
look a row up as `RECORDS[taskId]` (systems.js), so the roadmap's working name
of `calcadao-run` would have filed a number nothing could ever show — the same
shape as the api-key mismatch that once seated five diners on thin air. The keys
are `calcadao`, `the-calli` and `rialto`. `hud.recordAudit()` now reports
orphans for exactly this, and the sweep is clean: **59 rows, 0 orphans.**

Also added: `hud.recordAudit()` — the board and the live attempt, which could
only be reached before by flushing the save and reading localStorage, and that
cannot see an attempt in progress at all — and `rio.clap()`.

**Two probe defects, both of which produced plausible wrong numbers.**
`V.rialto` is a METHOD: read without the parentheses it is a truthy function
object whose `.ax` is undefined, so every derived coordinate came out NaN and
serialised as null, and nothing threw. And **teleporting onto the calçadão does
not start a run** — the chapter spawns the animal ON the paving, so the tracker
was already armed with its start at x = 0, and the first measured "sprint" came
back as 91 m, which is exactly half the truth and therefore believable. She has
to walk on, from off it.

Verified by `qa/r7-rearm.js`. Zero console messages; build clean at 9076.7 KB.

Original scope: Land the in-flight v53 work; rio
calçadão re-arm + `calcadao-run` record (par measured, machine floor first);
Arpoador re-clap; drift vane watch re-arm; Venice's two measured-and-discarded
records claimed (`rialto-crossing`, calli span). Pars measured by scripted
runs, never guessed (see `capy3-the-second-hour`: a par below the machine floor
is unreachable by anybody).

**Batch R8 — the second chapter.** Pasto depth: an ambience bed with an
identity (páramo wind through frailejones, distant plaza band, the carroza),
positional sfx to at least the quay/cali floor (~20 calls), one act or second
mini, records to 3. Verify: `qa/eng-rate.js` free-play instrument (the one
that found Kyoto and Cali dead) before/after; ambience ladder branch grows
from 3 lines toward the kyoto/kowloon class.

**Batch R9 — audio identity, the thin three.** Manly and Monaco bespoke
ambience (Manly: rips, zinc, corso chatter; Monaco: marina halyards, the
tunnel echo, roulette rattle) and goreme/drift one distinguishing voice each;
optional: gentle music-under-sfx ducking on the ensemble bus if it can be
A/B'd honestly (see `capy3-the-mix` for the measurement traps).

**Batch R10 — ship.** LICENSE (owner decides; batch wires it: file, package
field, dist notice); deploy to the chosen host; README address; CONTRACT.md
budget reconciliation; full 19-chapter soak on the deployed address from a
clean profile, plus one private-window run to see the new toast.

R1–R3 are the ship-blockers. R4–R5 are the frame a store page assumes exists.
R6–R9 are the difference between "finished" and "polished". R10 is the door.
