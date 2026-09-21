---
name: capy3-review-sweep
description: "The 9 Sep 2026 review sweep: the geometry differential, why systems.js has no seam, and the merger consolidation"
metadata: 
  node_type: memory
  type: project
  originSessionId: e6e73503-ec6f-41b7-9060-8cb08be7da9a
  modified: 2026-09-09T06:33:23.221Z
---

Branch `review-sweep` off `character-pass`, tagged `review-sweep-base` at the
pre-change commit. Six commits.

**THE GEOMETRY DIFFERENTIAL — `qa/rv-geom.js` + `qa/rv-cmp.cjs`.** The instrument
that made the merger consolidation provable, and it is reusable for any change
that touches world building. It seeds `Math.random` via `addInitScript`, builds
all nineteen chapters with `biome.switchTo`, and fingerprints every merged batch
by vertex count, index count and hashes of its position/normal/colour arrays.

The world build is NOT fully deterministic even seeded — about 23 of 1556
batches move between runs — so it is a multiset comparison against the
intersection of three baselines, with **the control printed beside the result**.
The noise floor is 98.52 %, and an honest clean run hits it to the decimal.
Negative control: flipping one chapter to `normals:'keep'` drops it to 97.24 %.

**ONE RUN LIED, AND IT COST A DIAGNOSIS.** Straight after rewriting eight source
files, one run came back 94.60 % with a plausible per-chapter breakdown; four
consecutive runs with nothing changed came back at exactly 98.52 %. Half-cached
modules (harness traps 3 and 25). **The tell: honest noise is the SAME 23
batches in the SAME six chapters (manly 6, kyoto 5, rio 5, cali 3, quay 3,
environment 1) every single time. A bad sample sprays misses across chapters the
diff never went near.** Two consecutive passes is the standard now.

**SYSTEMS.JS HAS NO SEAM — DO NOT TRY TO SPLIT IT AGAIN.** I proposed extracting
its 8744-line module scope as "mechanical, essentially no risk". Measured: 740 of
841 top-level declarations are referenced inside `createSystems()` across **2282
crossings**, and every 500-line window has ~90 % of its names crossing. That
scope is not a table of constants, it is the vocabulary the body is written in.
Extracting it buys a 740-name import statement and a ReferenceError for each one
got wrong. The measurement is in the scratchpad approach: count references after
the `createSystems` line for every declaration before it.

**THE MERGER.** Twenty copies of the vertex-colour merger (1056 lines) became
one `makeMerger(G, opts)` in shared.js. What could NOT be shared, and each of
these would have been a silent visual bug:
- the geometry cache — `quad` is rotated flat in five chapters and upright in
  pantanal; quay and environment carry a `sph5`/`cone4` their own dispatch never
  branches on, so `G[kind+seg] || G.kind6` is **not** equivalent (checked).
- the transform — fifteen compose in `YXZ`, cave/manly/pantanal in default `XYZ`.
- the seg dispatch — passed explicitly as `cylSegs`/`coneSegs`/`sphSegs`.

**AND THE THING THE MERGER WORK EXPOSED:** 17 of 19 mergers call
`computeVertexNormals()` in `build()` and 2 do not. It is not cosmetic —
`mat()` sets `flatShading` so Lambert ignores the normal attribute, but the RIM
reads it (`_RIM_VS_BEGIN` writes `vRimN` from `objectNormal`) and so does the wet
grain. Recomputing substitutes face averages: measured, (0,0,1) becomes
(0.383,0,0.924) on an eight-sided cylinder. **Every call site passes what its own
copy did, so nothing changed — but it is now one word at nineteen call sites and
deciding it is a one-line change.** Nobody has decided it.

**UNWIRED: `sysCREST_SKY`.** The crest camera declares three payout terms and two
comments say three; only DOLLY and PITCH are applied. Left unwired on purpose —
connecting it is ~9 deg of extra eye-lift at every rise in nineteen chapters,
on top of the 4.9 deg `sysCREST_PITCH` already gives, and it would cancel 30 % of
its own dolly (both are multiplied by `1 - skyT`). The constant carries the
measurement and where to wire it (beside `skyEyeT`/`skyRestT`, before `skyT` is
damped — not at the payout site, which runs after).

**NEW CHECKS, all in the asserting half now (6 asserts -> 9):**
- `audit-tasks.mjs` knew only the sampled award path (`sysFINDS`) and reported
  `stowaway` — awarded imperatively via `foundFind('stowaway')` in `biome:enter`
  — as a BLOCKER for its whole life. It was the ONLY blocker, so the one line
  anybody would act on was noise. Both paths counted now, both directions.
- `xmodule.mjs` gained two: the HANG_KINDS table check (an export nothing
  imported, turned into the thing that checks it), and **an unread-tuning-constant
  check** — three in 169k lines, allowlisted with reasons, and it is what found
  `sysCREST_SKY`.

**`qa/` SORTED.** 1396 of 1856 browser probes moved to `qa/probes/` under one
stateable rule: *nothing in the repository names this file*. Nothing deleted.
`qa/README.md` says which half is which. Verified first that all thirteen
re-runnable instruments survive the rule (most via CONTRACT.md).

Related: [[headless-qa-harness]], [[capy3-instruments-that-cannot-hold-a-line]],
[[capy3-names-nothing-publishes]], [[capy3-shared-module-blindness]],
[[capy3-clone-eats-the-shader]]
