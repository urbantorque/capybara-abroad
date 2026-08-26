# BATCH 2 — The payoff, and chapters 1-3 (Payoff Pass)

Started 25 Aug 2026, on `claude-opus-5`. Brief: `qa/PAYOFF-PROMPTS.md` § BATCH 2.
Predecessor: `qa/BATCH1.md` (complete, all green, CONTRACT v23).

## Carried in from batch 1

- The mischief economy and the auto-loaf ARE in the tree, so job 4 pillar 2 has
  something to certify. Harnesses: `qa/pf-mischief.js`, `qa/pf-loaf.js`.
- `capy.loaf` (0..1) and `capy.loafAsk` are published — a chapter that wants the
  animal to sit where the rest timer cannot reach writes `loafAsk = 1` per frame.
  **The finale wants this.**
- `game.physics.rescue(prop)` and `game.physics.typeOf(type)` are new exports.
- A local may leave its anchor while `r.own` is set — any anchor-distance audit
  must gate on that.
- Save format unchanged by batch 1; old files restore.

## Checklist

### Job 1 — the finale  ✅
- [x] Map the current end: `showEnd`, `chapterCeremony`, `chapComplete`,
      `doneCount >= TASKS.length` scheduling in systems.js
- [x] Stage the seventeen keepsakes in the Botanic Gardens (via `stageKeep`,
      new — `spawnKeep` is idempotent and therefore cannot arrange anything)
- [x] Gather a cast — **CLOSED 26 Aug by the closeout run** (`qa/CLOSEOUT.md` § A1).
      Built as npc.js's `gather` state on the `resit` idiom, exactly as sketched below;
      3 people arrive at 7, 9 and 12 s and hold. ~~PARTIAL. The loaf and the calm field carry the moment.~~
      **Sydney registers ZERO `game.locals` and zero critters**: it uses
      npc.js's older `humans[]`/`stepHuman` cast instead. A gathering therefore
      needs a new npc.js state with a `thinkHuman` early-return, on the terrace
      patrons' `resit`/`seated` idiom (slots assigned once, arrival test plus a
      hard ceiling, then damp yaw and position). Deferred to job 4 pillar 2,
      where that same cast is being audited anyway.
- [x] One last postcard beat, then the ledger
- [x] Survives save/reload; revisitable; guarded on `chapComplete` not elapsed time
- [x] Certified from the rendered PNG (and the PNG changed the design twice)

### Job 2 — the album  ✅
- [x] Size-capped thumbnails persisted — own key `capy3.album.v1`, 288x180 JPEG
      q0.72, ~6 KB each measured, 36 cap, evict-oldest-and-retry on quota
- [x] Album card in the journal (the LEDGER'S SIBLING — the journal has no page
      mechanism at all, so a "page" was never available without restructuring)
- [x] One gentle photo prompt per chapter, on the ceremony, only when there is
      no picture of that chapter yet. Ticks nothing, counted nowhere.
- [x] Title-screen postcards prefer the player's own photos

