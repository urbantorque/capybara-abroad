---
name: capy3-seventh-lift
description: "L7 (14–17 Sep 2026), CLOSED — the musician in 13/19, on-the-house, the weather front and seven areas; the parcel withdrawn; resumed after a session limit; the import-comment that failed the stripper; the marqId string-swap trap; the sidechain is a bus, not a table"
metadata: 
  node_type: memory
  type: project
  originSessionId: d2a6c032-4cc3-4e6f-8ca5-06c33df31177
  modified: 2026-09-17T04:29:51.948Z
---

The seventh lift on capy3 (branch lift-pass, ROADMAP-LIFT7.md from commit
7c6bb17). The user withdrew F1 (the parcel) on 17 Sep before execution
began — three features remain (F2 musician + J-cut, F3 on-the-house + show
me, F4 weather front) and seven areas (E1–E7).

**Resumed the same way L6 was.** The first session's six wave-one agents
were killed by a session limit; the tree (2031 lines into systems.js, 80+
`qa/l7-e*` probes) was committed AS FOUND (6c93cfc). Recovery: a RESUME.md
beside IMPL-RULES.md in the scratchpad telling each agent to grep its
`(L7, <section>` tags, classify every bullet DONE-BEFORE / HALF /
NOT-DONE, finish, and RUN every instrument including the DONE-BEFORE ones.
Tag counts at resume: E2 59, E5 50, E1 48, E4 33, E3 29, E6 21.

**The stripper fails on a comment after an import.** `qa/strip-test.mjs`'s
IMPORT_RE requires the line to end right after the `';` — a trailing
`// comment` on an import line leaves it unstripped and `vm.Script` then
fails with "Cannot use import statement outside a module". `node --check`
passes (it parses as a module). Fix: move the comment to its own line.
Agents tagging their regions must not tag an import inline.

**The previous scratchpad survives.** IMPL-RULES.md and the six review-*.md
were in the killed session's scratchpad under
`Temp/claude/C--Users-roger-OneDrive-Desktop-capy3/<session>/scratchpad/`;
`ls -t` on IMPL-RULES.md finds the newest. Copy, do not rewrite.

**Closed 17 Sep 2026** (closeout is the L7 section at the top of
CONTRACT.md; `master` fast-forwarded to `lift-pass`, Pages redeployed).
Three sessions total. Wave two was built serially in one session, not by
four agents. What the close taught:

- **A stale `nextIn(id)` gate is not fixed by swapping the string.**
  Palawan/Hanoi/Iceland/Pasto's `nextIn` still gate on the OLD wow id
  (bloom/train/whale/carroza, since demoted to minis); the math inside is
  the old event's countdown. Renaming the id would paint that number onto
  the manta/pho-run/aurora/condor label. All four real marquees are
  player-triggered — the right channel is `sysMARQUEE_WHY` (a why-line in
  words), which now covers all five clockless chapters.
- **The walking sidechain is one gain after `musPad`** (`musSideG`,
  systems.js ~21788). Every band voice writes to `musDrum`/`musPluckDry`
  and bypasses it, so Rio/Cali (and the other four band palettes) are
  never ducked. Not a config row — a new duck factor through the
  band-voice output path, scoped so the 15 lead chapters don't change.
  Held, not attempted.
- **A tune mover whose `hz` does not move is in its 60 s gap** (`tuneIdx`
  −1, `tuneIn` counting down), not stuck. Both fields are on
  `moverAudit()` rows now; `moverAudit()` returns `{rows, live, n, …}`,
  not an array.
- **The musician recipe** (`game.addLocal` or the chapter's `put()`, a
  `beat`, `xxxTuneMv = game.sfxMover('tune', {key:'<biome>:musician',
  biome})` + `.at(x, y+1, z)` at the end of `update`) worked unchanged in
  Monaco (which has a `put(x,z,o,deck)` that probes the height and skips
  water) and in Pasto, whose file has no other `addLocal` at all. Band
  palettes get no second-voice answer by design (`sysMUS_2ND` row null).
- **Harness:** `server.mjs` defaults to :5173 but `qa/_boot.js` hardcodes
  :5188 — start with `PORT=5188`. `run-code` does not surface Node-side
  `console.log`; return data through `POST /shot?name=X` (always writes
  `qa/X.png`, read it as text). `g.marqueePoint()` gives the paper's own
  marquee point; `.capyui-toast.why` is the why-pill's class.

Related: [[capy3-sixth-lift]], [[headless-qa-harness]], [[capy3-owed-and-the-link]].
