---
name: capy3-instruments-that-cannot-hold-a-line
description: "Three capy3 QA suites whose numbers move on their own, and how much"
metadata: 
  node_type: memory
  type: project
  originSessionId: a368f17c-7b9d-43f0-b059-f9dba60f7976
  modified: 2026-09-04T23:06:34.726Z
---

Measured 26 Aug 2026 while running batch 5. Each of these looks like a ratchet and is not one.
Check the instrument before believing the number — and before writing a regression up.

**`qa/audit-solid.js` moves ±5 with nothing changed.** Back to back on ONE build: kyoto 33→36,
cali 44→47, goreme 46→44, antarctic 3→2. Its mesh list is `scene.traverse` filtered on
`.visible`, and chapters toggle visibility on TIME OF DAY — Cali's dusk lights, Kyoto's heron
wing, Kyoto's matcha heap. The quiet chapters (sydney, hanoi, pasto, sahara, kowloon, palawan,
pantanal) are stable and can be trusted. It needs its clock pinned before it can hold a line.
Batch 5 briefly read this as eight chapters regressing.

**`qa/stillness.js` has one chapter that straddles its own limit.** Pasto drifts from its spawn
with no input: measured 0.48 m, 2.5 m and 7.83 m on three runs, and the limit is 1.0 m. It is
weather-driven — `wet` reads 0.17 and 0.26 across the same runs and rain adds slip through
`capySlipAt` — so which side of the line it lands on is chance. Open finding in its own right.
See [[capy3-slip-and-sky]].

**`qa/budget.js`'s cost gate contaminates itself.** Triangle counts move ±5% run to run because
they are read off the renderer's info after a real frame, so framing and frustum culling
change them; the ratchet and the triangle gate still stand, and the summary says
"COST GATE UNUSABLE" out loud when the timing rows are noisy, which is the right behaviour.

**And a camera measurement is not repeatable if the animal is allowed to walk.** A probe that
held a key for three seconds before sampling reported the same rig as 11, 16 and 13 of nineteen
on three identical runs, because twenty metres of travel is a different WORLD each time. Reset
to the spawn, hold, and look at 2.0 s — two seconds because `camDolly` damps at lambda 2.4 and
is only two thirds of the way there at one. See [[capy3-lens-and-wall]].

Related: [[headless-qa-harness]], [[capy3-the-closeout]], [[capy3-two-runs-one-tree]].

**Two more, measured 4 Sep 2026 in X7.**

**`qa/px-cam-walls.js` cannot resolve a camera change at all.** Run against two builds that
differ by one clamp, its six-chapter aggregate moved `occ` 108→127 and `inside` 28→16 — and on
the legs where the boom was NEVER CUT, where the change under test provably cannot act, `occ`
moved 78→92 and `inside` 15→4. It walks the animal for 2.6 s per leg and it ends up beside a
different wall every time. Use it to FIND a bad leg; use a pinned-position probe (`qa/px-boom.js`,
which teleports to one spot and walks one 2.8 s route) to MEASURE one.

**`qa/px-cam-controls`' walk / run / slide / wheek columns are spawn-local and all move.**
Between two runs of one build: cali run 4.94→1.37, antarctic run 3.11→5.11, pasto's "dead"
X yaw −0.17→−1.83, and five chapters swapped in and out of "SLIDE did not fire". Its stable
columns are the V block, `clearMin` and `err`. **And its sfx window is four** — `sfx.slice(-4)`
reads as "this chapter's wheek is silent" in any chapter with a busy ambience, which is how
Hanoi got filed as a bug. Log the whole list and search it.

**Three more, 5 Sep 2026 in X8 — and these are MY OWN probes, caught before they were believed.**

**A digit key only travels from the TITLE CARD.** Pressed in a running game it does nothing at
all, so a probe that does one `page.goto` and then loops over nineteen keys measures Sydney
nineteen times. It looked plausible: 43 kinematic bodies, sensible counts, small variation
between "chapters". The only reason it was caught is that the probe reported `biome` in every
row. **Reload per chapter (`px-anom.js`'s shape), and always assert the biome.**
`g.biome.switchTo(name)` is the fast alternative `px-npc-walk.js` uses.

**The extra-chapter key table is off by one from what you will assume.** `sysPICK_EXTRA` maps
Minus→11, Equal→12 … so Hong Kong is **Minus** and Palawan is Equal; Antarctica is Comma, Monaco
Period, Hanoi Slash, Manly BracketRight. A probe keyed `Equal` for Kowloon runs happily in
Palawan and reports zero occlusion, which is true and about the wrong chapter.

**A probe that samples two different objects reports a number that is not small but meaningless.**
The first `px-hitch.js` compared `lap()` — the ridden car's route position, which WRAPS — against
a body it separately picked as "the fastest kinematic one", which need not be the same car. It
reported a shortfall of −6.997 m on a run with no stall in it. Rewritten to hold ONE body and
compare commanded travel (velocity integrated on wall-clock) against actual travel, which reads
zero on a clean run by construction. **Prefer an estimator whose null result is forced by its own
arithmetic.**

**And `navBlocked` is the wrong instrument for anything floating.** `makeSolidIndex().blocked`
deliberately skips a box whose top is within `solidRISE` of the ground — that is a kerb you walk
onto — so a hull sitting 42 cm over the waterline is invisible to it while being a perfectly real
collider. Ray the physics world instead. Also: a body-count differential (121 → 154) is the
cheapest possible proof that colliders were added at all.

See [[capy3-pasto-by-name]], [[capy3-the-shelf-cleared]].