Measured: 0 pictures -> button hidden; 3 taken with real K/Enter -> button
live, 17541 chars, captions from `weather.label()` ("Sydney · Harbour Midday ·
0:09" — only its second reader ever); survives reload byte-identical; card
shows 3 figures whose images DECODE at 288x180; Escape closes and unpauses;
`lastError` null. Title card: 1 of 17 tiles carries the photo, the other 16
correctly fall back to their authored marks.

### Job 3 — the first hour  DONE
- [x] Measure fresh-save Sydney: time to each verb, hint cadence, first find,
      first travel unlock, first ceremony
- [x] Re-hinted (re-ordering was the wrong tool - see below) so every core verb lands inside 10 min
- [x] NO new tasks — re-hint and re-order only

### Job 4 — the five pillars on chapters 1-3  DONE
Sydney · Pasto · Circular Quay
- [x] 1 Marquee certification — CERTIFIED, and "framed" FAILS in all three (four channels, from the PNG at the moment)
- [x] 2 The cast — **CLOSED 26 Aug by the closeout run** (`qa/CLOSEOUT.md` § A2): the
      witness chain and the produce reaction now reach both chapters, measured by
      differential (0 -> 2 chain calls, 9 and 4 people facing the reaction). Ownership
      does not port and is recorded as open, not faked. ~~the mischief economy does not
      reach ch 1-2 (finding A)~~
- [x] 3 Feel of the ground — fixed ch 3 footfall (half the chapter was wrong) (footfall/slip/particles, wetness, room tone, mood, loaf)
- [x] 4 The signature toy — named for all three; Sydney's has no readers (D)
- [x] 5 Route life — measured; two real dead patches (E) (no purposeless dead 20 m cells)
- Chapter notes: oldest and most-audited, so expect tail misses. Keep the gardens
  clean enough to stage job 1. **Quay is 132,423 tris against a 130k budget — no
  heavy geometry; list reallocation candidates for batch 4.**
- Cheap wins flagged by batch 1: Quay's gull registers with the critter registry
  but has no `bold`/approach; Quay has only 1 edible prop, Sydney 7, Pasto 13.

### Finish
- [x] CONTRACT.md new version section
- [x] qa audits for new invariants (qa/verbs.mjs)
- [x] Project memory (capy3-payoff-batch-two)
- [x] This file as the handover
- [x] `playwright-cli close-all`

## NOTE ON THE CHAIN

**Batch 1 did not chain batch 2.** The `capy3-batch-2` scheduled task was never
created — most likely the scheduled-tasks tool was refused by the permission
classifier mid-run, which is the same refusal the setup session hit. Batch 2 was
started by hand instead. Do not assume the chain works; if batch 3 must run
unattended, verify the task exists after this batch writes its handover.

## Log

- Started. Checklist written. Scouted the three job areas before touching code.
- **Found and fixed before job 1: the loaf was given away before the first
  keypress.** `capyRestT`/`capyStillT` accrued behind the title card, so six
  seconds on the menu put the loaf at 0.54 and pressing start put it at 1.00
  within a second — every new player's first sight of the animal was it already
  sitting, camera wide, score soft. Only Sydney shows it (every other chapter
  arrives through a teleport, which zeroes both). Commit `88eb571`.
- Job 1 (the finale) built and verified. See below.

## JOB 1 — THE LAWN, as built

`CONTRACT.md` § THE LAWN. Come back to Sydney with all seventeen chapters done
and the seventeen souvenirs are laid out on the picnic lawn in a horseshoe;
walk into the mouth of it and **sit down** and that is the ending — the loaf,
then a line, then the ledger. The last thing the game asks is the first thing
it taught you to do for its own sake.

- `physStageKeep(place, x, z, restY)` — new in props.js, published as
  `game.physics.stageKeep`. `physSpawnKeep` is idempotent, which is exactly what
  stops a caller ARRANGING the seventeen, so this is the mover: spawn if absent,
  otherwise pick up the existing one and set it down where asked. Clears
  velocity/angular/force/torque, sleeps the body, and moves `homeX/Y/Z` with it.
- `sysFinaleCheck/Stage/Step/Close` in systems.js, plus `fin` in the save
  (additive, `v` does not move).
- **Two doors in**, because Sydney is the one chapter that emits no
  `biome:enter`: the biome:enter handler for a return, and the `else` branch of
  `startGame`'s `landed` test for a restored file that opens straight into Sydney.
- **Staged every time, closed once.** Leaving Sydney clears the staging flag
  because props.js huddles all seventeen at the next chapter's spawn on the way
  out. `fin` only suppresses the closing beat.

### Measured

| check | result |
|---|---|
| staging | 17/17 laid, `homeY` 0.00 (the surface — not double-counted) |
| control: loafing at the spawn, outside the ring, 11 s | ledger did NOT open |
| sitting inside the ring | fired at second 11, `paused` true, ledger shown |
| ledger contents | `MISCHIEF COMPLETE · 199 of 199 · 17 of 17 places · 17 kept` |
| save | `fin: 1` persisted |
| `state.lastError` | null throughout |

### TWO COMPOSITION FIXES THE SCREENSHOT FOUND, AND ONE STILL OPEN

1. **Radius 4.2 m read as litter.** A keepsake is a 24 cm box; seventeen at
   1.55 m spacing is seventeen specks over eight metres of lawn. 2.6 m puts
   them 96 cm apart and the whole group in one frame. **Radius is a composition
   number, not a geometry one, and only the PNG can tell you.**
2. **A closed ring puts a souvenir between the shoulder camera and the animal
   at every approach angle** — the capybara was behind a jar in its own ending.
   Now a horseshoe with a ~100° mouth aimed at the spawn, which is also the
   better meaning: these are things you set down in front of you, not a circle
   you are surrounded by.
3. **STILL OPEN — the keepsakes vary enormously in visual scale.** (see below) The physics
   shape is a uniform 0.12 box but the drawn parts are not: Rio's is a tram
   roughly two metres long and Cappadocia's is a waist-high jar, while others
   are a hat or a stone. At 2.6 m the big ones still crowd the frame. Options
   for a later pass: sort the horseshoe by drawn size so the big ones sit at the
   horns, or give the finale its own wider camera. Not blocking — the moment
   works and is verified — but it is not yet as good as it should be.

## JOB 2 — THE ALBUM, and the trap that cost the most time

**THE DECLARATION-ORDER TRAP.** `sysALB_KEY` and `albShots` had to move to the
top of systems.js beside `sysSAVE_KEY`. The title card asks the album for a
postcard WHILE IT BUILDS, and the title card is built earlier in the file than
the album's own block. Two ways of getting it wrong, and the second is worse:

- as `const`, the read threw a ReferenceError — swallowed by the try/catch;
- as `var` it stopped throwing and **cached an empty album for the session**,
  because the declaration hoists but the assignment does not, so the key was
  `undefined` and `localStorage.getItem(undefined)` answered null.

Both measured identically from outside: 0 of 17 tiles, no error anywhere, and
`albumAudit()` called a moment later reported the album perfectly because by
then the assignments had run. **If a thing is read during construction, declare
it above the constructor, not beside its friends.**

**AND A HARNESS TRAP THAT INVALIDATED TWO RUNS:** `playwright-cli close-all`
then `open` is a FRESH BROWSER CONTEXT and localStorage does not survive it. A
script that writes a save, then close-all/opens, then checks, is measuring an
empty store and will report the feature missing. Take the pictures and check the
title card in ONE session. This is a sibling of harness traps 8 and 10 in
[[headless-qa-harness]] and belongs with them.

## Screenshots
`qa/PF2-lawn2.png` (the seventeen staged) · `qa/PF2-approach.png` (loafing among
them) · `qa/PF2-album.png` (the album card) · `qa/PF2-picker.png` (the title
picker, Sydney's tile carrying the player's own photograph).

## JOB 3 — THE FIRST HOUR

**MEASURED, on a fresh save, live.** The opening window is four rows —
`wheek` / `steal-hat` / `coffee-spill` / `picnic-thief` — and only the pinned
row shows a clue. So a new player is told **Q** explicitly, **E** and a "run"
obliquely, and nothing else. The in-game legend does list all six core verbs,
but the paper never said two of them out loud.

**THE DEFECT: SYDNEY SPENT THE WORD "CLIMB" TEN CHAPTERS EARLY.** `cafe-table`'s
clue read *"climb up onto the tabletop"*. The action is a HOP, and CLIMB is a
real, distinct verb this game does not hand over until chapter 11 — capybara.js
says so in its own comment. A player who remembers that word goes looking for a
wall. Now *"hop up onto the tabletop with Space"*.

Also `coffee-spill` said *"barge them at a run"* and never named the key. Now
*"hold Shift and barge them"*, matching the voice of the clues that already name
keys (`press Q, anywhere`, `grab it off their head with E`, `hold E on the soil`).

**Measured before and after with `qa/verbs.mjs`:** before, **no clue in any of
the 199 tasks named Shift or Space at all**. After, both are first named in
chapter 1.

**RE-ORDERING WAS THE WRONG TOOL, and this is the finding worth keeping.** The
brief asked for every core verb inside ten minutes, and the obvious move is to
pull the hop row forward. It is wrong: Sydney's rows 1-12 are the gardens and
the forecourt (east, x 14..62), rows 13-19 are the quay (west, x -46..-14), and
the café terrace is 39 m west of the spawn. Moving `cafe-table` into the first
window sends the player across the chapter and back for a keystroke, breaking
the east-then-west shape the order already has. **The order is good; the words
were wrong.**

**AND ONE THING THAT CANNOT BE FIXED UNDER THIS BRIEF — reported, not hidden.**
Nothing in Sydney's gardens half requires a hop at all. `opera-stage` looks like
it should, and does not: the podium is a STAIR whose treads are 0.17 m, which
environment.js calls "the largest step the capybara reliably walks up". So Space
is genuinely not exercised until row 13, about sixteen minutes in at 75 s/task.
Closing that needs either a new task or something hoppable in the gardens — both
are "add a task", which this brief forbids. **It belongs in a later pass.**

## NEW AUDIT — `qa/verbs.mjs`

A clue may not name a verb the player has not been given yet, and every
advertised key should be named by some clue. Static, no browser, sub-second.

**It was false-green when first written and the reason generalises.** The
blocker test was `new RegExp('\b' + verb + ...)`. The heredoc that wrote the
file ate one backslash of each pair, so the pattern became a literal backspace
character and matched nothing — the audit passed clean against the very clue it
existed to catch, while its *other* checks (regex literals, which survive) kept
working and made it look alive. **Proven by differential:** stashed, it now
prints `BLOCKER ch1 cafe-table names "climb"` and exits 1; restored, 0 and 0.
No regex is built from a string in that file any more.

## JOB 4 — THE FIVE PILLARS, CHAPTERS 1-3

All three chapters audited statically against the five pillars, then the
findings that were safe to close were closed and measured. **The three chapters
agree with each other, which is what makes the big findings credible.**

### FIXED AND MEASURED

**1. Half of chapter 3 had the wrong footstep for its entire life.**
`capySurfacePitch`'s quay ladder was written as if z grew toward Manly. It does
not: the Quay is z 0..46 and Manly is z = -556, so `if (z < 16) return 1.22`
swallowed the whole far end — the beach, the Corso and the chip shop all
footfalled as hollow wharf timber — and the `0.82 // the sand at Manly` line
beneath it was UNREACHABLE CODE, since the only way to reach it was z >= 46,
which is behind the apron. Nothing could ever have reported this: a wrong pitch
is not an error. Now routed through the chapter's own `inZone`.

Measured after: apron (0,30) -> apron only; beach (118,-562) -> manly; Corso
(118,-582) -> **corso AND manly both true**, which is why corso must be tested
first — the corso rect is inside the manly rect, and the broad test would
otherwise make the paved street sand.

**2. The apron gull could never be approached.** `quay.js` registered its only
critter with no `bold`, which the registry defaults to 0, so `appr` never left
zero and batch 1's whole "a settled capybara is approached rather than fled
from" inversion was dead in the chapter. Given `bold: 0.9` (the same as Manly's
gulls — they are the same birds). **Measured, sitting still on the apron:**

    s   loaf   calm   appr    near
    1   0      0.02   0       3.45
    7   0.54   0.42   0       2.59
    8   0.95   0.52   0.393   1.44
    10  1.00   0.69   0.868   0.26
    14  1.00   0.87   0.900   0.16

