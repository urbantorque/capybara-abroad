---
name: capy3-owed-and-the-link
description: "L6-5 (13 Sep 2026) — the owed paid and the game published: the remote is github.com/urbantorque/capybara-abroad, the game is urbantorque.github.io/capybara-abroad (Pages via a workflow on master); the build was the merger's clone; a rising floor is a throw; the still state moves 4 dB"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0226d491-c28d-448f-9b11-fb2f48593d58
  modified: 2026-09-13T12:14:44.492Z
---

**The remote and the link (13 Sep 2026).** `origin` = https://github.com/urbantorque/capybara-abroad
(public; default branch `master`, fast-forwarded to `lift-pass` each push — master is an
ancestor, so `git branch -f master lift-pass && git push origin master lift-pass`). GitHub Pages
is `build_type: workflow`: `.github/workflows/pages.yml` runs `node build.mjs` on every push to
master and deploys `dist/untitled-capybara-game.html` as `site/index.html`, so the shareable
link is **https://urbantorque.github.io/capybara-abroad/** and nothing else lives at that path.
The first push did NOT trigger the workflow (0 runs); a `workflow_dispatch` via the API did,
and later pushes should. Credentials: Git Credential Manager holds an OAuth token for
`urbantorque` (scopes gist, repo, workflow); `git credential fill` yields it for curl calls to
api.github.com without printing it (never echo it). No `gh` CLI on the machine. There is still
no LICENSE (LICENSING.md) — the author's call; the user said the link is for friends.

**What the batch found:**
- **The build was the clone.** `makeMerger.add()` did `geo.clone()` per primitive, and
  `BufferGeometry.clone()` is `new this.constructor().copy(this)` — for SphereGeometry /
  CylinderGeometry that constructs a default 32×16 sphere to throw away. Two-thirds of every
  chapter's build. In-place transform through `Vector3.applyMatrix4` / `applyNormalMatrix` is
  bit-identical (node A/B) and 15×. Also `Body.addShape` is O(N) per call (mass properties
  over all shapes): push `shapes/shapeOffsets/shapeOrientations` and update once.
- **The switch frame = build + compile in one frame.** Deferring `biomeWarm` to a `setTimeout(0)`
  after `biomeGo` (hold raised synchronously) splits it: ≤ 250 ms in 19/19 by the split probe,
  18/19 by qa/l6-load.js on a quiet machine — and 8/19 when OneDrive was syncing. Measure quiet.
- **A rising floor is a throw** to the perch (vy > 5.4). The balloon basket's solver kick reached
  8.3 m/s; clipped to rise + 1 m/s, and `capy.floorVY` is subtracted. The perch also drops a
  passenger when the herd hold (21 s) runs out — a long ride needs a wheek every ~12 s.
- **The still state moves ±4 dB run to run** (qa/l6r-audio-states.js), so "chase ≥ still + 4 dB"
  is inside the noise; report both runs, don't tune to one.
- **A steering bot must steer in the page every frame**: a 100 ms playwright loop cannot hold
  the Uji hairpin; an in-page rAF loop setting `input.camYaw` toward `aheadOnRiver(p, 3)` with a
  1.5 m inside bias swims it in 13.7 s (par was 42, now 24).
- Probes that need a key held (E burner) and a periodic tap (Q) work fine; key taps of 100 ms are
  lost under contention (a long frame swallows down+up) — run probes one at a time.

Related: [[capy3-sixth-lift]], [[capy3-marquee-pass]], [[headless-qa-harness]],
[[capy3-instruments-that-cannot-hold-a-line]].
