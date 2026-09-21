---
name: capy3-spawn-rings-and-frontage
description: "Integrity block 9 — the ring metric lied a third time, and a terrace polyline wound the wrong way put a whole frontage in a lake"
metadata: 
  node_type: memory
  type: project
  originSessionId: 67d5a05a-5f1d-451c-ac07-4758c6207f5e
  modified: 2026-08-28T13:35:24.840Z
---

Integrity pass block 9 (28 Aug 2026, commits 22d1721 + 9626c6c). The card said
Pantanal and Hanoi were both 0% dressed at 20 m from the spawn. Both were 100%.
`qa/rev-people.js`'s ring counter opens with `if (!o.isMesh) return`, so it has
never seen an InstancedMesh — the third time this pass an instrument named
something other than what it measures. Pantanal was measured, photographed and
**not touched**: it is the only chapter with 0% dead area inside its bounds.

The real Hanoi defect was one character. `hanTerrace`'s normal is
`(cos yaw, -sin yaw)` with `yaw = atan2(dx, dz)` — i.e. `(dz, -dx)` — and the
lake ring polyline is wound so that points into the water. So the chapter's one
continuous frontage was built in Hoan Kiem, where hanTerrace's own
`terrain < water` test discarded it silently. **Whenever a builder walks a
polyline and offsets by a normal, the side is decided by winding, and a "nothing
was drawn" result is the shape that bug takes.** Test it by raycasting down at
stations along the offset, not by reading the code.

Three lessons worth carrying:

- **A restored building is something the arrival lens can be inside.** Every
  `*_SPAWN.yaw` is the CAMERA's bearing (see `teleportCapy`), so new geometry on
  that bearing lands in the opening shot. The rig's occlusion ray hides it by
  hauling the boom in — that is a bug being masked, not a shot.
- **A backdrop stops working the moment it is walked among.** Instanced blank
  boxes read fine over a roof and as a yard at eye level. Keep them ≥45 m off a
  centreline, or make the first row real houses.
- A chapter's *litter* rectangle, *backdrop* rectangle and *bounds* are three
  separate constants and all three were the Old Quarter's. When a chapter feels
  empty in one quadrant, check whether every dressing pass shares one rect.

See [[capy3-the-independent-list]], [[capy3-solid-or-drawn]],
[[capy3-centreline-worlds]].
