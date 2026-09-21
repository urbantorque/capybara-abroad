---
name: capy3-the-coat
description: "R1 of the character pass: the capybara's vertex-colour coat, and the finding that a gradient hung off the base colour is a P1 silhouette regression"
metadata:
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T06:30:18.889Z
---

Built 6 Sep 2026, the first item of [[capy3-the-character-pass]]. Code:
`capybara.js` THE COAT (R1) block plus three palette stops in `shared.js`
(`capyFlank` 0xbe8150, `capySpine` 0x985f38, `capyThroat` 0xd58b50).
Instruments `qa/coat-probe.js`, `qa/coat-silh.js`, `qa/coat-states.js`.
Left uncommitted (npc.js and systems.js already had someone else's work in
the tree). No geometry added: 39 meshes, 1 460 tris, 140 draw calls, before
and after.

**THE FINDING, and it generalises past this animal.** A vertex-colour gradient
that is one wide darkening (the dorsal surface, which from a 35 degree camera
is most of the silhouette) against two small brightenings does not
redistribute the subject's light, it REMOVES it: measured 4.6% of the mean.
That is free contrast on a bright ground and a straight loss on a dark one,
and it cost a quarter of Cali's silhouette (P1's weakest chapter, 23.5 -> 17.9)
while improving Sydney's. **No gradient can raise contrast in every chapter** -
darker helps on light ground and hurts on dark. So the target is MEAN-NEUTRAL:
change the variance, leave the average. The fix is that the flank is NOT the
base colour; `capyFlank` is `capy` warmed by the measured 1.077. Family of
[[capy3-the-subject]].

**Four traps this paid for:**
1. A material with `vertexColors: true` on a mesh with NO `color` attribute
   renders BLACK, not a warning (WebGL's default generic attribute). So paint
   by a traverse that finds meshes by MATERIAL, never a list of part names.
2. Both twins of every soak pair need the flag: the swap writes
   `mesh.material` and never the geometry, so the PAIRING is the invariant.
3. systems.js re-asserts the chapter's costume every frame (`capy.wear(put)`),
   so a probe that ticks between `wear` and its render photographs a naked
   animal and reads it as a broken wardrobe.
4. sRGB numbers, linear multiply: 0.80 handed straight to the shader renders
   as 0.90. Convert (THREE.Color for palette-derived stops, `^2.4` otherwise)
   or the polish measures as nothing. Family of [[capy3-clone-eats-the-shader]].

**Two roadmap numbers that were wrong.** The spine band at 0.10 half-width
contains exactly one vertex meridian of an 8x6 sphere and renders as a SEAM;
0.20 reads as a band and also catches the skull box's top corners at |x| 0.18,
without which the head stays a brighter block in front of a darker back.

**Measured after:** spine/flank 0.861 broadside, 0.772 from above (was 1.032
and 0.917); the vertical cut runs 0.849 at the top of the back to 1.064 at the
belly. Silhouette contrast +1.0 / -2.5 / +1.3 / +3.4 % across sydney / cali /
sahara / antarctic, and Cali's own coat-off baseline came back 23.5, 24.9 and
21.8 on three runs, so that -2.5% is inside the instrument's noise. Add it to
[[capy3-instruments-that-cannot-hold-a-line]].

Related: [[capy3-the-wardrobe]], [[capy3-ghost-and-incident]],
[[headless-qa-harness]]
