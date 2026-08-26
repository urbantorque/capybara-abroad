# BATCH 3 — Chapters 4-11 (Payoff Pass)

Started 25 Aug 2026, on `claude-opus-5`. Brief: `qa/PAYOFF-PROMPTS.md` § BATCH 3.
Predecessor: `qa/BATCH2.md` — jobs 1-2 landed (THE LAWN, THE ALBUM, CONTRACT v24).
~~**Batch 2 jobs 3 (the first hour) and 4 (pillars on ch 1-3) were NOT done** and its
handover/chaining steps were never run.~~

> **CORRECTED 26 Aug 2026 by the closeout run. This was wrong, and it propagated.**
> Batch 2's jobs 3 and 4 both ran and both landed: `4c19859` "the first hour: Sydney spent
> 'climb' ten chapters early" at 25 Aug 23:39, and `478e69b` "pillars 1-3: half of chapter
> three had the wrong footstep" at 23:51, with `bc73651` ticking the last two checklist
> rows at 23:56. Batch 3 read `qa/BATCH2.md` BEFORE those commits landed — the two runs
> overlapped in the same tree — and recorded the file's state as a fact about the work.
> Batch 4 then copied the claim forward into its own closing report without re-checking.
>
> **The lesson is the one `capy3-two-runs-one-tree` already carries, sharpened:** a
> handover file is written LAST, so it is the one artefact that is guaranteed stale while
> a run is live. `git log` is the record; the handover is a summary of it. A run that
> wants to know whether something was done must ask the history, not the note.
>
> What was genuinely still open after batch 2 — and remained open until this closeout —
> is narrower: chapters 1-3 carry neither `framed` nor `lit` (batch 2's own findings B and
> C), and its two `[~]` rows were never closed. That is real, and it is fixed below.

Carried in and available to pillars 2 and 3:
- mischief reaction layer (npc.js `r.own`, produce, chains) — harness `qa/pf-mischief.js`
- auto-loaf + inverted critters — `capy.loaf`, `capy.loafAsk`; harness `qa/pf-loaf.js`
- the finale (`sysFinale*`, `game.physics.stageKeep`), the album (`capy3.album.v1`)

## The eight chapters

| n | biome | file | notes from the brief |
|---|---|---|---|
| 4 | kyoto | src/kyoto.js | heron = critter-registry adopter, direct test of inverted approach. Toy: six stepping stones |
| 5 | cali | src/cali.js | `caliNightT` is a PROGRESS LATCH not a clock — check every reader |
| 6 | rio | src/rio.js | Arcos da Lapa deck + kiosk counter earned tasks late; certify both |
| 7 | iceland | src/iceland.js | hot-spring soak is the marquee. Route life FAILS: dead 160 m glacier approach needs a RIDE BACK |
| 8 | sahara | src/sahara.js | pillar 5 applies to town+souk only, never the hamada |
| 9 | drift | src/drift.js | 201,886 tris — NO net geometry. Home of the wind comedy. Island keels are not a place |
| 10 | venice | src/venice.js | pillar 3 at BOTH waterlines |
| 11 | kowloon | src/kowloon.js | 130,390 tris vs 130k — geometry FROZEN |

## Per-chapter checklist (five pillars)

- [x] **4 Kyoto** — DONE (afe5326): 67-fire marquee latched, framed, positional, lit, surface ladder, minimap, dango, heron reads the stones
- [x] **5 Cali** — DONE (b71bd6f): marquee framed 128 deg off, mono ride, 2-of-6 surfaces, night caption
- [x] **6 Rio** — DONE (d0ac791): localWater, kiosk gate + ladder, framed/punched/positional, lit, arches zone, icecream, rioClap
- [x] **7 Iceland** — DONE (93d4109): aurora was BEHIND THE CAMERA, snowcat catchable, moraine footfall, 174 m exchange
- [x] **8 Marrakech** — DONE (b71bd6f): empty-sand payout framed, surf lights the grade, 31 mono cues, souk-escape winnable
- [x] **9 The Drift** — DONE (b71bd6f): ownership 0 -> 6 props, thirty islands got a footfall, the paper wall reframed
- [x] **10 Venice** — DONE (b71bd6f): the idle slide into the lagoon, the Rialto sounded like the canal, a silent marquee
- [x] **11 Hong Kong** — DONE (d60157a): the climb reaches 34.36 (was 33.36); the roof LANDING is still open, see the handover

## Finish

- [x] CONTRACT.md new version section (v26, two parts)
- [x] qa audits for new invariants (qa/channels.mjs, qa/stillness.js, qa/b3-frame.js)
- [x] Project memory (capy3-payoff-batch-three)
- [x] This file as the handover (below)
- [x] `playwright-cli close-all`
- [x] Chain batch 4 — `capy3-batch-4` created, fires 26 Aug 06:26 +10:00. NOTE: the chain DID work this run, unlike batch 1 -> 2. Two gotchas: `notifyOnCompletion` must be **false** from inside a scheduled run (a run session cannot subscribe to its own completion), and the shell clock moved between reading it and using it — read `Get-Date` immediately before the call or `fireAt` is rejected as past.

