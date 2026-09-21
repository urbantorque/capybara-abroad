---
name: capy3-fourth-lift
description: "L4 (12-13 Sep 2026) — the camera, the hour, the chase, the departure; what the instruments got wrong and the traps that cost time"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0226d491-c28d-448f-9b11-fb2f48593d58
  modified: 2026-09-12T15:47:28.407Z
---

The fourth lift pass on capy3 (branch lift-pass, commits L4-0..L4-11, 12–13
Sep 2026). Six review agents → ROADMAP-LIFT4.md → batches; CONTRACT.md's top
section is the full record. What was non-obvious:

**A "before" is a stash, never a session.** Trap 25 (modules cache across
`page.goto`) did NOT hold: an E3 before-run in a session opened before the
edit measured the after (gaps exactly 6.0 s, the budget's own constant).
`git stash push -- <files>` → close-all/open → probe → pop; ~10 min per side.

**Two probes had been measuring the title card**: qa/fuzz.js (fixed in L4-1)
and qa/b5-cam.js (`page.mouse.click(640,400)` — every walk/run band a gap,
the idle band the title's drift rig). The Begin button
`document.querySelector('.capyui-go').click()` and `assert started` in
every probe.

**Sydney is the one place the game never ENTERS.** A restore into Sydney
fires no `biome:enter`, so anything armed only on that event (the regular's
tier line) never reaches npc.js on the boot chapter. startGame arms it by
hand for the `!landed` case.

**The cast is never free.** Roster people carry `talkCd` ≈ 14 s after every
line and the abuela's state is `chase`; a gate that waits for `talkCd <= 0`
waits the whole window. Let a greeting follow a bubble after ~3 s and be
said mid-chase inside 3 m.

**The key light fights the evening.** Holding the lit value at a 12° sun
means a sun 5× the authored one — a horizontal noon from the side. Lower what
is held with the sun (−38 % at full evening) and cap the sun at 2× authored.

**The chase's darkness was the bass, not the pulse.** Four cuts: the bendir
pulse alone raised the centroid 94 → 145 but calm (voiced by E2) sat at
200+; the pad must RISE in a chase (the calm state's pad is boosted by the
calm lean), and the intensity's own bass term has to be off during a chase.
Run-to-run spread on qa/l4r-audio-states.js is ±35 Hz — level is the honest
claim.

**Bounds rescues loop on a plane.** Kyoto's ground is an infinite plane; the
walker leaves the colliders at x = 170 and the oldest crumb is 5 m inside the
line. A teleport cannot answer a held key: the edge is a soft wall now
(outward velocity taken off inside 24 m of the line), the rescue for a
carrier or a fall.

**A photo over an unpositioned box takes the whole card.** `.capyui-shot` is
`position:absolute; inset:0` — the host needs `position:relative`.

**The walking lens trade, measured:** 34→24° puts the horizon in frame 18/19
at a walk, and the lower eye (4.7 vs 5.1 m) raises the boom-cut fraction in
11 chapters. Kept, and said in the commit.

**Movement names on the repertoire must never match off the chain**: give
them a `want` kind (`'move'`) the incident ring never carries; award them
from a watcher on `capy.sliding/clinging/swimming/carriedBy`.

Related: [[capy3-third-lift]], [[headless-qa-harness]],
[[capy3-instruments-that-cannot-hold-a-line]].
