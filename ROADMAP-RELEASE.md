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

**Batch R4 — the pause card.** A real pause surface on Escape (resume /
settings / journal / quit-to-title with confirm); master/music/sfx sliders and
mutes on it; a calm-motion toggle that works at runtime; settings persisted in
a fourth key (`capy3.prefs.v1` — not the journey file). Gamepad Start opens
it. Verify: settings survive reload; sliders audibly move each bus.

**Batch R5 — touch parity.** A pause/menu HUD target on touch (opens R4's
card, which gives touch pause, travel, journal, mute in one move); touch
legend audio row; foot-rail keycaps hidden on touch; the `ROADMAP.md` §3 loose
ends. Verify under mobile emulation: pause, mute, travel, journal all
reachable by thumb.

**Batch R6 — the wall.** Salsa mercy (window widens ~15% per failed streak,
capped, resets on success — the target stays 8); condor's chapter-2 sting
softened only if a scripted average-input run says it needs it. Measure: a
mid-skill scripted dancer (deliberate ±90 ms jitter) must clear the floor
within ~3 attempts; a clean run must not notice the change.

**Batch R7 — replayability closeout.** Land the in-flight v53 work; rio
calçadão re-arm + `calcadao-run` record (par measured, machine floor first);
Arpoador re-clap; drift vane watch re-arm; Venice's two measured-and-discarded
records claimed (`rialto-crossing`, calli span). Pars measured by scripted
runs, never guessed (see `capy3-the-second-hour`: a par below the machine
floor is unreachable by anybody).

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
