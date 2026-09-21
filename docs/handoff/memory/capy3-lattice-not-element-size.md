---
name: capy3-lattice-not-element-size
description: "Integrity block 10 — a ground mesh and its heightfield agree only if the SPAN divides by the element size, and six chapters' spans do not"
metadata: 
  node_type: memory
  type: project
  originSessionId: 67d5a05a-5f1d-451c-ac07-4758c6207f5e
  modified: 2026-08-28T14:24:28.169Z
---

Integrity pass block 10 (29 Aug 2026, commits 91acb81 + 7d123e1), which closed
the pass.

**The finding.** `new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, NX, NZ)` steps
`(X1 - X0) / NX`, which equals the intended EL **only when the span divides by
it**. Monte Carlo's z span is 550 at EL 4, so the drawn ground stepped 3.98551
while its `CANNON.Heightfield` stepped exactly 4 — the two lattices meet at one
end and are two metres apart at the other, and on a slope of 1–2.5 that is
metres of height. Block 3 had already matched the element size and could not
move the number. Build the plane over `NX * EL` and translate from the corner.

Measured on `qa/b3-ground.js`: monaco 17.2% → 10.8% over 15 cm (7.2% on
walkable ground), cave 5.4% → 0.5%. **Suspected in five more chapters** — cali,
antarctic, manly, pantanal all have span/EL mismatches or two different ELs;
rio and iceland divide exactly, so their 11.4% and 9.8% are a different,
undiagnosed cause.

**The residue is triangulation and cannot be fixed this way.** PlaneGeometry and
CANNON.Heightfield split each quad on opposite diagonals, so on a cell that
rises as much as it is wide the two surfaces differ by metres. Only matters on
cliffs, where nothing stands.

**The pass's real lesson, across ten blocks: five of the summary table's nine
columns measured something other than their name.** The ring/scenery metric was
mesh-only (blind to every InstancedMesh) and read 20–36% for rings that are
100%; `law15` compares against roofs; `slope burial` never touches the model;
`bnd` asks the wrong question; `foot gap` does not repeat run to run. Before
acting on any number from `qa/rev-summary.mjs`, read the column notes at the
foot of `.claude/skills/integrity/SKILL.md`.

**And a chapter shaped like a corridor cannot be measured on radial bearings** —
Son Doong carried "shortest world in the game, 72 m" through the whole pass
because six of eight bearings hit a wall; along its axis it is 290 m, the
longest.

See [[capy3-spawn-rings-and-frontage]], [[capy3-biome-build-gotchas]],
[[capy3-visibility-metrics]].
