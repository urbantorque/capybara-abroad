---
name: capy3-the-second-hour
description: "v51 — the engagement pass: the props audit that reframed the game, and three features that had never once been reachable"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9b86436e-4fa0-4c95-95a2-442f8b824d89
  modified: 2026-08-30T16:43:11.079Z
---

Ran 31 Aug 2026 on a scheduled "make the game more fun" task, after seven
straight picture passes (v44–v50). Commit `ee46aff`; the v53 follow-up is
`6a2d0a8` (see the bottom of this file).
Architecture in **CONTRACT.md ➜ "THE SECOND HOUR (v51)"**.

**THE ONE MEASUREMENT THAT REFRAMED EVERYTHING: live props per chapter, by
`p.biome`.** Sydney 49, Pasto 24, Monte Carlo 20, Hanoi 16 — and **8 to 11 in
the other fifteen**, all inside ONE annulus 13–26 m across. Everyone's sense of
this game comes from Sydney, which has five times what the average chapter has.
Props within 20 m of the spawn were **0** in Cali, Pantanal, Sơn Đoòng and
Hanoi and **1** in Kyoto and Monte Carlo (Sydney: 9); Sơn Đoòng had none within
*eighty* metres. Fixed with `also`, a second annulus per row in
`physBIOME_SCATTER` (16 of 19 rows; the Drift is deliberately excluded).
**100% placement, every new prop 0.1–0.8 m above its own terrain, frame time
unmoved at 16.5–16.8 ms.** `physSpotOk` gates every candidate, so a badly
chosen centre costs coverage and never correctness — which is what makes
hand-picking sixteen coordinates blind an acceptable risk.

**THREE OF THE FIVE CHANGES WERE FEATURES THAT COULD NOT BE REACHED.** Third
time this has been the answer — see [[capy3-payoff-batch-one]] and
[[capy3-five-things-already-built]].

1. **The v18 finished-chapter record board had NEVER been on screen**, in any
   chapter, ever, for two independent reasons: `todoTopId` is `sysWAY_ID` when a
   chapter is done, so the hint tick rewrote `clueEl.textContent` from
   `sysHINTS[todoTopId].clue` four times a second; and `.capyui-clue` is clamped
   to `max-height:3.2em` with `overflow:hidden`, which is right for a clue and
   clips a six-line board. **A feature can be broken by a writer in a completely
   different function that runs on a timer.** Gate on the class the feature
   itself sets (`recs`) rather than adding a second flag.
2. The incident chain was silent until it paid out — a repeatable reward you
   cannot aim at is a lottery. It now ticks per event, rising, positional.
3. Kyoto's torii tunnel and bamboo grove opened `if (xDone) return`, so the
   chapter's two best set pieces became inert scenery the moment they were
   ticked. Rio's Selarón steps, Venice's passerelle and HK's laundry pole all
   re-arm; Kyoto was the exception. Now re-armed, with two new records
   (`torii-run` par 32 s, `bamboo-dash` par 17 s).

**A PAR MUST BE MEASURED.** A scripted steer holding sprint the whole way does
the tunnel in **24.7 s** and the grove in **14.5 s**. The first guesses were 34
and 12 — and 12 was below the machine floor, i.e. unreachable by anybody.

**THE NEAR MISS** (`recClose` in systems.js): capture `jrRecs[id]` as
`recOpenBest` when `recordLive`'s id CHANGES, not every call — that is what lets
a run which beat the best (and has already overwritten it) be read as a win and
stay silent. Fires from `recordEnd` AND the stale watchdog, never from
`biome:enter` (which is why that clear is written out by hand instead of calling
`recordEnd`). Half the 55 rows are counts, so a gap prints its unit only when it
IS one — "2 of them off" is nonsense, "2 off your best" is right.

**TWO HARNESS TRAPS, BOTH OF WHICH READ AS THE FEATURE NOT WORKING:**

