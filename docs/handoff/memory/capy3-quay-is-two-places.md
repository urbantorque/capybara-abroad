---
name: capy3-quay-is-two-places
description: Circular Quay exists twice in capy3 — as a band inside Sydney and as its own biome — and mistaking one for the other looks exactly like a mis-tagged prop bug
metadata: 
  node_type: memory
  type: project
  originSessionId: aa9f40a9-cf42-418f-b027-9d3788c21c1e
  modified: 2026-08-21T14:21:08.172Z
---

`physQUAY` / `physQUAY_SCATTER` in props.js (chips, camera, sunglasses, ferry ticket,
menu board, wine bottle, at x −45…−15, z −8…+9) are **chapter 1** content. They live on
Sydney's own western boardwalk and are read by `seagull-chips`, `cafe-table` and
`dog-loose`, all of which are chapter 1 tasks. They are scattered at boot, under Sydney's
capture tag, on purpose.

The chapter-3 biome is *also* called `quay` (quay.js, QUAY_SPAWN, `to-quay` …
`ferry-salute`) and is a separate world in the same coordinate space. It is a ferry
voyage; none of its tasks want a scattered prop.

**Why this bites:** an audit that measures "props tagged `sydney` sitting in the Circular
Quay rect, removed from the world when you travel to the `quay` biome" reads as an obvious
mis-tag. Moving `physScatterQuay()` onto `biome:enter` for `quay` silently breaks three
chapter-1 tasks and the props vanish from the chapter that actually uses them.

**How to apply:** before "fixing" anything that looks mis-tagged between these two, check
which chapter the consuming task belongs to in `shared.js` TASKS (`chapter:` field). The
`chapter: 1` / `chapter: 3` split is the arbiter, not the coordinates and not the name.

Related: [[capy3-shared-space-leaks]], [[capy3-progression-chain]]
