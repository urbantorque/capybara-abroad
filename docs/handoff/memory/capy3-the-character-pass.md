---
name: capy3-the-character-pass
description: "The 6 Sep 2026 art-direction review of the capybara, crowds, locals and animals; ROADMAP-CHARACTER.md's six no-regret items, and the three instrument traps a close-up review hits"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T05:46:41.471Z
---

Review written 6 Sep 2026 after F4g (build 0.60.0): `ROADMAP-CHARACTER.md` in the
repo root, a published artifact page of the same, renders in `qa/AR-*.png` /
`qa/AR2-*` / `qa/AR3-*`, crops in `qa/art/`, instruments `qa/art-review*.js` and
`qa/art-thumb.cjs`. Uncommitted at the time of writing. Nothing in src was changed.

**The verdict, in one line:** the animation is better than the model. The rig,
face system, gait, hop, loaf and ear work all read at playing distance; what is
left is SHAPE (three-sphere body with a rump seam, brick muzzle, dice feet) and
SURFACE (one flat brown, one flat colour per instanced part on every person).

**The six items (R1-R6), and the rule that made them no-regret:** zero new draw
calls on the animal, no change to any number another system reads (hop apex
0.93/1.37, three-sphere collider, capyFOOT_Y 0.34, brow signs, mouth anchor),
one-commit revert. R1 vertex-colour coat; R2 one hand-authored hull replacing
seven blobs; R3 bevelled muzzle with DORSAL nostrils + 8x6 eyes; R4 toed feet
and a loaf that tucks the rear feet; R5 breath folded INTO the squash writer;
R6 a per-part colour multiplier in `npcMakeGeo` (shoes, brim undersides, eye
whites) at zero draw calls, plus a real hat for the locals (theirs is a 42 cm
PLATE, `npc.js` `buildLocalFigure`). Sequenced C1 colour / C2 shape / C3 motion.

**Measured:** capybara 39 meshes / 1 460 tris bare, 57 / 1 812 in black tie,
54 / 2 108 in the parka; a roster person is 352 tris across 12 instanced parts.
The nose pad (palette 0x5f3d29) RENDERS PALE GREY from front and 3/4 in daylight
and dark only with the head pitched; cause not yet measured, so R3 says measure
the pixel before rebuilding it.

**Three instrument traps for any close-up review** (family of [[headless-qa-harness]]):
1. `game.frameShot` clamps `dist` to `sysCAM_MIN` = 7 m. A close-up needs its own
   `PerspectiveCamera` and `renderer.render` + `toDataURL` in ONE `page.evaluate`.
2. The raw canvas render comes out at whatever size the adaptive scaler left it
   (896, 1023 and 1280 wide in one session). Crop by FRACTION, never by pixel.
3. Instanced people have no node to ask. Decode the torso `InstancedMesh`'s
   matrices (72 verts, count = cast size; Pasto 13, Sydney 32) and take the third
   column for facing. The llama/dog finders by height missed twice; the
   playing-distance frame was enough for them.

**Also:** the design-taste-frontend skill declares documents out of scope (it is
for landing pages); for a review/handoff page use artifact-design and the
game's own paper system (sail / ibisHead ink / capy brown accent).

Related: [[capy3-faces-and-bodies]], [[capy3-the-wardrobe]],
[[capy3-the-body-second-half]], [[capy3-the-subject]], [[capy3-render-pose-heuristics]]
