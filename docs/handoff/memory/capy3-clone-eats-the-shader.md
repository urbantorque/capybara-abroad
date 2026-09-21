---
name: capy3-clone-eats-the-shader
description: "THREE.Material.clone() silently discards onBeforeCompile — the one-line bug that had five of capy3's water surfaces rendering as flat Lambert sheets"
metadata: 
  node_type: memory
  type: project
  originSessionId: a79155fd-2684-49d4-92d3-68ff4c869900
  modified: 2026-08-21T02:16:49.617Z
---

Found 21 Aug 2026, on the third pass over chapters 9–11. It is the single highest-value
thing that pass found and it is one method call.

**`THREE.Material.prototype.copy()` copies a fixed property list and `onBeforeCompile` is
not on it.** Measured on three r169: after `const b = a.clone()`,
`b.hasOwnProperty('onBeforeCompile')` is **false** and `b.onBeforeCompile ===
THREE.Material.prototype.onBeforeCompile` is **true**. `customProgramCacheKey` goes the same
way. There is no warning; the material renders, it just renders without the hook.

So this, which was in five places in src/ and had a correct-sounding comment above it in
every one of them:

```js
const m = grain(mat(0xffffff, { vertexColors: true }), { sparkle: 0.42, ... }).clone();
```

...produced a plain Lambert. **The `.clone()` was there for a real reason** — `mat()` caches
by colour+options and `grain()`'s own cache keys off `m.uuid`, so two chapters asking for the
same water get the SAME instance and a tide that writes `.color` every frame dyes the other
one (this is how Iceland's aurora once permanently greened the Río Cali). It was simply
applied one step too late.

**The fix is one step earlier: clone the BASE.** A fresh uuid misses the grain cache, so
`grain()` returns a private grained clone with the hook intact. `grainOwn(m, opts)` in
shared.js is `grain(m.clone(), opts)` and nothing else.

What it cost, all of it invisible because every number said the systems were working:

| where | what was lost |
|---|---|
| venice.js — the flooded square | grain AND sparkle, on **the chapter's marquee moment**. A metre of water over San Marco was one flat sheet of sage. |
| venice.js — the Bacino | same |
| kowloon.js — Victoria Harbour | the water the Symphony of Lights reflects in |
| drift.js — the cloud sea | the floor of the whole chapter, and the thing every fall lands in |
| iceland.js — the sea | same |

**The general shape, and it is worth carrying: a defensive copy that is applied AFTER the
thing it is defending gets thrown away with it.** The tell is a system whose parameters are
all present and correct in the source and whose output is missing from the picture — which
is why the only way this was ever going to be found is by looking at a rendered PNG and
asking why the sea is flat. See [[capy3-visibility-metrics]].

Related: [[capy3-the-picture]], [[capy3-chapters-nine-ten-eleven]], [[headless-qa-harness]]
