---
name: capy3-names-nothing-publishes
description: The commonest silent bug in capy3 is a module asking a biome api for a key it does not publish — and there is now a runtime audit that finds every one
metadata: 
  node_type: memory
  type: project
  originSessionId: 74cee7b9-3ad7-454c-8c8a-bf858727680d
  modified: 2026-08-29T00:54:26.435Z
---

`npc.js`, `props.js`, `systems.js` and `condor.js` all resolve a biome's api by name and
read optional hooks off it, guarded with `||` fallbacks. When the CONSUMER'S spelling and
the PUBLISHER'S spelling differ, nothing throws, nothing logs, and the fallback — which is
a hard-coded guess written before the chapter existed — silently becomes the truth for the
life of the game. Two of these were live in chapters 1–2 on 29 Aug 2026:

- `game.env.terraceTables || game.env.diningTables` — environment.js publishes **`cafeTables`**.
  All five Sydney terrace diners were therefore seated at random points from
  `randomPointIn('terrace')`, measured 2.9–3.3 m from the nearest table that is actually
  built. And because `capyOnTable` tests 1.15 m around the DINER'S table point, standing on
  a real tabletop — the only thing up there you can stand on, and where the clue sends you —
  was never within three metres of anything that could notice: **`cafe-table` could not be
  completed at all.** npc.js had parsed `cafeTables` correctly into a second list
  (`quayTables`) that nothing ever read.
- `game.pasto.dryingPatio || game.pasto.patio` — pasto.js publishes **`coffeePatio`**
  (52, 12, 13×10). The fallback disc (46, 4) r 7.5 stood, so the farmer who exists to be on
  the drying floor spawned off it, and `paOnPatio` covered only the patio's SW corner.

**The audit** (`qa/rv-apis.js`): build every chapter, take `Object.keys()` of each live api,
then `fetch('/src/<f>.js')` in the page and regex `game\.<key>\.(\w+)` out of every consumer.
Anything asked for and not published is printed with the files that ask. It found exactly
these two plus benign aliases in one run. `qa/rv-hooks.js` is the companion: a hook published
by 18 of 19 chapters is either a real gap or a documented exception (Sydney has no
`terrainHeight` — flat by contract; Pasto has no water).

**How to apply:** never trust an `||` chain of api names. Run rv-apis.js after touching any
biome api, and when adding a hook, grep the consumer for the name it actually asks for.

Related: [[capy3-shared-module-blindness]], [[capy3-quay-is-two-places]], [[capy3-the-locals]],
[[capy3-lattice-not-element-size]]
