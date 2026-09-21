---
name: capy3-sixth-lift
description: "L6 (13 Sep 2026) — the companion, the second ask, the tune, the notebook, the babble; a pass resumed after a session limit killed five agents mid-work, and what that taught about coordinating parallel agents"
metadata:
  type: project
---

The sixth lift on capy3 (branch lift-pass, commits b116180 → the L6
closeout, 13 Sep 2026). ROADMAP-LIFT6.md is the plan; CONTRACT.md's top
section the record. Built with parallel general-purpose agents on disjoint
regions of systems.js, Edit-tool only (IMPL-RULES.md in the scratchpad).

**A session limit kills agents mid-edit and leaves a tree that parses.**
The first session hit its limit with five agents in flight; the tree had
half-wired code (a variable declared and never read, a builder built and
never called) that passed `node --check` and `npm test`. Recovery that
worked: commit the tree AS FOUND with an honest message, then re-dispatch
each section with "grep `(L6, <section>` for what landed; assess each
bullet DONE-BEFORE / DONE-NOW / NOT-DONE; RUN the instrument whatever you
find". Agent reports live in the coordinator transcript inside
`<result>` blocks (extract by raw string scan of the jsonl); the
`tasks/*.output` files are mostly empty.

**Rules that held under five concurrent editors of one 44k-line file:**
Edit tool only (a whole-file write or `sed -i` clobbers the others);
named regions per agent; `playwright-cli -s=<own>` and never
`close-all`; two dev servers (5188 the coordinator's, 5190 the agents');
"do not commit"; one `npm test` at the end. One transient `npm test`
failure while another agent's edit lands is normal — re-run.

**Findings worth keeping:** C put the camera rig in the animal's face
(rotation.y, not + π) — every C press since the key existed; a fixed tune
fits 21 chords only if five of eight notes are tonic/fifth; a per-line
voice at the blip's PEAK is ten times the blip's energy (0.32 → 0.14); a
count that lives inside a greeting's cooldown counts nothing (travMet
0/4); the fuzz's solver-save gate must allow a handful of clamps (5), not
zero; the walking lens sits above a piazza's heads so a "person in the
lens" instrument on open paving is vacuous.

Related: [[capy3-marquee-pass]], [[capy3-fourth-lift]], [[headless-qa-harness]].
