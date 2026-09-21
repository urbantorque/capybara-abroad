---
name: capy3-the-closing-four
description: "R7-R10 — the last four release batches, and the one blindness that cost time in all four"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1945dbd8-cc52-47cc-a02f-21d96d647160
  modified: 2026-09-01T14:56:13.836Z
---

Batches R7–R10 of `ROADMAP-RELEASE.md`, 1–2 Sep 2026: `59f0118`, `fdc2847`,
`2213f71`, and R10. With R1–R6 this closes the release roadmap except two
decisions that are the owner's.

## THE ONE MISTAKE THAT REPEATED IN EVERY BATCH

**Hooking a public name shows what the CHAPTERS say and none of what the GAME
says.** Three times, in three subsystems:

- `game.sfx` — the ambient bed goes through the module-private `sfx`, so a probe
  hooking the public name sees every object in a chapter and none of its
  soundscape. Exactly backwards for R8/R9, whose subject *is* the soundscape.
- `game.toast` — `startGame` calls the module-private `toast()`. The
  private-window probe saw **nothing at all**, not even "be a menace.".
- `V.rialto` is a **method**; read without parentheses it is a truthy function
  object whose `.ax` is undefined, so every derived coordinate came out NaN and
  serialised as null. Nothing threw.

Fixes: `hud.ambAudit()` and `hud.recordAudit()` (both `*Audit` idiom, nothing in
src reads them), or watch the DOM with a MutationObserver.

## R7 — five re-arms and three records

The last `if (xDone) return` lines in the tree: rio calçadão, rio Arpoador,
drift vane, venice Rialto, venice calli. Task keeps its latch, the thing
re-arms. **The vane mattered beyond replayability** — it is the Drift's only
wind readout and `long-gap` is impossible into the breath, so the tick switched
off the instrument the moment the player learned it existed.

**A RECORDS key must be a TASK id** or the row is invisible: the chapter board
and the picker both look it up as `RECORDS[taskId]`. `hud.recordAudit()` reports
orphans; the sweep is clean at 60 rows.

Pars measured machine-floor-first, three runs each: calcadao 181.8 m ceiling of
a 188 m band (ticks at 132) → par 165; the-calli 48.0 m hard ceiling (36) → 44;
rialto floor 4.3 s → 5.5.

**Teleporting onto a tracker does not start a run.** Rio spawns the animal ON
the calçadão, so the probe's placement at the west end left the start pinned at
x = 0 and the "sprint" measured 91 m — exactly half the truth, and therefore
believable.

## R8 — Pasto, and a record measured backwards

One ambient line became 23 calls over 6 positional branches; 4 sfx call sites
became 15; 2 records became 3; no acts became 3. Two new voices, `frailejon`
and `banda`.

**THE THIRD RECORD WAS EXACTLY BACKWARDS ON THE FIRST CUT.** Counting bell
rings: `av` is a magnitude and a pendulum's is zero at both ends of every swing,
so the hysteresis re-arms twice a period and a freely decaying bell rings
itself. **One strike and walking away scored 17; working the rope scored 6**,
because re-striking holds `av` above the re-arm floor and suppresses crossings.
It is the swing ANGLE instead — strikes add in the direction of travel, and a
pendulum only loses amplitude on its own. One strike = 39.5°, held flat for
30 s; a scripted puller = 179.6°. Par 90, the bell horizontal.

**`.capyui-todo.textContent` returns every row in the DOM, hidden ones
included** — the act staging looked broken and was fine. Measure rendered rects.

## R9 — four bespoke voices, and the level trap

`corso`, `roulette` (salon only — monaco.js already runs a positional bed
outside), `burner` (all six goreme.js sites), `farbell`.

**THE LADDER CALLS EVERY BESPOKE VOICE AT `volume: 0.04–0.21`** — the synth
carries its own level and the call volume is a small per-place multiplier. All
six new voices were first written in at **0.55–1.15**, five to ten times the
band, because they were authored against their own envelopes rather than against
the table they were joining. Caught by reading neighbouring call sites.
`sfxBurner`'s envelope was then set just under `sfxHiss`'s 0.13 peak on purpose,
so goreme.js's existing call sites carried over untouched — **tune the synth,
not the twenty call sites**.

Verify a new synth by **counting AudioContext node creations** across the call
(patch the prototype): it is the only thing observable from outside without
hearing it, and it catches a name that never reached `sfxTable`.

Ducking not built: one chapter fires **129 footsteps in 45 s** of free play, so
a duck keyed on sfx events is a duck keyed on footsteps.

## R10 — and what the soak was for

19/19 chapters, 0 NaN, 0 errors, 0 console messages. CONTRACT.md's budget
reconciled over three loads: **13 of 19 over 130,000 triangles** (was "ten of
seventeen"), reported without the shadow pass; worst chapter 2.02 ms of 16.67
against a 5.5 ms gate, and hanoi at 300k is cheaper than goreme at 205k.

**The soak's find: the Pantanal ships six locals, not seven.** `put()` probed
`panTerrain`, which answers "what would the capybara stand on" and **includes
the floating meadow mats and a sleeping caiman — both of which move**. So
whether a person existed depended on where a raft was drifting at build time,
which is why every previous soak reported a clean console. `panStandH` is the
static ground (bed + road, no rafts) and is published. **My first fix was
measured against `panTerrain` and was wrong the same way** — (−24, −51) reads
0.56 with a meadow passing and −0.11 without. The missing man is the cattleman
at the herd crossing, whose lines are the only acknowledgement that you took the
herd over.

Two decisions deliberately left, both the owner's: **the LICENSE** (see
`LICENSING.md` — the wiring is done, `build.mjs` lifts the file's first
paragraph into the distributable automatically and says "all rights reserved"
until there is one) and **the deploy** (no host chosen, no remote, and
publishing is not a move to make on someone's behalf).

Related: [[capy3-the-wall]], [[capy3-the-thumb]], [[capy3-the-release-review]],
[[headless-qa-harness]], [[capy3-names-nothing-publishes]], [[capy3-the-mix]]
