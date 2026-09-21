---
name: capy3-visibility-metrics
description: "Automated 'is the capybara on screen' checks that look right and are wrong"
metadata: 
  node_type: memory
  type: project
---

When judging camera framing in capy3, **look at the rendered frame**. Three automated proxies
were tried on the torii-tunnel camera and all three gave confidently wrong answers:

- A `Raycaster` from the eye to the animal counts **the animal's own body meshes** as occluders
  (they are `SphereGeometry` in `#b0784a`), so everything reads as blocked.
- A colour histogram over the framebuffer misses the capybara wherever it stands in shade — it
  reported 18 px on a frame where the animal filled a third of the screen.
- Hide-the-capybara-and-diff-the-pixels is exact in principle, but `game.capy.group` is not the
  node the body meshes hang from, so hiding it changes nothing and every frame diffs to zero.

`Vector3.project()` also needs `camera.updateMatrixWorld(true)` first when the loop has been
ticked with `render = false`, or it reads a stale matrix and puts everything off screen.

Screenshot via the `/shot` sink and read the PNG. Related: [[headless-qa-harness]]