The flee radius collapses 3.45 m -> 0.16 m. Before, it could only ever have
reached ~2.8 m on the calm field alone.

**3. Two chapters' loudest cues were mono.** Pasto's church bell called
`sfx('pop')` — a bronze bell in a tower, playing a pop, from nowhere, while
`pastoBellPos` sat on the line above already being handed to the event. Now a
pitched-down `chime` placed at the tower, near 9 / far 150 so it carries across
the plaza and up Galeras. Chapter 3's arrival at Manly — the payout of its wow —
fired `horn` and `chime` with no `at:` on a hull whose position was in scope;
both now play from the boat. The approach calls seventy lines above had been
doing it correctly all along.

### FOUND, EVIDENCED, AND DELIBERATELY NOT FIXED HERE

These are systemic and too large to land safely at the end of this batch. They
are not "nice to have" — the first one means the first two hours of the game are
the two hours with the least reactive world.

**A. THE MISCHIEF ECONOMY IS GATED ON `locals`, AND CHAPTERS 1 AND 2 HAVE NONE.**
Batch 1 reported "13 of 15 locals chapters carry two of the three chains", which
is true and hid this: Sydney and Pasto are not locals chapters at all.
- `localOwnerOf` scans `locals` (`npc.js:1662`), so ownership/retrieval cannot
  fire in Sydney or Pasto.