## Log

- Started. Oriented on BATCH2.md + PAYOFF-PROMPTS.md + headless-qa-harness memory.

### Baseline, before any chapter work (main thread, 25 Aug)

`qa/pf-mischief.js` re-run. **It was under-reporting and now says so.** The
harness printed `ownedProps` with no population count beside it, so "this
chapter has no owners" and "this chapter's props had not scattered when I
looked" were the same number. Kyoto read `owners 0` on one run and `owners 2,
closest 3.8 m` when measured on its own — 3.8 m being the exact figure CONTRACT
v23 records for Kyoto. `nProps` added; the numbers are stable now.

| ch | props | walkers | owned | owners | edible | pairs<20m | chains |
|---|---|---|---|---|---|---|---|
| 4 kyoto | 10 | 13 | 5 | 2 | **0** | 4 | 2 ✅ |
| 5 cali | 10 | 10 | 3 | 2 | 4 | 3 | 3 ✅ |
| 6 rio | 10 | 8 | 3 | 2 | **0** | 4 | 2 ✅ |
| 7 iceland | 10 | 8 | 7 | 2 | **0** | 1 | 2 ✅ |
| 8 sahara | 11 | 10 | 5 | 3 | **0** | 4 | 2 ✅ |
| 9 drift | 9 | 8 | **0** | **0** | **0** | **0** | **0** ❌ |
| 10 venice | 10 | 8 | 7 | 3 | **0** | 5 | 2 ✅ |
| 11 kowloon | 11 | 9 | 4 | 2 | 2 | 8 | 3 ✅ |

- The ownership walk and its ceiling are healthy: Marrakech drill walked out
  7.47 m in 11.9 s and put the prop back 0.48 m from home; the impossible
  retrieval ended at 16.4 s having gone 10.52 m. No errors.
- **THE DRIFT IS THE ONE OUTRIGHT FAILURE: 0 of 3.** Its 9 props scatter around
  `{x:2, z:42}` on the Shelf and its only nearby person is the jetty traveller
  at (26.4, 32.8) — 26.1 m from the scatter centre, so ownership is a coin flip
  on where the random scatter lands. Its witness chain is deliberately absent
  (drift.js: "one voice per island and forty metres of sky between them") and
  must stay absent. So the Drift's second chain has to be OWNERSHIP, by moving
  the scatter onto the household that is already drawn there.
- **SIX OF THE EIGHT CHAPTERS HAVE NOTHING EDIBLE IN THEM**, so batch 1's
  produce reaction is unreachable in three quarters of this batch. Marrakech is
  a false positive — it has an authored orange-cart chase (`sahara.js:4626`)
  that is richer than the generic chain; the count only sees SCATTERED props.

### The chapter-neutral job, done first (main thread)

**`game.frameShot()` — the fourth channel, at last.** Batch 2 left it open as
finding B: `camYawTarget`/`camDistTarget` are systems.js module-locals with no
public setter, so *framed* was not a channel any biome could opt into. `rig()`
could already ask for a distance, a pitch and a raise; there was no way to ask
for a **bearing**, which is the one thing a marquee actually needs.

`game.frameShot({ yaw, dist, pitch, raise, hold, w })` — a request with an
envelope, not a cutscene. Measured (`qa/b3-frame.js`, all five green):

| assertion | measured |
|---|---|
| bearing reached | 0.2° off the ask |
| distance held | 12.58 m horizontal = 14 m at 26° pitch, exact |
| envelope peak | w = 1.000, releases to 0.000 |
| a Z keypress kills it | w 1.000 -> 0.011 in half a second |
| survives a border | no — w = 0 after `switchTo` |
| yaw-only shot moves the distance | no — 0.47 m |

Aged on `game.state.rawDt`, because a marquee is the one moment most likely to
be under slow motion (`completeTask` pays `slowmo` out on exactly the `wow` rows
a shot belongs to) and a 2.2 s hold must not become 3.5 s. That is the same rule
`sysSAVE_DEBOUNCE` was found breaking in v23.

Chapters opt in per marquee below.

---

# THE HANDOVER — batch 3 closed, 26 Aug 2026

All eight chapters done. `CONTRACT.md` §v26 has the full account; this is what batch 4
needs to know.

## What landed

| commit | what |
|---|---|
| `2b2fb26` | `game.frameShot()` — *framed* became a channel a chapter can opt into |
| `52fd1ba` | `qa/channels.mjs` — three of the four channels, audited with no browser |
| `afe5326` | **4 Kyoto** — the 67-fire marquee, the sand default under Uji, the heron |
| `d0ac791` | **6 Rio** — `localWater`, the kiosk gate and its coin-flip ladder |
| `93d4109` | **7 Iceland** — the aurora was behind the camera |
| `d60157a` | **11 Hong Kong** — the roof deck's lip stopped the climb |
| `b71bd6f` | **5 Cali · 8 Marrakech · 9 the Drift · 10 Venice** |
| `(qa)` | `qa/stillness.js` — displacement, not velocity, in 17 chapters |

The last four share edits in `capybara.js`, `props.js`, `systems.js` and `npc.js`, so they
landed together rather than leaving the tree half-changed between commits.

## Open, measured, and handed to batch 4

1. **KOWLOON'S ROOF IS STILL UNREACHABLE.** The climb now gets to **34.36 m** (was 33.36,
   stuck for forty seconds) but the animal tops out in open air **0.65 m east of the deck
   edge** and cannot move west onto it: the scaffold's colliders fill the bay to its full
   height and there is no way to step off a lattice sideways. `symphony` is NOT blocked —
   it tests height and ticks from the cling at 73.7 s — but the hut, the pigeon loft, the
   aerials and the chair up there are dressed for nobody. **Do not** lower `hkSCAF.top` to
   start the shove earlier; tried, and the peak drops to 34.09.
2. **`qa/stillness.js` FLAGS THREE CHAPTERS OUTSIDE THIS BATCH.** Pasto drifts 2.71 m at
   its spawn and **28.32 m at spawn+(9,9)**, both on ground `pastoSlope` calls flat — so
   either the ground moves or `slopeAt` lies, and both are worth knowing. Cave drifts
   1.33 m on a 3° floor. The Drift's 4.39 m at spawn+(9,9) may be a fall off the Shelf
   rather than a slide; the audit prints `fell` so you can tell.
3. **ICELAND'S RIDE BACK IS IN THE WRONG PLACE.** The hold radius is now 58 m and the cap
   26 s, so the snowcat is still there when you arrive — but **every glacier run finishes
   at x ≈ −20 and the cat's track is x = 34**, so the toll is still a 54 m cross-moraine
   walk. Relocating the track onto the fall line moves the beacon, the headlights, the
   packed-snow ramp meshes and the fox's orbit centre with it (they all derive from
   `iceCAT_X`), which is why it was not done here.
4. **ONLY 5 OF 17 CHAPTERS REGISTER A CRITTER** — quay, kyoto, iceland, manly, goreme. So
   batch 1's calm inversion, the payoff of stillness as a verb, has nothing to invert in
   twelve chapters. Cali, Rio, Venice, Kowloon and Marrakech have **no ground animal
   drawn** to register, so this needs content, not a flag. `qa/channels.mjs` prints the
   count every run.
5. **ROOM TONE IS KEYED PER BIOME, NOT PER SPACE** (`sysROOMS`, systems.js ~5839). Venice
   has fifty metres of colonnade down each side of the square and a floor that turns into
   a hard reflective sheet, and the reverb never moves. Global; Venice is where it costs
   most.
6. **FIVE CHAPTERS STILL HAVE NO ROW IN THE EVENT GRADE LAYER** — sydney, pasto and quay
   (recorded in v25), and now goreme and cave carry theirs, so run `qa/channels.mjs` for
   the live list. Kyoto and Rio were fixed here.
7. **THE DRIFT AND SƠN ĐOÒNG CARRY ONE MISCHIEF CHAIN, NOT TWO**, and correctly so — both
   are written around one voice per place with forty metres between them. The Drift's
   ownership chain works now (0 owned → 6). Its witness chain must stay absent.
8. **PERFORMANCE.** Nothing in this batch added net geometry to the Drift (201,886) or
   Kowloon (130,390). Rio gained one crate and Kyoto gained two dango, neither of which is
   on the over-budget list. Venice's collision heightfield went from 4,118 samples to
   16,215 — that is collision data, not triangles, but it is worth a line in job 2's
   measurement.

## Traps this batch paid for

- **`yaw` is the bearing FROM the animal TO the camera**, not the direction it looks.
  Writing 0 where π belonged put 0 of 336 aurora vertices in frame — the exact bug being
  fixed, reintroduced by a sign.
- **A one-shot payout needs a state meaning ALREADY PAID**, not the value its clock idles
  at. Kyoto's `-1` meant both.
- **The mischief adoption counts are not stable between runs.** The scatter is randomised
  at build: Cali measured 3, then 0, then 2 owned across three runs of the same build with
  no source change. Take the best of three or seed the scatter — a single run cannot
  certify adoption, in either direction.
- **A probe that measures nothing looks exactly like a probe that passes.** The first
  Kyoto latch probe returned 0 payouts because it never armed the run. Assert on the
  SETUP, not only on the result.
- **Writing patch scripts through Bash heredocs cost real time here** — a heredoc ate one
  backslash of each pair and turned `\b` into a literal backspace, which is v24's own
  `qa/verbs.mjs` bug reproduced while writing the audit that exists to catch that class.
  Use the Edit tool, or Write the script and then run it. Note `src/systems.js` is CRLF
  and most biome files are LF.
- **`playwright-cli screenshot` does not take a path argument.** It writes into
  `.playwright-cli/` and prints the name; copy it out afterwards.
