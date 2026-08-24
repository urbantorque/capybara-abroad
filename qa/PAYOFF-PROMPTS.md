# THE PAYOFF PASS — four batch briefs

The next campaign for capy3, split into four batches that run one after another as local
scheduled tasks. Each batch reads its own section here, does the work, writes a handover,
and schedules the next batch.

Written 24 Aug 2026. The assessment behind it: the machine is built (17 chapters, ~200
tasks with acts, 34 place finds, keepsakes, journal/shelf/ledger, locals with wariness and
familiarity, a calm field, room reverb, photo mode, grazing). What is missing is PAYOFF —
chaos has readers in the music but almost no witnesses among the people, calm rewards
stillness but nothing invites it, the ending is a ledger card rather than a moment in the
world, and postcards leave the game the instant they are taken.

---

## COMMON PREAMBLE — applies to every batch

Working directory: `C:\Users\roger\OneDrive\Desktop\capy3` (git repo, branch `master`).

This is a long autonomous run. Work end to end, commit as you go, and do not stop to ask
questions — nobody is watching.

**Model:** every batch runs on Opus 5. This is pinned in `.claude/settings.json` as
`"model": "claude-opus-5"`, so it applies to any session started in this directory
including the chained scheduled tasks. Do not change it, and if a run finds itself on a
different model, say so in the handover.

**ORIENT once, then stop reading broadly.**
- `CONTRACT.md` in the repo root is the locked module contract. Read its section list and
  the sections you need; it is thousands of lines.