- The 20 m chain lives inside `localsStep`, which opens `if (!locals.length)
  return;` (`npc.js:2014`) — nothing in either chapter ever makes a second
  person turn their head.
- Sydney gets produce/shoo only through a Sydney-specific duplicate
  (`npc.js:3903`), which is itself gated by `biomeLive()` — hard-coded to
  `isActive('sydney')` (`npc.js:7072`). **So Pasto's 13 edible props can start
  no reaction whatsoever.**
- Chapter 3 has 10 locals but its props all scatter in one annulus about (4,26),
  and `npcOWN_R` is 11 m from a prop's home — so ownership reaches 2 of 10, and
  the boat deck has no props at all.

**B. NO CHAPTER CAN FRAME ITS OWN MARQUEE.** `camYawTarget`/`camDistTarget` are
systems.js module-locals with no public setter, so "framed" — the first of the
four channels — is not a channel any biome can opt into. It is absent in all
three chapters because it is absent everywhere. **Measured in Sydney:** walking
onto the Opera House podium the camera collapses from 7.2 m at 45 degrees to
3.05 m at **68.6 degrees**, and that is exactly where `opera-stage` fires — the
one chapter-defining silhouette in the game, and at the moment it pays out the
camera is jammed against the sails looking down. It recovers to 45.6 degrees
about a metre further on. Screenshot `qa/PF2-marquee-sydney.png`.

**C. "LIT" IS ABSENT IN CHAPTERS 1 AND 2.** Twelve chapters have a row in the
event grade layer (`systems.js:13830-13905`); Pasto has none, so riding a condor
off a live volcano changes no bloom, threshold or vignette. Sydney touches no
light on any task.

**D. Sydney's signature toy has no readers.** `api.vanRiding()`
(`environment.js:3037`) has ZERO readers in the entire repo — no NPC line, no
camera change, nothing thrown at the queue. The chapter's one unique verb is a
12-second timer with a chime.

**E. Route life — two real dead patches.** Sydney `x[-70,14] z[40,70]`, about
84 x 30 m, is empty of trees, beds, paths, props and NPC waypoints: walking
north from the spawn, the most natural first input in the game, is 30 m of blank
lawn ending at an invisible wall. Pasto has an ~18 m bare annulus at d 42..60 m
from Galeras — shrubs stop at 60, frailejones start at 42 — exactly where the
climb begins. Chapter 3's crossing is healthy apart from one 68 m band at
z -346..-416 with nothing within 140 m of the track.
