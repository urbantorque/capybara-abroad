---
name: capy3-the-wardrobe
description: "v42: ten costumes, the rule for which task earns one, and the four ways a hat on a capybara fails"
metadata: 
  node_type: memory
  type: project
  originSessionId: 888a28cc-359f-4fe1-8a49-90d7217b8d22
  modified: 2026-08-29T23:31:40.014Z
---

Ten of the nineteen chapters now hand the animal a costume. `capy.wear(id)` in capybara.js,
`sysWARDROBE` in systems.js, asked every frame. Grew out of the Monte Carlo dinner jacket —
see [[capy3-the-yacht-and-the-band]].

**THE RULE FOR WHICH TASK EARNS ONE, and it is the whole design: the task has to be THE REASON
YOU HAVE THE THING.** Not a badge for finishing a chapter, not the marquee by default. Five of
the ten are deliberately not their chapter's `wow`:
  ch1 `steal-hat` → the sun hat (it IS the hat you took, and the chapter's keepsake)
  ch3 `manly-voyage` → the master's cap (not `take-helm`; the cap is for the landing)
  ch6 `samba-parade` → plumes ·  ch10 `gondola-ride` → boater (not `acqua-alta`, a flood)
  ch12 `first-dive` → mask and snorkel (the only one that is equipment, not uniform)
  ch13 `sunrise` → the pilot's cap ·  ch14 `all-the-way` → the surf cap (not `take-off`)
  ch16 `the-doline` → the caver's helmet (not `great-wall`)
  ch17 `orca-ride` → the parka ·  ch18 `black-tie` → the dinner jacket
Scoped to the chapter. A costume that travels is fancy dress.

**FOUR WAYS A HAT ON THIS ANIMAL FAILS, all measured:**

1. **THE EARS ARE HIGHER THAN THE SKULL.** Skull top is head-y 0.18; the ears run 0.12–0.278.
   A brim that clears them floats; a brim at ~0.20 lets the tips through and reads as worn.
2. **A CAPYBARA HAS NO NECK.** Skull box z 0.08–0.58, jaw z 0.52–0.76 — nothing between the
   shoulders and the muzzle is EVER on screen from any angle a player has. A shirt front on the
   chest is invisible. The only readable throat is the 4 cm under the jaw's front; that is where
   the tux's wing collar and the boater's neckerchief go.
3. **A COSTUME THE COLOUR OF THE ANIMAL IS A LUMP.** `capyLeather` shipped at 0x7d5334 against
   fur 0xb0784a and the Cappadocia flying cap DISAPPEARED in that chapter's warm light. The
   palette block states this rule and then broke it. Dark + cool, and cream shearling trim doing
   the separating. Check every new costume colour against 0xb0784a / 0x94603a / 0xc79063.
4. **TWO SYMMETRIC BOXES ON THE SHOULDERS READ AS ONE SHARD FROM 3/4.** Rio's collar is a RING
   round the base of the skull, not a pair of slabs. Same class: the parka ruff's arc must have
   a SYMMETRIC gap (0.95 rad, at the jaw) — an arc that just stops after 86% of a circle leaves
   a bald quarter and the hood looks knocked askew.

**THE TEST THAT ACTUALLY TESTS IT.** `traverse` does NOT stop at an invisible node, and every
costume mesh is `visible: true` inside a hidden group — so counting `o.isMesh && o.visible`
returns the SAME NUMBER dressed and bare and proves nothing. The count has to walk each mesh's
parents. Same trap as the ghost bake, which was baking hidden costumes into the ghost for the
same reason. `qa/wear-smoke.js`: 31 bare, +4..18 per costume, exactly one on after ten swaps,
unknown id fails safe to bare, ghost restores what was on.

To force one for a screenshot, `capy.wear(id)` alone does NOTHING — the per-frame rule in
systems.js overwrites it on the next tick. Use `game.completeTask(id, true)` (silent) and let
the rule dress the animal; that also tests the real path.

**THE REPO HAS A COMMITTER SESSION.** On 30 Aug a second Claude session committed this work's
in-progress working tree as `88e75e8 the wardrobe, so far` ("Committed as found in the working
directory, not authored here") and wrote its own `qa/wear-smoke.js` against `capy.dress()`.
Nothing was clobbered, but: check `git log` and `git status` at the start of a turn, keep old
public names working (`dress(on)` survives as `wear('black-tie')`), and expect review notes in
commit messages — that one correctly flagged `capyGeoBox` as a duplicate of `capyGeoFoot`.

Related: [[capy3-the-yacht-and-the-band]], [[headless-qa-harness]], [[capy3-render-pose-heuristics]]
