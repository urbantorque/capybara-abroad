# Part N combined agent — extra anchors (read after WOW2-AGENT-BRIEF.md)

You are building ALL FOUR of N1, N2, N3, N4 as ONE agent, in that order, each with
its own commit(s). This is deliberate: N1/N2/N3/N4 all touch npc.js and/or
systems.js, and running them as separate parallel agents would race on those
files. Build them sequentially within yourself; nothing else is editing your
files while you run.

## Files you own for this whole session
src/systems.js, src/npc.js, src/environment.js, src/shared.js (narrow: the
`CHAPTERS` array's `kept` field per chapter and the `sysSAVE_SHAPE` two new
fields), src/props.js (if `physStageKeep`/`physSpawnKeep` need anything — check
before assuming; prefer calling what exists). Do NOT touch src/main.js or
src/weather.js — the V4 agent is live there.

## Anchors verified in the code today (20 Sep 2026)
- The finale block is `systems.js` ~36061–36340 ("THE LAWN"). `sysFIN_X = 30,
  sysFIN_Z = 26` (the picnic lawn), `sysFinaleStage()` (~36152, calls
  `ph.stageKeep` per keepsake — `physStageKeep(place, x, z, restY)` in
  props.js:2681, already idempotent/safe to call every entry), `sysFinaleCoda()`
  (~36277, the nineteen-note pass, already names each keepsake as it plays),
  `sysFinaleClose()` (~36326, sets `sysFinDone`, persisted as `fin`).
  `game.state.finaleOn` is set true when the finale stages — npc.js reads it to
  stand the gardener down (L6, E5) — read npc.js for exactly where before adding
  new gardener behaviour so you extend rather than fight it.
- `sysKEEPS` (systems.js ~6944) has the shape/name/line data per chapter
  (`sysKEEPS[biome].s` is SVG-shape data for the journal icon — for a physical
  shelf object you likely need simplified 3D primitives, not literally these SVG
  paths; low-poly, ≤ 60 triangles, PALETTE only, flatShading). `keepHeld(k)` and
  `physKeepOut(place)` (props.js:2704) tell you whether/where a keepsake prop
  currently is.
- The traveller: `npcTRAV_FIG` (npc.js:3307), `addTraveller(o)` (npc.js:3310) —
  ALREADY CALLED IN ALL 19 CHAPTERS at each chapter's own `way` mark (L8 F2 —
  `gateChap` gates the 15 non-original cameos to show only after
  `game.chapDoneHere(n)`), each with a `travSay`/`lines` pool and a stall
  (`npcMakeStall`) beside them (S1). So the "shop stall beside every board"
  N2 wants is ALREADY TRUE — read CONTRACT.md's F2/S1 entries (grep them) before
  building anything here; you likely only need to ADD the "stands at the board
  reading it, back to you, walks off when you're within 6 m" BEHAVIOUR to the
  existing 19 figures (a state machine on the existing `rec`, not new figures),
  and the `travSeen` COUNT (`npcTravCount()`/`npcTravMet` already counts "you
  stood within npcTRAV_MET_R" — read whether that IS the count the roadmap wants
  or whether `travSeen` needs to be a distinct "you specifically approached the
  BOARD, within 25 m, and they walked off" event — the roadmap's N2 wants the
  the latter, so it's likely a NEW counter, not a rename of the existing one;
  keep `npcTravMet`/`npcTravCount` exactly as is, since F2's shop/notebook logic
  depends on it, and add `travSeen` alongside it).
- The four ORIGINAL cameos (`gateChap` NOT set: Quay, Cappadocia/goreme, and two
  more — grep `game.addTraveller` calls without a `gateChap` property, or check
  which ones predate L6/L8) are "the four times the traveller does not leave" —
  N2 says these stay as they are; do not add the walk-off behaviour to those
  four specifically, only to approach-then-leave for the OTHER fifteen (or all
  nineteen if the four originals turn out to already behave that way — check).
- The shop stall's "seen" tally / "you again." line: `npcTRAV_STALL_LINE`
  (npc.js, appended to `rec.lines` in addTraveller — grep it) is what V2's
  report says exists; read it before adding a second one.
