---
name: capy3-render-pose-heuristics
description: "The capy3 bug class where a render heuristic stands in for a flag nobody set — 'airborne above y 1.5 means the gardener has you' broke every hop in six chapters"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6cafba14-b59c-4b34-9fc3-4981c76be36b
  modified: 2026-08-19T04:55:13.937Z
---

Found 19 Aug 2026 while adding chapters 10 and 11, and it had been shipping since Pasto.

capybara.js decided whether the animal was BEING CARRIED with:

    const carried = !!capy.carriedBy || (!grounded && body.position.y > 1.5);

The second half was a guess standing in for a flag npc.js never set: the gardener pins the body
at y 1.62 while he marches you to the gate, so "airborne and high up" meant "in his hands". It
is correct in Sydney, where the ground is at y = 0 and 1.5 m is over your head — and it has been
quietly wrong in every chapter with relief in it ever since. On the flank of Galeras, on the
glacier, on the great dune, in Uji, on Cristo Rey, and on **every single deck in the Drift**
(the lowest of which is thirty metres up), EVERY HOP rendered as the dangling flail: legs
windmilling, head down, no tuck, the model rolled onto its side.

Nobody ever spotted it because it only fires in mid-air and it looks like an animation.

**The fix is the flag.** npc.js sets `game.capy.carriedBy = rec` when the carry starts and
clears it in all three places the carry can end (delivered, biome change, state reset). The
guess is gone.

**The general rule this is an instance of:** a render heuristic that infers state from POSITION
is a bug with a delay fuse in a game where every biome is authored in the same coordinates and
new ones keep arriving at different altitudes. If two modules need to agree about state, one of
them writes a flag. `game.capy` already publishes `atHelm`, `grounded`, `slip`, `frameVX` and
now `climbing` for exactly this reason — the cost of one more field is nothing next to the cost
of a heuristic that is true in chapter one.

Related: [[capy3-shared-space-leaks]], [[capy3-chapters-ten-eleven]], [[capy3-module-drop-failure]]
