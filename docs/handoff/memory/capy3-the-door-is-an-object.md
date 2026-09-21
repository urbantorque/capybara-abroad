---
name: capy3-the-door-is-an-object
description: "D6 second session — the exit board, and why there is no general answer to what the floor is at a door"
metadata: 
  node_type: memory
  type: project
  originSessionId: 60501ba9-888e-42ec-bf5f-6720ba5e13a0
  modified: 2026-09-03T07:22:08.151Z
---

D6 second session (3 Sep 2026). The **exit board**: an object standing at every
chapter's `way`, and the departures card opening OUT of it. Contract section
**THE DOOR IS AN OBJECT — D6, SECOND HALF**; instruments `qa/d6-board.js`,
`qa/d6-probe.js` (every collider surface at a door), `qa/d6-open.js`,
`qa/d6-sheet.cjs`. Continues [[capy3-the-frame-d6]].

**The shape.** `exitBoard()` in shared.js — one builder, three mounts (posts /
stone stele / hanging beam), a table of nineteen dressings (`sysBOARD_DRESS`) in
systems.js. Planted from `way`, NOT from nineteen new constants: the door
already knew where it was. Four draw calls — merged mount+frame+face, one
InstancedMesh of 30 flaps, one of 6 chips, an optional emissive lamp — on ONE
material shared by all nineteen, so the colours are in the vertices and nineteen
dressings are one program. No text: the chips are the destination's own
`sysMARKS[biome].tint`, the wash that backs its picker tile.

**THE FINDING: there is no general rule for "what is the floor at this point".**
Two rules, opposite failures, one chapter apart:

| rule | Uji (bridge 3.16, riverbed -3.87) | Sydney (deck 0.17, shelter roof 3.04) |
|---|---|---|
| lowest surface at/above terrain | **the river** | correct |
| highest surface | correct | **the shelter roof** |

Fourteen of the nineteen doors are a BUILT thing, not ground — a wharf, a
bridge, a jetty, a made street — so the automatic rule keeps the open ground it
was written for and the eight built doors carry `floorY` as a measured number.
Separately, **a board must stand on the floor the DOOR is on**, which is a
different question: "2.2 m right of the door" at Manly is up a dune. Anchor on
the door's floor and try four candidate spots (right, left, in, out).

**FIVE TRAPS:**

1. **Nineteen picker keys are the TITLE CARD's.** In play `Digit1..9` do nothing
   and `Slash` (chapter 19) opens the help card. A sweep that pressed all
   nineteen without reloading filed nineteen identical Sydney rows under
   nineteen chapter names, every number in them correct. Reload per chapter.
2. **A drop test's own start height is part of the experiment.** Dropping from
   3 m above the board on the Corso starts ABOVE THE AWNINGS: the animal landed
   on a surf shop and reported a door floor of 5.65, and the board stood on a
   shop roof for a round. Nothing in the numbers said so — the wide shot did.
3. **`input.camYaw` is an OUTPUT.** A probe that writes it to aim the camera
   gets whatever the arrival left; two chapters reported the board behind the
   lens. Use `game.frameShot`.
4. **A board photographed from `board -> animal` is always EDGE ON**, because
   the board stands at right angles to that line by construction. Thirteen
   chapters read as a bare post. Shoot along the board's own facing normal.
5. **The turn must COMPLETE before the card comes.** 0.52 s was chosen so the
   card would arrive "while the lens is still travelling"; at 0.52 s the
   framing weight is 0.455, so the rig is still the 41-degree gameplay lens.
   0.86 s (`sysSHOT_IN` + a beat). And the card's `transform-origin` has to
   FOLLOW the board while it grows — written once it was 298 px adrift by the
   end, because the pause does not stop the rig swinging.

**Two pre-existing faults the batch found and did not fix:** chapter 3's `way`
literal (118, -586) is INSIDE a chip shop on the Corso, and Hong Kong's
published `pier` point is four metres past the end of the pontoon, over water.
Both are invisible in play because the exit ZONE is large.

Related: [[capy3-the-frame-d6]], [[capy3-progression-chain]],
[[capy3-things-that-are-simply-there]], [[capy3-solid-or-drawn]],
[[capy3-lattice-not-element-size]], [[headless-qa-harness]]
