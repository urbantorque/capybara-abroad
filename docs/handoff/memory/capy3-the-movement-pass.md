---
name: capy3-the-movement-pass
description: "The movement pass — the three-frame stop, the silent wall, the barge and the run-up, all landed 27-28 Aug 2026"
metadata: 
  node_type: memory
  type: project
  originSessionId: 5d735844-0862-4b3e-8430-63afe11632c6
  modified: 2026-08-27T14:05:21.660Z
---

Movement/mechanics pass, 27-28 Aug 2026. Analysis in `qa/MOVEMENT-PASS.md`, what was built in
`qa/MOVEMENT-PASS-BUILT.md`, landed in `708ecf9` + `1b83692`. Report also published at
https://claude.ai/code/artifact/8e752035-0d9c-4452-8a98-a0e8fe8338d5

**What changed:**

1. **The sprint has a stopping distance.** `capyGRIP_LAMBDA` (commented `// idle, grounded`) was
   the ground damper at every speed, so the number holding a parked capybara on Galeras also
   stopped a sprint: 7.4 m/s to zero in 3 frames / 0.185 m. `capySTOP_LAMBDA`, the one named for
   it, was referenced nowhere on the ground path. Two bands split at `capyGRIP_SNAP`, as a `min`
   so ice is untouched. Now 9 frames / 0.502 m. **The band edge cannot be reached by gravity** —
   the stiff band settles at `a/60`, so leaving it needs 54 m/s² against a world gravity of 24.
2. **A wall answers.** The collide listener returned on `other.mass < 0.8` and static colliders
   are mass 0, so every collision with the world itself was discarded. Static branch added.
3. **The barge** — `physOnCollide`'s bin-chicken idea generalised, impulse scaled by the prop's
   own mass so it grants a capped *velocity* and nothing is launched.
4. **The run-up** — a sprint-gated forward shove on the hop, apex and airtime untouched.
5. **The condor's second whistle** — armed low from the start once `taskDone('condor-ride')`.
   9 s and two whistles to the first ride, 6 s and one every time after.

**Two things the analysis got WRONG, and both were already answered in the code:**

- `capyClimbProbe` has given every chapter a generic wall climb since v31 (*A WALL IS A WALL, IN
  EVERY CHAPTER*). `qa/mv-verbs.js` measured `api.climbHold` publication, which is **not the
  verb**. `qa/mv-climb.js` drives the real path and climbs 4.84 m up a Kyoto wall in a chapter
  that publishes nothing. **A hook census is not a verb census.**
- `capyWindAt` carries an explicit note that the ambient gust must NOT go on `wind()`, because
  `wind()` is the air as a reference frame and would slide the animal across Jemaa el-Fnaa with
  nobody touching a key. Proposing to publish wind more widely was that exact bug.

**New instruments in `qa/`:** `mv-park.js` (19 x 3 spots x 60 s parked — the differential that
proves a damper change cannot reach a slope; 57 cells, none changed), `mv-noise.js` (is new
feedback a rattle? 14 of 19 chapters fired zero `punch()` before; the bonk's first cut fired 23
times in 45 s on the ferry, which set the 3.9 m/s threshold), `mv-stop.js`, `mv-bonk.js`,
`mv-climb.js`, `mv-condor3.js`, `mv-barge.js` (rough — does not re-seat the prop between trials).

**THIS REPO HAS CONCURRENT WRITERS.** On 27 Aug two other live sessions were bulk-rewriting all
of `src/` from stale snapshots, and silently reverted edits to `props.js` and `condor.js`
mid-session; `ListAgents` showed them. The tell is `git status` growing files you never touched
and an Edit tool warning that the file changed on disk. **Work in `git worktree add ../capy3-X`
when this happens** — never `git checkout` a branch in the shared tree, which would swap their
working files out from under them. Also: `playwright-cli close-all` kills the *other* sessions'
browsers too, and theirs kills yours mid-probe.

Related: [[headless-qa-harness]], [[capy3-external-forces-on-the-capybara]],
[[capy3-instruments-that-cannot-hold-a-line]], [[capy3-slip-and-sky]]
