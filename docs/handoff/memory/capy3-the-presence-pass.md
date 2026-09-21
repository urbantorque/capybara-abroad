---
name: capy3-the-presence-pass
description: "The 28 Aug 2026 audit after /polish — what the polish pass actually bought, the wind nobody draws, and the two batches behind /presence"
metadata: 
  node_type: memory
  type: project
  originSessionId: 28afdbb2-9429-4783-9253-4cf83cf06089
  modified: 2026-08-27T19:53:08.512Z
---

Analysed the shipped `audit-fixes` build (commit 39277a0) after [[capy3-the-polish-batch]]
landed all four phases. Wrote `qa/PRESENCE-PASS.md` and the `/presence` skill
(`.claude/skills/presence/`, batches ONE and TWO). Nothing in src changed.

**The polish pass worked, and the numbers say by how much.** Ground band SD:
Palawan 2.05 → **7.72**, Sydney 3.98 → **8.78**, Monte Carlo 12.53 → **21.17**.
Rio is still **56.25 / 175 colours** and still the only chapter with a graphic on
the floor. So the near octave took floors from *one colour* to *one colour with a
texture on it* and cannot go further — the remaining 6-9x gap is drawing, not
shading.

**The finding no previous audit had: the wind is authored and invisible.**
`wxMOOD` carries nineteen rows of `gust: {base, swing, hz}` + bearing `dir`.
`api.wind()` has exactly **two** consumers — `capybara.js:845` (drift air frame)
and `props.js:2900` (the shove). There is **no vertex animation anywhere in this
codebase**; grep every module for foliage/canopy/banner/awning/sail motion and it
returns nothing. Nineteen worlds of palms and cloth, none of them move.

**Still open from before and confirmed live:** zero point lights in 8 of 9
chapters (Kowloon's ground *still* 34.1/255, was 34.3 — the near octave bought
that chapter nothing because it modulates a diffuse receiving no light); no AO or
contact term anywhere, so everything floats in six of six photographs; no sun
disc in `sysBuildSky`; and `sysGrade` (`systems.js:1085`) hard-codes
`liftR/G/B: 0` in its **return**, so no grade row *can* set a lift — the split
tone its comments describe is unbuildable, not merely unbuilt.

**The budget is not the constraint.** 1.42–2.01 ms/tick across eight chapters,
76k–304k tris. That is what makes a light pool affordable.

**Why the batches split by risk, not by subject.** ONE = contact + sway: two
shared opt-in shader terms, zero new draw calls, zero re-grading, so nothing in
it can move a bloom threshold — safe unattended. TWO = lights + floor graphics +
sun/lens: the only change that can cost frame time, and the one that re-grades
all twenty rows, so it wants ONE settled underneath. Both batches ship system
*and* call sites, because a published system nothing calls is the failure in
[[capy3-payoff-batch-one]].

**Why:** the game's engagement systems (tasks, journal, ledger, album, souvenirs,
records, acts, finds, NPC heat) are further along than its picture. The honest
lift is in the picture and in aliveness, not a nineteenth system.

**How to apply:** run `/presence` (both) or `/presence 1` / `/presence 2`.
`/presence list` prints the plan. Probes: `qa/na-scan.js` (ground+sky bands,
light census, ms/tick, 8 chapters), `qa/na-rio.js` (the benchmark),
`qa/na-shots.js`. See also [[capy3-instruments-that-cannot-hold-a-line]].

**Two traps paid for in this run.** `run-code` needs `--filename=`; a bare path
is a `ReferenceError`. And a framebuffer pixel-diff is **not** an aliveness
metric — it returned 53–76% of pixels moved in a world with zero vertex
animation, because it was measuring camera settle. That probe was deleted rather
than left to mislead. Also: `Comma` is **Antarctica**, not Pantanal (Pantanal is
`Semicolon`) — only the `g.biome.current` assertion caught it.
