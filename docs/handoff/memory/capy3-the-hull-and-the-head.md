---
name: capy3-the-hull-and-the-head
description: "R2+R3 of the character pass: one hull replaces seven blobs, and the measured reason a dark nose renders pale (the rim is additive and rides on the interpolated normal)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4f23f324-c22a-414b-bd61-cbad7fb270fa
  modified: 2026-09-06T07:29:22.285Z
---

Built 6 Sep 2026, straight after [[capy3-the-coat]]. Code: `capybara.js` THE
HULL (R2), THE MUZZLE / THE NOSE PAD (R3). Instruments `qa/hull-probe.js`,
`qa/pad-why.js`, `qa/wear-parts.js`, `qa/wear-fit.js`, `qa/hull-stand.js`.
Budget 39 meshes / 1 460 tris becomes 35 / 1 356. Left uncommitted.

**THE BIG FINDING, and it is not about a nose.** The rim in `shared.js` is added
to `outgoingLight` and is a Fresnel on `vRimN`, an INTERPOLATED varying. So:
(a) it does not care how dark the albedo under it is, and (b) a primitive with
few radial segments puts its vertex normals on the CORNERS, 45 degrees off the
faces they belong to. The nose pad was a 4-segment tapered cylinder squashed to
0.30 in z, so its whole surface rimmed as though edge on. Measured
(`qa/pad-why.js`, black-albedo pass gives the additive term exactly):

| | pad | muzzle beside it |
|---|---|---|
| albedo, pad/muzzle | 0.256 | 1 |
| RENDERED, from the resting lens | **1.120** | 1 |
| fraction of the pixel ADDED after albedo | **0.731** | 0.049 |

A BLACK pad still rendered at 69 grey levels. **No colour in the palette could
have fixed it.** Fix is geometry: hand-authored, non-indexed, per-face normals,
plus `matSelf` so it is in the animal's rim budget not the scenery's. After:
additive fraction 0.104, pad renders at 0.455 of the muzzle. **The materials
block's old note that accents stay on `mat()` "because they are never on the
outline" was wrong: the rim is not a silhouette effect.** Family of
[[capy3-clone-eats-the-shader]].

**P1's silhouette contrast is COUPLED TO SHAPE, not just value.** It is
`|animal - the background it covers|`, so growing the silhouette changes the
background term. Cali fell 23.4 to 20.1 from the hull alone, but the animal
only moved 106.5 to 105.5: what changed was the revealed background, 82.9 to
85.4, because the silhouette grew 10% into brighter, further ground. Split the
two terms before calling a shape change a regression. Its own spread on the
unchanged build: sydney 0.00, cali 0.36, sahara 1.45, **antarctic 7.9**. Add to
[[capy3-instruments-that-cannot-hold-a-line]].

**A COSTUME PART CAN BE DRAWN AND INVISIBLE, and only a probe finds it.**
`qa/wear-parts.js` hides one costume mesh at a time and diffs six bearings.
Refitting the tux shell to the hull buried both lapels and the pocket square
(6, 0 and 0 changed pixels) because the hull is 11 cm taller at the shoulder
than the barrel was. Run it after ANY change to the body's shape. It also
caught the parka's yoke seam, which had been buried since it was written.

**Three build notes worth keeping:**
1. The body is a TABLE of stations (`capyHULL`), not a mesh, and both costume
   shells are cut from it inflated (`capyHullFit`). A shell fitted by hand to
   an old body silently stops being proud of a new one; a shell cut from the
   table is outside it by construction at every station.
2. Anything the idle breath scales needs a PIVOT. The hull's is at the belly
   line, because a chest expands upward, not symmetrically about the middle of
   the animal and down through the floor.
3. The roadmap's own numbers were wrong three times and only the render showed
   it: the rump closed to a BEAK, the catchlight at 0.42 of the eye is a pale
   SPIKE, the cheek at the planned size is a ball stuck on the jaw. Build the
   planned number, look at it, then write down which one moved and why.

Related: [[capy3-the-character-pass]], [[capy3-the-wardrobe]],
[[capy3-the-subject]], [[headless-qa-harness]]
