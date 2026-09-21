---
name: capy3-hanoi
description: "Chapter 19 (hanoi): traffic as a medium, the four attempts at what happens when you stop, and instanceColor"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0366ded3-f17a-4f15-9340-54129eac34b7
  modified: 2026-08-26T00:30:09.088Z
---

Chapter 19 is Hanoi at ten in the morning (`src/hanoi.js`, ~3,075 lines, built 26 Aug 2026).
Two hundred and forty scooters over four street centrelines, nine floats each, no object
anywhere. THE FLOW parts for you; TRAIN STREET folds itself away eleven seconds before a train;
the lake is the quiet hole in the middle.

**What happens when you stop dead in the traffic took four attempts and the wrong ones are the
useful part:**

1. A clip — a shove and a horn. Wrong twice over: it cost twelve metres of being pushed down
   the street (a punishment, not a joke), and it made the chapter's own first mini
   UNREACHABLE, because a flow that parts at 3.4 m and shoves you when it cannot is a flow you
   can never touch. Measured: 66 s in the middle of the busiest street, nearest machine never
   inside 2.08 m.
2. Letting them through. No.
3. **They JAM.** Everybody brakes, nobody says anything, and half a minute later forty of them
   are stopped in a fan round one capybara. True, funnier, and it is what makes the mini
   possible — a stopped scooter is a thing you can hop into.
4. The clip is reserved for **changing your mind** (`hanDither` > `hanTURN_MAX`), which is the
   one thing a rider a second and a half ahead cannot allow for.

**And nobody is looking up.** While the animal is airborne, any rider inside 7 m stops avoiding
and lines up UNDER it. That one line is what makes `ride-the-flow` reachable, and it is the
chapter's verb.

**The crossing record counts PEOPLE, not seconds.** As a time integral a clean four-second
crossing scored 1; on the rising edge, one per rider, it scores ~44.

**`InstancedMesh.instanceColor` multiplies EVERYTHING** — per instance, not per part. A merged
scooter whose tyres, helmet and skin carry their own vertex colours came out as 240 monochrome
scooters, one of them yellow including the rider's face. And a plain `BoxGeometry` handed to a
material with `vertexColors: true` has no colour attribute and renders **BLACK** — every shop
sign in the quarter was a black slab. Two rules: one colour all through → white geometry (or
plain material) + instanceColor; many colours with one varying → **one mesh per variant** with
the colour baked in and no instanceColor.

**A generator that lays buildings along a centreline does not know the next centreline crosses
it.** Eight tube houses stood in the middle of the east-west road; `navBlocked` said X across
the whole width, `cross-the-road` was unreachable and the bia hoi corner was inside a building.
`hanTerraceOk` tests THREE points per house (shopfront, middle, back wall) against every lane
and a keep-out list.

**A railing that is drawn and not collided is not a railing** — every crossing of the Huc
bridge and of Long Bien ended in the water until both got parapet colliders.

Train Street is 6.4 m wide, not the real 4: at four a camera 12 m behind at 35° is inside
somebody's first floor and the marquee happens off screen. The TRAIN's 45 cm clearance is
untouched, because that is the number the chapter is about.

Related: [[capy3-monte-carlo]], [[capy3-the-middle-rung]], [[capy3-reference-frames]],
[[headless-qa-harness]]
