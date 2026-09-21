---
name: capy3-nine-skills
description: "v43: the nine chapters that teach a move instead of a costume, and the five instruments that lied"
metadata: 
  node_type: memory
  type: project
  originSessionId: 888a28cc-359f-4fe1-8a49-90d7217b8d22
  modified: 2026-08-30T01:09:38.965Z
---

The ten chapters with a costume ([[capy3-the-wardrobe]]) left nine without. Those nine now teach
a MOVE. `capySkill` + `capy.can/learn` in capybara.js, `sysSKILLS` in systems.js, two of them
read in npc.js.

**COSTUMES STAY, SKILLS TRAVEL — and that split is the design.** A costume is the chapter's joke;
a skill is a thing the animal learned. That is this repo's own rule for the dive and the climb
(`capyCanDive`, `sysDIVE_TAUGHT`, the `brought-` finds), so `sysSKILLS` has NO biome column.

| ch | teacher | skill | measured off → on |
|---|---|---|---|
| 2 pasto | `the-rim-walk` (FIND) | lungs — stamina | run 10.02 → 14.12 s; recovery 4.32 → 2.87 s |
| 4 kyoto | `still-bamboo` (FIND) | quiet — soft feet | alarm 1.0 → 1.0; wariness 0.985 → 0.443 |
| 5 cali | `salsa-dance` | beat — hop on the pulse | standing hop 0 → 0.76 m; apex 0.93 → 0.93 |
| 7 iceland | `glacier-run` | carve — steer on slip | lateral 6.65 → 12.86 m |
| 8 sahara | `acrobats` | vault — wall-kick | rise 0.97 → 1.54 m |
| 9 drift | `driftseed` | seed — glide | 2.5 s fall 57.0 → 10.8 m; rate −1.85 exactly |
| 11 kowloon | `bamboo-climb` | mantle — catch the lip | topped out 0/6 → 5/6 |
| 15 pantanal | `gather` | herd — wheek and they follow | pigeon w1, sheep w1, cat w2, heron w3 |
| 15 pantanal | `the-crossing` | float — loaf on water | loaf 0 → 1 |
| 19 hanoi | `cross-the-road` | flow — right of way | committed 0 → 124/180 straight, 16/180 wavering |

**THE HARD CONSTRAINT: NOTHING MAY CHANGE THE JUMP APEX.** The hop's own comment in capybara.js
says eighteen chapters of geometry are sized against 1.37 m and a changed arc is the worst
regression this game can have. So the beat bonus is HORIZONTAL (same channel as the run-up), the
vault is a NEW launch not a bigger one, and the seed only ever slows a descent. Assert the apex
in any A/B that touches the hop — it came out 0.93 on and off.

**FIVE INSTRUMENTS THAT LIED, and every one looked like a working feature:**

1. **`the-rim-walk` GRANTED NOTHING.** It is a `FINDS` row, not a `TASKS` row. `taskRec` and
   `findDone` are two registries that do not know about each other and a skill row naming
   neither fires silently for ever. **There is no public find-setter**, so a probe cannot grant
   a find-backed skill — force it with `capy.learn(id, true)` INSIDE the tick loop instead
   (systems.js rewrites it from the table every frame, so once before the loop is not enough).
2. **A DAMP LOSES TO GRAVITY BY 3×.** capybara.js runs BEFORE the world step, so the solver puts
   back each frame what the damp took. The glide at lambda 6 settled at −5.64 m/s against a
   stated −1.85 — much better than terminal velocity, therefore "obviously working". Flare with
   a damp, then ASSIGN the rate.
3. **THE WALL-KICK HAD NO WALL.** Ten bearings five metres off the Kowloon spawn found ZERO
   climb holds, because the spawn sweep deliberately puts the animal in the clear. Same family:
   hunting a low lip by settling at ~1000 candidates timed out at two minutes. **Locate the
   geometry once with a cheap scan, write it down, and CONSTRUCT the test against it.**
4. **THE BEAT WINDOW CANNOT BE SAMPLED FROM A TICK LOOP.** `ac.currentTime` is a real clock and
   `g.tick()` runs hundreds of sim frames per real second, so sixteen hops inside one
   `page.evaluate` all sample the same beat phase — all hit or all miss. Real `waitForTimeout`
   between hops, and read `music.off()` at the press so a hit is attributable.
5. **`g.groundY` DOES NOT EXIST.** Three probes placed the animal at a guessed height and
   measured a falling animal. Settle it from a modest height and read `capy.grounded`.

**SOFT FEET SCALES WHAT IS LEFT BEHIND, NOT THE FRIGHT.** Scaling `alarm` would make the animal
quiet by making the world unresponsive. `rec.alarm` is untouched and only the wariness it writes
is multiplied (`npcQUIET_K` 0.45) — alarm 1.0 either way, wariness more than halved.

Soaked with `qa/skillsoak.js`: 19 chapters, all nine forced on, W+Shift+Space held 4 s each.
0 errors, 0 NaN.

**THE HERD IS THE ONE THAT IS A SYSTEM** — see [[capy3-the-herd-anywhere]].

Related: [[capy3-the-wardrobe]], [[capy3-external-forces-on-the-capybara]], [[headless-qa-harness]],
[[capy3-the-movement-pass]], [[capy3-the-place-remembers]]
