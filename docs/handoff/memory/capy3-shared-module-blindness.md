---
name: capy3-shared-module-blindness
description: "The capy3 bug class where a SHARED module (props.js, capybara.js) only ever learned two worlds, so eleven chapters silently got Sydney's physics"
metadata: 
  node_type: memory
  type: project
  originSessionId: 25994c8a-e629-4d79-914c-22c2bdeb8481
  modified: 2026-08-19T14:12:07.954Z
---

Found 19 Aug 2026. The sibling of [[capy3-shared-space-leaks]], and the more damaging half.
Shared-space leaks are a biome's code running where it should not. This is the opposite: a
SHARED module that only ever learned Sydney (and sometimes Pasto), so the other eleven
chapters silently ran on Sydney's assumptions.

**props.js had FIVE of these, all gated on `sydneyLive` or `physPastoLive()`:**

- `physCheckWater` was called only when Sydney was live, with the comment "every water path is
  Sydney's". So **Archimedes did not exist in eight chapters that have water in them** — Venice's
  flooded square, Palawan's bay, Kyoto's pond, the Rio Cali, the Uji, Rio, the harbour at the
  Quay. A prop thrown in fell through the surface and slept on the bottom. Measured after the
  fix: a ball dropped 6 m into a Venice canal settles at `waterLevel - 0.03`, its designed
  waterline, instead of vanishing.
- `physOverWater` fell back to Sydney's `z < -10` for any biome without `isOverWater` — which
  makes half of every world "harbour". It must return FALSE when the live biome publishes
  nothing.
- `physSurfaceY` knew Sydney's env and Pasto's terrain and answered 0 for the other eleven, so
  prop rest heights, spill tests and the fall-rescue were measured against ground that only
  exists in Sydney.
- `physCraterCheck` was gated on `!sydneyLive`, i.e. it ran in ELEVEN worlds: an invisible
  Galeras crater shoving and eating props out of the middle of Venice, Kowloon and the rest.
- the non-Sydney fall-rescue had no water test, so anything legitimately floating or sinking
  was teleported home.

The fix in all five is the same one capybara.js already had: resolve the LIVE biome's api
(`physBiomeApi()`, the mirror of `capyBiomeApi`) and ask it. A biome with no water publishes no
`isOverWater` and the whole path costs one property miss.

**capybara.js had the mirror-image omission:** eleven biomes publish `slopeAt(x, z)` and
**nothing in the codebase ever read it**, so a 23-degree dune, the flank of Galeras, the
switchbacks up Cristo Rey and the moraine all walked at exactly the speed of flat paving.

**The detector:** grep for a hook that biomes PUBLISH and count the consumers. Producers with
zero consumers, and shared modules whose gates name a biome rather than asking one, are both
one grep away and both had been shipping for months.

Related: [[capy3-shared-space-leaks]], [[capy3-progression-chain]], [[headless-qa-harness]]
