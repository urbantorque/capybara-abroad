---
name: capy3-biome-build-gotchas
description: "Two silent, near-invisible traps when building a new capy3 biome: heightfield axis and half-vs-full extents"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8bf0e10a-39ad-4cc5-b1c4-ec7588777628
  modified: 2026-08-18T12:49:34.928Z
---

Both of these cost real time building the Rio biome and neither shows up as an error.

**1. The CANNON Heightfield's second axis runs toward MINUS z.** A heightfield is authored in
its own xy plane with height along local z, and the `Rx(-90°)` that stands it up as a floor maps
local +y onto world −z. So the obvious form is wrong:

```js
data[i][j] = terrain(X0 + i*EL, Z0 + j*EL);  b.position.set(X0, 0, Z0);   // covers Z0 and BEHIND
data[i][j] = terrain(X0 + i*EL, Z1 - j*EL);  b.position.set(X0, 0, Z1);   // right
```

The wrong form leaves the biome with **no collision floor at all**, and you will not notice from
the capybara, because capybara.js holds itself up on its own analytic backstop (`capyGroundY`)
and walks happily on terrain the solver knows nothing about. It only surfaces when something
else dynamic is added — in Rio, a ball that fell through the beach and out of the world.
Also sample fine: 13 m cells put the solver's floor metres from the drawn ground on any relief.

**This trap had bitten TWICE and gone unnoticed for months.** On 19 Aug 2026 both kyoto.js and
cali.js were found using the wrong form (and 13 m / 14 m cells): their entire collision floor sat
several hundred metres south of the world, so nothing dynamic in either chapter had a floor at
all. Both are fixed and both now sample at 5 m, like rio.js.

**The one-line detector** — run it before believing any biome is sound:

    count solver contacts involving `game.capy.body` over ~180 frames of walking

A healthy biome logs hundreds (Sydney 541, Rio 927, Pasto 423). Kyoto logged **0** and Cali 43.
Zero contacts means the capybara is riding its analytic backstop and the solver floor is missing
or elsewhere. This is far faster and far more reliable than dropping probe bodies: probes roll
off slopes and land on rooftops, so their resting height lies to you.

**2. The vertex-merger takes FULL extents; `CANNON.Box` takes HALF.** `M.box(cx,cy,cz, sx,sy,sz)`
scales a unit cube, so `sx` is the full width. Mixing the conventions silently builds a world
where the visible thing and the solid thing differ by 2×. Keep one convention per module and
make the static-body helper speak the geometry helper's language.

**Also:** a kinematic body with zero velocity will **fall asleep**, and a sleeping body is
skipped in narrowphase — the floor of a moving platform silently stops existing. Set
`allowSleep = false` on anything the capybara has to ride.

Related: [[capy3-progression-chain]], [[headless-qa-harness]]
