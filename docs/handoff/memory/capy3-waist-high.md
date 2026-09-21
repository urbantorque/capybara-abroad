---
name: capy3-waist-high
description: "The 11 Sep 2026 walk-through pass (V1/V2): the solidity audit's 1.6 m floor hid a year of parapets, trunks and furniture; the instanced-mesh pass; the labelled paper"
metadata: 
  node_type: memory
  type: project
  originSessionId: 2fb1f952-10b8-48b0-92a5-c0aa28996afa
  modified: 2026-09-11T04:00:07.619Z
---

Reported 11 Sep 2026 from a Cali screenshot: camera inside the riverside
parapet, animal inside a ceiba. Fixed as V1 (colliders) + V2 (HUD labels);
CONTRACT.md has the tables.

**THE AUDIT WAS RIGHT ABOUT THE WRONG QUESTION.** `qa/audit-solid.js` keeps
only drawn-not-collided things >= 1.6 m tall (building vs tuft). The capybara
is 0.68 m tall and `solidRISE` is 0.62, so a 1 m parapet, a terrace wall, a
bench, a bar and every tree trunk were invisible to it for a year while it
reported "residue is vegetation". `qa/audit-solid2.js` uses a 0.7 m floor and
adds an INSTANCED pass: every instance's world AABB (stands on ground, >= 0.25 m
thick, >= 0.7 m tall) checked for any static collider under its footprint —
finds 0.4 m trunks a 3 m ray grid misses. `qa/solid-explain.js` names a hit by
the vertex colour of the triangle -> palette name -> builder line; it is the
only way a 38k-tri merged mesh says which part you walked through.

**What it found: the same omission as [[capy3-solid-or-drawn]] a rung lower.**
Cali parapet + 46 trunks + salsoteca bar/posts + road kerb on side-slopes +
bridge piers; Kyoto 360 sugi + 42 maples + sando fence + Uji furniture and
signposts; Rio 110 palms + 260 forest cones; Drift trunks + logs + stumps;
Göreme vineyard walls; Palawan 90 leaning palms; Sahara garden palms.
Bodies: kyoto 254->718, cali 197->477, rio 59->188.

**Rules that decided what stays open:** a trunk on a scored route stays
walk-through (`kyoOnPath`: torii corridor + sando) — moving the placer would
reshuffle every later rand(); cane/bamboo/shrubs/reeds/vines/tufts by design;
pond-rim and lagoon-shore rocks because the water is the task; kinematic
carriers' undersides (chiva chassis under its 0.65 m deck box, Göreme truck).

**Instrument traps, new:** (1) a pooled compound body's AABB is the whole
vineyard, so the instanced pass reads every vine as "inside a collider" once
one wall joins the pool — read the ray pass for pooled chapters; (2) instance
counts differ between loads (placers reject off rand()), pair rows by
name+colour; (3) the 66 sky cloud puffs hit the chest ray where a hill climbs
to their altitude (Pasto 35) — not structures; (4) `qa/fuzz.js` Monaco read
605/293/285 solver saves while a SECOND playwright session was busy, then
0/0/0 on both trees once it was idle: kinematic velocity cap (90) under frame
stall, cars top at 26.5 — not a collider. (5) `page.keyboard.down('W')` is
shift+w; use 'KeyW'. A digit from the title card starts the game; `mouse.click`
alone leaves `started` false and the keys do nothing while physics still runs.
(6) Test a parapet FROM the walkway outward — from the lawn the embankment's
own box stops you and the test passes without the parapet. And x 30 on the
Cali river is the Ermita: check the AABBs round a chosen spot first.

**Proved by walking with a differential** (`qa/q1-walk.js`, stash -> same
script): before through the parapet to the lawn, 0.07 m from the ceiba
centre, 0.04 m from the sugi; after stopped at the drawn face (1.78 / 1.68 m,
= box half + two spheres).

**V2, the paper:** every confusing element had an aria-label and no visible
word. Now: `✦ THE BIG ONE HERE` eyebrow; `part 2 of 3` over the act kicker
(hidden for one-act chapters); `4 OF 10 DONE`; `two secrets hidden here ·
none found yet`; `PUFF/BREATH/NO PUFF` pill beside the stamina bar (bar is
role=img with the same name); `CHAIN · 2 OF 5` over the pips; `title`s on the
row glyphs; one caption per journey (`paperEver` on the save) 8 s into the
first chapter. My pass tags are V1/V2 — Q1/Q2 were already taken by the
repertoire/forty pass; check `grep "(X1)" src/*.js` before picking a tag.

Related: [[capy3-solid-or-drawn]], [[capy3-under-the-floor]], [[capy3-the-paper]],
[[headless-qa-harness]], [[capy3-shared-space-leaks]]