- **`toast()` and `sfx()` inside systems.js are MODULE-LOCAL.** Wrapping
  `game.toast` / `game.sfx` from a probe sees nothing they emit. The first
  near-miss run came back six empty arrays against a feature that worked
  perfectly. Observe the `.capyui-toasts` DOM with a `MutationObserver` instead.
  Same for anything else systems.js says to itself.
- **A closed-loop steer has no pathfinding.** Aimed from the Kyoto spawn at the
  bottom torii gate, it walked five metres into a wall and stood there for two
  minutes, reporting `gi: 0` — which reads exactly like dead input. Put the
  animal at the START of the corridor being measured. Also: the input basis is
  `worldX = ix*cy + iz*sy`, `worldZ = -ix*sy + iz*cy` (capybara.js), so the
  inverse is the transpose: `ix = cy*Dx - sy*Dz`, `iz = sy*Dx + cy*Dz`, and W is
  `iz -= 1`, D is `ix += 1`.
- Also: `game.props` and `game.locals` ACCUMULATE across biome switches by
  design — filter on `p.biome === g.biome.current` or every count is the sum of
  every chapter visited. Props are instanced, so `p.mesh.visible` is false for
  live ones; do not use it as a liveness test.

Also useful: `qa/v51-spawn.js` (live props + near-spawn rings, all 19),
`qa/v51-place.js` (new clusters resting on their own ground),
`qa/v51-perf.js` (per-biome median frame ms), `qa/eng-rate.js` (45 s of driven
free play per biome, counting toasts/tasks/impacts/startles — the instrument
that found Kyoto and Cali dead).

Related: [[capy3-payoff-batch-one]], [[capy3-five-things-already-built]],
[[headless-qa-harness]], [[capy3-the-blossom]]

---

**v53, the same day — the remainder.** Commit `6a2d0a8`. Worked the gap list v51
shipped with; **four of six were defects in v51 or in what it touched**, which is
the argument for writing the list down at all.

- **The encore sweep found the pathology is RARE**, not systemic: 110 `xDone`
  latches over nineteen files, and almost all put feedback and measurement ABOVE
  the guard so only the tick is suppressed. The dangerous shape is specifically
  **a `Done` guard that early-returns out of the whole function** — grep
  `^\s*if \(\w*Done\) return;`. Three left; two fixed (Cali's cane, Kyoto's dry
  crossing). **Kyoto's had a second half in the ACCESSOR**: `kyoDryCrossing()`
  returned `kyoDryArmed && !kyoDryDone`, so fixing the update function alone
  would have left the heron broken. **When you unpick a latch, grep the flag —
  not just the function.**
- **A soak that found a bug often cannot verify its fix.** The chain-reachability
  soak gave 19 impacts / 2 disturbed before, and 48 / 0 after — pure walker
  noise. Replaced with a two-case unit test (fresh shove propagates, 5-s-old
  shove does not). Same family as trap 18.
- **`dp: 0` is the tell for a count record.** v51's near-miss band was
  `max(0.35, best × 0.07)` — right for a clock, silently wrong for a tally, so
  "4 of the six against a best of 5" said nothing. Floors at 1 for dp-0 rows and
  changes nothing for the eleven distance-in-metres rows.
- **v51's own test suite missed both of its bugs for the same reason**: the count
  case and the watchdog case both used figures that BEAT the best, so neither
  branch was ever reached. A near-miss test must actually miss.
- `aria-live` on an element that is rewritten four times a second is a screen
  reader on a loop — ride the class that marks the rare state instead.

Still unmeasured and it is the headline: **nobody has timed a chapter.** Every
figure in v51 and v53 is a proxy for "20–35 minutes a place".

New probes: `qa/v53-cause.js` (causation unit test), `qa/v53-near.js` (all four
near-miss shapes), `qa/v53-clip.js` (HUD clipping across five viewports),
`qa/v53-encore2.js`, `qa/v53-cane2.js`.
