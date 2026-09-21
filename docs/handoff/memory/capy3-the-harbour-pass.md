---
name: capy3-the-harbour-pass
description: "The deep pass over capy3's Circular Quay — the quadrant of harbour you could walk on, the two landmarks that were never drawn, and the wake that was under the sea"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8379a3af-43ac-4029-99a4-3e7d28eb5761
  modified: 2026-08-21T11:29:41.350Z
---

Done 21 Aug 2026, on "deep and detailed pass for Circular Quay". Chapter 3 measured
**20 k triangles — the lowest of the seventeen** (Sydney 71, Pasto 98, Venice 125, Rio 119,
Kowloon 117). It is now **82 k**, frame time unchanged at 16.6–16.7 ms median. Method as
always: [[headless-qa-harness]], and judge framing from the PNG ([[capy3-visibility-metrics]]).

**THE TWO THINGS THAT WERE NOT DRAWN AT ALL.** The chapter is named after the ferry
terminal that faces the Opera House, the Freshwater's own route table calls her first
waypoint "the Quay approach, off the Opera House", and there was no Opera House — a
hundred and thirty metres of blank water on the side the boat turns towards the moment she
comes off the wall. Behind the terminal, the colonnade is 8.7 m high and above it was SKY.
Bennelong Point (podium, nine climbable treads, ten lofted shells) and a 26-tower CBD with
instanced window bands are 32 k of the 62 k added, and they are the whole picture.

**A SHELL IS A LOFT, NOT A STACK OF SLABS.** Chorded boxes up a quarter-ellipse came out
as a ziggurat — the same trap the Manly wharf shed's roof fell into, because 41 degrees
down is nearly a plan view. Five rows of vertices (edge, haunch, ridge, haunch, edge) plus
a soffit, exactly the way `quayHeadland` builds a hill, and it reads first time.

**A QUADRANT OF THE HARBOUR WAS DRY LAND.** `quayIsOverWater` said
`z >= 16 && |x| <= 130` → land, with `terrainHeight` a flat zero. Measured: dropped at
(100, 20) — a hundred metres of clear water east of the apron — the capybara stood there
GROUNDED at y = 0.18 on capybara.js's analytic backstop. Swimming east along the apron
edge and carrying straight on was enough to do it, and the same expression had no far
edge, so the street behind ran south for ever. Land is now the paving that is drawn.

**terrainHeight ANSWERED ZERO FOR SIX WALKING SURFACES** it had never heard of: the apron
(0.20), the three fingers (0.40), Bennelong (2.60), the Manly wharf (1.61), the dry sand
(0.63) and the cove floor (0.45). Nothing fell through — the static boxes are real — but
terrainHeight is what the hint arrow, the stuck-rescue, the local anchors and the soft
floor all read. Same class as the Fort Denison miss in [[capy3-the-second-pass]].

**THE BOAT COULD NOT HIT THE QUAY OR THE WHARVES.** The apron edge was
`quayBoatZ = clamp(..., 12)` at the bottom of the integration: no bump, no sound, no line.
Since the berth faced the shore, the first thing anyone does is open the throttle — fifty
seconds of full ahead pinned on z = 12, sliding a hundred and thirty metres SIDEWAYS along
a wall that is not drawn. And the three finger wharves had no collision of any kind. The
berth now lies head out (`yaw: PI`), the edge and the fingers bump, and the deckhand
shouts "ASTERN! She comes off the wall backwards!" the first time you drive at the quay —
the astern fix stays, it is just no longer a manoeuvre nobody is told about.

**FOUR THINGS DRAWN UNDER THE SEA OR OVER IT.** `quaySurfaceY` runs −0.79 to −0.21 and
every one of these was pinned to the DATUM:
- the sun path at −0.44, so two thirds of it was inside the water and chopped into bands;
- both wakes at −0.43, same;
- the perched gulls at `WATER_Y + 2.42` when the buoy instance sits at `surface − 0.55`, so
  twenty-two seabirds hovered half a metre over the marks;
- the chip counter at `y 1.15` with its top 0.84 BELOW its own origin — buried eighty
  centimetres in the sand, an eleven-centimetre ledge on a beach.

**AND EVERY WAKE QUAD WAS AXIS-ALIGNED.** No heading at all, so a boat on any course but
due north left a trail of rectangles lying square to the world. The heading goes in the
SECOND euler slot (`quayXform(..., -PI/2, yaw, 0, ...)`) — the same one `quayBuildSurf`
uses to lay foam tangential to a shore; putting it in the third mirrors the quad instead.

**WHAT THE PLACE HAS IN IT NOW.** Thirty instanced commuters on the concourse (body / shirt
/ two legs — `instanceColor` multiplies the WHOLE mesh, so the shirt cannot share a mesh
with the face or ten shirts give you ten faces); an arcade with real arches and a clock;
a coffee cart, a departures board, queue rails, fig tubs; eleven bollard gulls that LIFT at
3.5 m and all at once on a wheek; two more ferries alongside the outer fingers (outboard —
inboard put a 27 m hull nine metres from the middle berth and backing out drove into one);
traffic and a train on the Bridge; a mooring field of 33 yachts all lying to the same tide;
bush and a boulder skirt on all thirteen headlands, thinned by distance from the rhumb line
(one density everywhere cost 30 k of scrub on hills never closer than 200 m); a lighthouse;
cliff strata; cat's-paws of wind crossing the water; bow spray; steam off the whistle (which
finally reads `quayHornT` — set since the chapter was written and read by nothing);
fourteen passengers on the Freshwater who WAVE when she answers your horn; gulls off the
underside of the arch and an echo when you sound off under it; and a heaving line thrown to
a wharf hand at Manly who catches it and says something.

**THE SOLIDITY AUDIT went 0 → 16 → 2** across the pass: everything new was drawn and not
collided first time (the lighthouse and keeper's house, the Opera podium overhanging its own
collider by four metres, a CBD tower whose front face landed five metres out on the
concourse). The residue is two instanced plants. Also fixed by it: the crown of every
headland — the collider stopped at the cliff rim while the mesh carried a cap and a peak up
to `h*1.20`, so the top of every hill was rock you stood inside. `quayHEAD_TIER` is read by
the collider AND by `quayGroundY`, which is the only way those two stay the same shape.

Related: [[capy3-solid-or-drawn]], [[capy3-the-second-pass]], [[capy3-the-locals]],
[[capy3-biome-build-gotchas]], [[capy3-external-forces-on-the-capybara]]