- Regulars: `npcPAL` (npc.js ~15175), `npcPAL_R`/`npcPAL_GIFT_T` etc (~15175–
  15370), `npcPalPick`/`npcPalSet` (~15468 and beyond) — tier tracked per
  chapter, `call`/`tiers` lines already exist, the first gift already exists
  (B8, `npcPAL_GIFT_*`). N3.1/N3.2 add: an absence line variant (gated on
  `jrChapMs`-derived "time since last visit" — `jrChapMs` (systems.js ~35397)
  is a per-chapter ACCUMULATED ms total, not a last-visit timestamp; you will
  likely need a new closure-local (not saved, per L11's "never re-base" —
  session-only is fine, or use existing `chapDoneHere`/enter-timestamps if any
  exist — grep `biome:enter` listeners in systems.js for a place to hook "time
  since I was last in THIS chapter" cheaply without a new save field) and a
  second gift past tier 3 (`npcPAL_GIFT_T = 3`, reuse `npcPAL_GIFT_*` constants'
  pattern, a second cooldown-gated object, never twice in a row).
- Companion: `compTRAITS`/`compBUILD` (systems.js ~42419–42450, kinds pigeon,
  cat, silver gull, gentoo, heron, ibis), `compTake(kind, from, span)`
  (~42587), `compSave`/`compRestoreFrom` (~42674–42690, `{kind, from}` on the
  save under `stow` — already in `sysSAVE_SHAPE`, no new field needed), and the
  "taken home" branch already exists at ~42746 (`if (to === compFrom) { ...
  compLeave(game.capy, 'home') ... }` inside what looks like a crossing/arrival
  handler) — READ THIS FULLY before building N3.3: the roadmap's "does not
  follow again; goes to its place (pigeon to the Campanile's ledge, gentoo to
  the colony, dog to its doorstep — one home() per kind)" may be PARTLY OR
  WHOLLY BUILT ALREADY (`compLeave(game.capy, 'home')` strongly suggests a
  'home' reason already exists in `compLeave`) — read `compLeave`'s definition
  (~42644) and write the finding down; you may only need to add the per-kind
  landing SPOT + one line + the sound + the notebook's `{ if: 'home' }` entry,
  not the whole mechanic.
- `nbFacts(n)` (systems.js ~29884) is the notebook's per-chapter fact-slot
  reader (`inc`, `pho`, `fed`, `ln` on the save) — N3.1's absence line should
  read through this exactly as the roadmap says, "never a stock line".
- The gardener is npc.js roster row 11 (`roster.push('gardener')` appears
  twice, npc.js:1219) with existing chase/carry beats (~4087–4096) and a
  scripted line pool (~297). It "stands down" on `game.state.finaleOn`.
- Journey/session save additions allowed: exactly `travSeen` (number or object
  keyed by chapter — match `npcTravMet`'s own shape) and `kept` (a count) — add
  both to `sysSAVE_SHAPE` (systems.js ~4295) beside `nb`/`stow`, write them in
  the save writer (~33233 region, beside `chapms:`), restore them beside where
  `jrFile.slid`/`jrFile.stow` are read (~36940 region, and wherever `nb`/`stow`
  restore). NO OTHER new save field — `tut` is already done by the T agent.
- Opening beat (N4.1): "be a menace." fires at systems.js ~37133 on arrival,
  guarded by `(landed && cdef.open) || 'be a menace.'` — the ten-second opening
  needs to run BEFORE that line is shown, on a FRESH FILE ONLY (no save at all,
  i.e. the very first boot before `startGame`'s non-restore branch even reaches
  the point where "be a menace." would show), skippable by any key within (the
  roadmap doesn't cap the skip window at a specific ms; make it immediate on
  any keydown/click), never on a restore. The nap pose exists (grep `capyNap`/
  `nap` in capybara.js — READ ONLY, do not edit capybara.js; if the opening
  needs the animal literally posed asleep before `started`, check whether that
  is even renderable pre-start, or whether the simplest honest build is: the
  card sequence plays over a fixed establishing shot of the sleeping animal
  and the traveller's figure — using the SAME traveller figure/builder as N2
  (`npcTRAV_FIG`) placed once, walking off, while the title card is still up
  or just after Begin — pick whichever is actually achievable without a new
  render mode, and write down which you chose and why).
- Morning after (N4.2): after `fin` (`sysFinDone`), stage the shelf (N1) with
  all nineteen (already true once N1 ships and `sysFinaleAll()` is true), the
  traveller sits at the horseshoe's mouth (reuse the finale traveller instance
  built once — npc.js ~5076 `npcTravFin = addTraveller({...})`, read that
  block fully, it is exactly "the finale's own figure" the roadmap's N1/N4
  refer to), the gardener's stand-down becomes a sit-down beside them (one more
  state on the gardener's existing behaviour tree), the board's "again" gets a
  `fin` variant for the eleven chapters that have none (grep `again:` in
  `CHAPTERS`, shared.js, count how many already have one vs eleven without,
  write a `fin` line per missing chapter in the game's third-person voice).

## Order to build in, each with its own commit(s)
1. N1 — the shelf (environment.js: the stone shelf mesh at the horseshoe,
   `game.state` nothing new needed since it's driven by `sysFinaleStage`;
   systems.js: the keepsake-placement hookup calling `physStageKeep` per held
   keepsake the moment the animal next stands in Sydney — reality-check
   whether `sysFinaleStage` already does exactly this for the FINALE case and
   you just need to trigger the same call earlier/always rather than only at
   `sysFinaleAll()`; the place-card "the shelf has N things on it..." sentence;
   the gardener's per-keepsake line in npc.js, from a new `kept` field per
   CHAPTERS entry — write these nineteen lines yourself, one clause each, the
   game's third-person "it" voice, checked by `qa/lines.mjs`/`qa/l6-tics.mjs`
   for the ≤3-files-per-phrase rule).
   Instrument: `qa/wow2-shelf.js` — three saves at 0/7/19 keeps (you can force
   `keepHeld`/write props/save state directly in the page for this, it's a
   state assertion not a live-earn), shelf count == ledger count on Sydney
   arrival, the gardener's line fires once per new keepsake and never twice.
2. N2 — the glimpse (npc.js: the traveller's stand-at-board/walk-off behaviour
   on approach within 25 m for 90 s then leaves at 6 m, per-chapter cameo
   lines `npcTRAV_GLIMPSE` (19, third-person, what the traveller was looking
   at, never you); systems.js/shared.js: the `travSeen` counter, the shop
   stall's past-ten "you again." (verify not already built) and past-nineteen
   finale line).
   Instrument: `qa/wow2-glimpse.js` — travSeen reachable 19/19 by walking to
   every board (this can be a fast teleport-and-settle walk per chapter, one
   run-code per chapter or per few chapters, respecting the ~4 min/invocation
   rule and trap 40's "pin the body, re-assert reach" for anything that treats
   the animal as stationary); the figure never inside the arrival frame; zero
   glimpses in an unapproached chapter.
3. N3 — someone waits (npc.js: the absence line variant, the second kept gift,
   the six companion homecomings; systems.js: the time-since-last-visit hook
   if npc.js needs one exposed from there).
   Instrument: `qa/wow2-waits.js` — the absence line on a 20-min-away return
   and not a 5-min one (you can fast-forward game time / manipulate the
   session-local last-visit clock directly rather than actually waiting 20
   real minutes — say which you did); the kept gift once per qualifying
   return; the homecoming for all six companion kinds (pigeon, cat, silver
   gull, gentoo, heron, ibis).
4. N4 — the morning after (systems.js only): the opening ten seconds on a
   fresh file, skippable, never on a restore; the morning-after staging on a
   `fin` file in Sydney; the `fin` variant `again` lines for the eleven
   chapters missing one.
   Instrument: `qa/wow2-morning.js` — the opening plays once on a fresh file
   (never on a restore), skipped by a keypress; the morning-after scene stages
   on a forced `fin` save in Sydney.

## Writing rules (roadmap's own, repeated because they matter)
Third-person "it" voice everywhere. The why is never said, only seen. No new
save field beyond `travSeen`, `kept`, (`tut` already exists). Every line goes
through `npcLINES`'s pools or a `CHAPTERS` field and must pass `qa/lines.mjs`
and `qa/l6-tics.mjs` (no phrase in more than three files) — run these after
adding lines, before committing.

## Report
When all four are done: one ≤ 60-line report (a bit longer than the standard
40 is fine, you're covering four sub-items) — what shipped in each of N1-N4,
what was found already built and where, the measured numbers, any item
skipped and why, commit hashes, and the "### N1", "### N2", "### N3", "### N4
— shipped" blocks appended in ROADMAP-WOW2.md under Part N.