- Project memory is at
  `C:\Users\roger\.claude\projects\C--Users-roger-OneDrive-Desktop-capy3\memory\`,
  and `MEMORY.md` there is the index. It carries the traps every previous pass paid for.
- Do NOT read whole source files. `systems.js` alone is 16k+ lines. Grep for what you need
  and read only those ranges.

**CONTEXT DISCIPLINE — this is what keeps a long run from drowning.**
- First act: write `qa/BATCH<N>.md` as a checklist and tick items as you go. If your
  context is compacted, that file is your memory of where you were.
- Delegate every measurement sweep and every per-chapter pass to a subagent — one per
  chapter or per audit — reporting findings only, in a few lines. Apply fixes on the main
  thread. Never hold more than one chapter's detail in context at a time.
- Commit after every job and every chapter. Never save commits to the end.

**THE VERIFICATION STANDARD, which this project has been bitten by ignoring.**
- `node server.mjs` with `PORT=5188`, then drive the game under `playwright-cli` for
  anything timing-, audio- or rAF-dependent. The hand-driven `game.tick()` loop never
  unlocks the AudioContext and hides a whole class of bug.
- Judge framing and lighting from the RENDERED PNG, never from metrics alone.
- Prove every fix with a differential: `git stash push -- src/x.js`, `node build.mjs`,
  re-open, run the SAME script, `git stash pop`. A single green run does not distinguish
  "my fix works" from "this was never broken".
- Start any run that asserts on task state by clearing `localStorage` — the game saves to
  `capy3.journey.v1` and completed tasks survive a reload.
- `playwright-cli close-all` at the end.

**FINISH EVERY BATCH THE SAME WAY.**
1. Update `CONTRACT.md` with a new version section describing what changed.
2. Add or extend qa audits for any new invariant.
3. Write project memory for what the batch found.
4. Write `qa/BATCH<N>.md` as the handover note for the next batch.
5. Chain the next batch — see "CHAINING" at the bottom of this file.

---

## BATCH 1 — Foundation and comedy

### Job 1 — baseline audit. Fix what you find.

**(a) Fresh-save playthrough soak.** Drive a complete fresh-save journey through all
seventeen chapters. Approach tasks from two directions and from mid-chapter states; save
and reload at hostile moments (mid-carrier, mid-dive, mid-ceremony, mid-act) and verify the
restore; verify act sequencing and what the paper shows at each step. Extend
`qa/pacing.mjs`, `qa/audit-tasks.mjs`, `qa/lines.mjs` and `qa/fuzz.js` — do not rewrite
them.

**(b) Solidity, phasing and NPC health** on chapters 14-17 plus spot regression on 1-3, via
`qa/audit-solid.js` and `qa/npchealth.js`, gating on the LIVE biome only. The cry-wolf
detector list is in memory (`capy3-the-second-pass`) — do not chase those.

### Job 2 — the mischief economy

The aesthetic law is the Untitled Goose Game benchmark: the delight is being WITNESSED.
`game.state.chaos` drives the music and the calm field and almost no person. Build a
reaction layer in `npc.js`:

- **Ownership.** A local whose prop is taken or knocked over follows to retrieve it. Give
  the state a HARD CEILING — the catch-all-state rule. A steering state without one is how
  the waiter went forty seconds and never once reached a table.
- **Produce.** Grazing someone's produce earns a line and a shoo.
- **Chains.** One witness reacting draws a second look from another.

Then land the unfinished wind intent from Delight Pass wave 1: a gust must be able to blow
a light prop across a square. The stiction-cliff analysis and the numbers are in
`CONTRACT.md` v21 — it needs a turbulent kick plus a speed cap, because a prop's terminal
velocity under drag alone IS the wind speed, so drag gives a cliff with no band between its
sides.

**Adoption:** at least two authored reaction chains per chapter, using only the people and
props each chapter already has.

### Job 3 — stillness as a verb

An auto-loaf after sustained `capyRestT` — **NOT `capyStillT`**, which is zeroed by
`heldProp` and correctly so; reading it here collapses the moment you pick anything up.
Sit posture on the capybara, the camera eases slightly wider, `musCalm` swells, and past a
calm threshold the critter registry INVERTS: approach instead of flee, per species. No new
buttons; the control scheme is settled and wheek and whistle are one voice.

Iceland's hot spring is the marquee adoption — a real soak, steam, the score going soft.

---

## BATCH 2 — The payoff, and chapters 1-3

Read `qa/BATCH1.md` and the newest `CONTRACT.md` section for what batch 1 landed. If the
mischief economy and the auto-loaf are not in the tree, note it in your report and build
jobs 1-3 anyway; only job 4's pillar 2 depends on them.

### Job 1 — the finale

Completing all seventeen chapters currently just opens the ledger after the last ceremony
(`systems.js`, `doneCount >= TASKS.length`). Build a real ending in the world: returning to
Sydney with everything complete stages the seventeen keepsakes — `physKEEPS` are real props
— somewhere visible in the gardens, gathers a small cast from systems that already exist
(locals, critters, calm), gives one last postcard beat, and only then opens the ledger. It
must survive save/reload and stay revisitable.

Mind the ceremony-scheduling trap: guard on `chapComplete`, never on elapsed time alone, or
a card scheduled at +2900 ms fires after the chapter has already been finished inside the
wait.

### Job 2 — the album

Postcards save a PNG and vanish from the game. Keep size-capped thumbnails in the save, add
an album page to the journal, give each chapter one gentle photo prompt (a suggestion,
never a task), and let the title-screen postcards prefer the player's own photos once they
exist.

### Job 3 — the first hour

Measure a fresh save's first fifteen minutes in Sydney: time to first use of each verb,
hint cadence, first find, first travel unlock, first ceremony. Then re-sequence hints and
task surfacing so every core verb lands inside ten minutes and the first ceremony arrives
early. Sydney is 18 tasks and is almost never finished early. **Do not add tasks** —
re-hint and re-order.

### Job 4 — the five pillars on chapters 1-3

Sydney, Pasto, Circular Quay. Run THE FIVE PILLARS (below) on each.

Chapter notes: these are the three oldest and most-audited chapters, so expect misses in
the tail rather than in the structure. Keep the Botanic Gardens clean enough to stage job
1's finale. Circular Quay measures 132,423 triangles against a 130k budget — no heavy
geometry additions; list reallocation candidates for batch 4 instead.

---

## BATCH 3 — Chapters 4-11

Kyoto, Cali, Rio, Iceland, Marrakech, The Drift, Venice, Hong Kong.

Read `qa/BATCH2.md` and the newest `CONTRACT.md` sections for what batches 1-2 built — the
mischief reaction layer, the auto-loaf and inverted critters, the finale, the album.
Pillars 2 and 3 depend on them.

Eight chapters, so delegation is not optional: one subagent per chapter for the measurement
sweep, fixes on the main thread, commit that chapter before starting the next.

Run THE FIVE PILLARS (below) on each, with these chapter notes:

- **Kyoto (4)** — the heron is a critter-registry adopter, so it is a direct test of the
  inverted-approach behaviour. The six stepping stones are the signature toy.
- **Cali (5)** — `caliNightT` only climbs while you are on the chiva, so `night()` is a
  progress latch and not a clock. Check every reader of it; one shipped find was provably
  unreachable for exactly this reason.
- **Rio (6)** — the Arcos da Lapa deck and the kiosk counter earned tasks late. Certify both.
- **Iceland (7)** — the hot-spring soak from batch 1 is this chapter's marquee; verify it
  fully. Iceland is also the one chapter that fails route life outright: more than half its
  route is empty and the dead 160 m is the approach to the glacier, charged repeatedly
  because `glacier-run` is a record. The fix is a RIDE BACK, not more scenery — the
  austerity is the chapter.
- **Marrakech (8)** — the erg's emptiness is the stated point. Pillar 5 applies to the town
  and the souk only, never the hamada.
- **The Drift (9)** — 201,886 triangles, so no net geometry additions; list reallocation
  candidates for batch 4. Natural home of batch 1's wind comedy. The island keels are drawn
  and are not a place: every footprint answers `driTerrain` with the island's TOP.
- **Venice (10)** — the tide decides which ground exists, so pillar 3 must be tested at both
  waterlines: wet stone, acqua alta room tone.
- **Hong Kong (11)** — 130,390 triangles against a 130k budget. Treat the geometry as frozen.

---

## BATCH 4 — Chapters 12-17, performance, release

### Job 1 — the five pillars on chapters 12-17

Palawan, Cappadocia, Manly, The Pantanal, Sơn Đoòng, Antarctica. Same delegation and
commit discipline as batch 3.

- **Palawan (12)** — the camera rules differ underwater; test pillar 3 below the surface too.
- **Cappadocia (13)** — the busiest chapter in the game: balloons, eleven horses, a chase
  truck, 160 pigeons, five crews. Route life here means TRIM, never pad.
- **Manly (14)** — the waterline is a function of POSITION, so test feel-of-ground against
  `localWater`, not a constant sea level.
- **The Pantanal (15)** — 207,072 triangles, the worst offender in the game. Zero geometry
  additions; list reallocation candidates for job 2.
- **Sơn Đoòng (16)** — photo mode in the dark must produce a keepable picture; expose off
  the wheek light. Albedo and canopy gotchas are in memory.
- **Antarctica (17)** — judge stillness by DISPLACEMENT, never by speed: `groundSlip` is
  0.66, idle grip is off, and a parked capybara crept half a metre in 35 s while reaching
  1.78 m/s. 179,788 triangles.

### Job 2 — performance reallocation

Re-measure first; job 1 will have moved the numbers. As of 24 Aug 2026 the BASE build
exceeded the 130k budget in five chapters: Pantanal 207,072 · Drift 201,886 · Antarctica
179,788 · Quay 132,423 · Kowloon 130,390.

Method: find the STRUCTURAL offender (Palawan's was a flat seabed grid that was 39% of the
chapter), then WARP or re-mesh rather than delete content — keep density where the player
actually is. Pasto's monotone squeeze is the worked example: `s = ±1` maps to itself so the
mesh still ends where the world does.

Measurement discipline: with the post chain, `renderer.info` is meaningless unless you set
`autoReset = false`, turn the shadow map off, and do one explicit
`renderer.render(scene, camera)`. A naive read after a frame returns the composite quad —
1 call, 1 triangle.

Frame time is a locked 60 everywhere, so this is headroom and not a crisis: no visual
regressions, screenshot before and after at the marquee viewpoints. Finish by adding a qa
audit that FAILS when any chapter exceeds 130k, so this job never has to run again.

### Job 3 — the release sweep

**(a) New-systems interplay fuzz**, extending `qa/fuzz.js`: keepsakes against `physRescue`,
relocation, water and moving floors (a relocated prop's `homeX/Y/Z` must move with it or
rescue returns it to a point inside something); graze against task-critical props; photo
mode against the ceremony, the dive, the helm and the dark; room reverb across border
crossings; calm and chaos in deliberate conflict.

**(b) UI and accessibility**: journal, board, ledger, album and title at 1280x720,
1366x768, 1600x900, 1920x1080, 900x620 and 390x844; role traps (`role="listitem"` on a
`<button>` REPLACES the button role); reduced motion; contrast in the fog chapters and the
dark ones.

**(c) Full regression**: every qa suite green, one fresh-save full playthrough, the finale,
then the ledger.

Then report found-versus-fixed across all four batches, and do NOT chain a fifth.

---

## THE FIVE PILLARS — the per-chapter pass used by batches 2, 3 and 4

1. **Marquee certification.** Name the chapter's wow moment and verify all four "that
   landed" channels (`CONTRACT.md` v16) — framed, lit, audible, acknowledged — from
   screenshots taken at the moment itself. Marquee moments in this project fail SILENTLY
   and have done so in every previous pass; this is the pillar most likely to find
   something.
2. **The cast.** Pair-chat actually fires (the 13 m radius, not the honest conversational
   4.6 m), `after:`/`before:` lines are present, at least one local acknowledges the player
   unprompted, and batch 1's two mischief chains work here.
3. **Feel of the ground.** Per-surface footfall, slip and particles; wetness interplay;
   room tone correct in interiors; mood-table coverage; the auto-loaf reads correctly.
4. **The signature toy.** Name this chapter's unique interaction — helm, balloon, herd,
   torch, snowcat and so on. If it is thin, deepen it using something the chapter has
   already drawn and never used. That rule made sixteen earlier tasks cheap.
5. **Route life.** Walk the main route with the density audit: no purposeless dead 20 m
   cells, every return toll has a ride, landmarks visible from the route.

---

## CHAINING

Each batch schedules the next one when it finishes, so a batch that overruns delays its
successor instead of colliding with it.

**Scheduling the next batch must be the VERY LAST action of the run** — after every commit,
after `CONTRACT.md`, after memory, after the handover file, after `playwright-cli close-all`.
Nothing may follow it, or the next batch can start while this one is still writing to the
same working tree.

Do it at the end of batches 1, 2 and 3, and **do it even if the batch went badly** — note
the trouble in the handover instead of breaking the chain. Call
`mcp__scheduled-tasks__create_scheduled_task` with:

- `taskId`: `capy3-batch-2`, `capy3-batch-3` or `capy3-batch-4`
- `fireAt`: **ten minutes** from the moment you finish, ISO 8601 with the `+10:00` offset
  (Australia/Sydney). Get the real current time from the shell first — run
  `Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"` — and add ten minutes to THAT. Do not guess
  the date; do not compute it from anything in this file.
- `description`: `capy3 Payoff Pass batch N of 4`
- `notifyOnCompletion`: `true`
- `prompt`: the trigger text below, with N set to the batch you are scheduling.

Trigger text:

> capy3 Payoff Pass, batch N of 4. Work in `C:\Users\roger\OneDrive\Desktop\capy3`. Read
> `qa/PAYOFF-PROMPTS.md` in that repo and execute its COMMON PREAMBLE plus its "BATCH N"
> section in full, including the FIVE PILLARS section if that batch references it, and the
> CHAINING section at the end. This is a long autonomous run: work end to end, commit as you
> go, and do not stop to ask. If `qa/PAYOFF-PROMPTS.md` is missing, stop and report that
> rather than improvising.

Batch 4 chains nothing.
