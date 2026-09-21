---
name: capy3-barge-then-grab
description: "physBarge clears prop.owner, so the knock-it-off-and-pick-it-up route ticked nothing — the causation ledger has two fields and only one was being read"
metadata: 
  node_type: memory
  type: project
  originSessionId: 74cee7b9-3ad7-454c-8c8a-bf858727680d
  modified: 2026-08-29T00:54:39.662Z
---

`physGrab` decided "did I steal this?" from `prop.owner` alone. `physBarge` — which fires
whenever the capybara touches a carried prop above 3.2 m/s, i.e. the instant you run into
anybody — takes the thing out of their hands, records `prop.stolenFrom`, and **clears
`prop.owner`**. So the whole barge-then-pick-up route reached `physGrab` with `prev === null`:

- `wasStolen` was never set on the hat;
- the `capy:grab` payload carried no victim, so npc.js's listener fell straight out and
  **`steal-hat` never ticked**;
- and because `hat-harbour` gates on `wasStolen`, that hat could never be carried into the
  harbour for the checklist either — silently, for the rest of the session.

Measured 29 Aug 2026: walk up to a hatted tourist, press E, end up holding the hat, and
neither line ticks. `coffee-spill` was fine the whole time because `earnedSpill` already read
`(prop.owner || prop.stolenFrom)` behind `physCausedByCapy`. The fix is that same rule in
`physGrab`, with its own window (`physCAUSE_SNATCH` 12 s), so a prop somebody else knocked
over — or one lying on the lawn since the last chapter — is still not yours. npc.js clears
`stolenFrom` when the victim gets it back, so a retrieved hat is clean again.

**How to apply:** the causation ledger is `owner`, `stolenFrom`, `disturbed`,
`lastCapyTouch` and `releaseTime`, and a task gate that reads only one of them has a route
through it. When a task can be reached two ways (take it off them / knock it off them), test
BOTH — a probe that walks up politely and one that charges.

Related: [[capy3-shared-module-blindness]], [[capy3-names-nothing-publishes]],
[[capy3-external-forces-on-the-capybara]]
