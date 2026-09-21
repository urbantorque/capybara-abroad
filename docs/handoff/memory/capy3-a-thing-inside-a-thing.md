---
name: capy3-a-thing-inside-a-thing
description: "B9: the container flag that was receiveShadow, the spill nobody could see, and the four ways a hold-to-act probe lies"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T06:55:20.175Z
---

Item 4a and 4d of ROADMAP-FUN, built 7 Sep 2026 as `5efe5d6`.

**`receive:` in `src/props.js` IS `receiveShadow`.** It is passed into
`physInstGroupFor` as its fourth argument and read nowhere else. Ten types
carry it and the list gives it away — a traffic cone, a sign, a ruana, a
dinner jacket. Monte Carlo has eighteen props with `receive: true` in it and
**nine of them are cones**. The container flag is `vessel:`, on `bin`,
`basket` and `esky`. Same family as [[capy3-names-nothing-publishes]]: a name
that reads like a feature is not one.

**A SPILL WAS NOT A WITNESSED EVENT ANYWHERE IN THE GAME.** `physSpill` emits
`prop:impact` with `speed === 0` and every consumer of that event gates on
speed — `npcLOC_BANG` 4.2, `npcOWN_BANG` 6.0, a bare `> 3`, and systems.js's
own `if (s < 1.5) return`, which is the line `incAdd` sits below. The one
listener with no speed gate was hardcoded to `coffee`/`icecream` behind
Sydney's `biomeLive()`. Four forced spills at the feet of ten people in Sydney
and three in Venice: **0 startled, 0 incidents, in both**. The payload now
carries a `spill` flag (cleared in `physStampVoice`, which every emit site
calls, because ONE payload object is shared by four of them) and both a spill
and a break reach people and the chain. Raising the speed instead would have
let a spill through four gates that are about how HARD a thing hit.

**Contents are CARRIED, not contained.** Every collider in props.js is a solid
box — a bin is a 0.4 × 0.56 × 0.4 block, not a shell — so "drop it in and let
the solver hold it" puts the thing on the lid. `physVesselTake` makes the
contents kinematic and out of the collision set and writes their transform from
the vessel's every frame; `physVesselEject` on five conditions (picked up,
tipped past 0.62 rad, hidden, destroyed, spilled) plus `physGrab`.

**Four things that measured wrong:**

1. **A KEYDOWN REPEATS.** A hold timer re-armed on every `actionPressed`
   restarts about half a second in, so a one-second hold ends with 0.2 s on the
   clock and comes out as a tap. It read as a feature that works in one chapter
   and not the next. Guard the arming test with `timer < 0`.
2. **"STANDING IN IT" IS A FOOTPRINT TEST, NOT A HEIGHT TEST.** `capy.position`
   is the body's CENTRE, ~0.4 m above its feet, so an animal standing beside a
   Venetian bin (mouth 1.35, animal 1.54) reads as being inside it. Compare the
   horizontal distance against the vessel's own half-extent instead.
3. **RE-TESTING AN ARM EVERY FRAME CANCELS IT.** "Standing still next to a bin"
   is a property of the PRESS. One frame of drift killed a hold that was three
   quarters done.
4. **A PROBE CANNOT ASSUME THE ANIMAL STAYS PUT.** It slid a metre down a Hanoi
   road, drifted out of reach on a Venetian quay between two samples, and twice
   had the prop taken out of its mouth by the chapter-neutral ownership walk (a
   prop spawned beside a local belongs to that local). **A teleport is also
   motion** — a 0.4 m correction in one frame reads as tens of m/s for several
   frames, which fails any "while stationary" gate. Pin the body on an interval
   for the length of the test and re-grab if the prop has gone.

**`qa/eng-rate.js` and its six-chapter sibling cannot hold a line.** Four
45-second random-input laps, two per side: `bang` 139/87 before against 127/99
after, `startled` 111/100 against 101/70, `broke` 6 in one after-lap and 0 in
the other. Only `spilt` separated (0,0 → 2,2). Add it to
[[capy3-instruments-that-cannot-hold-a-line]]. The evidence for 4d is the
deterministic reachability count from `qa/toybox-stock.js` — **chapters with
something that breaks or spills went 14 → 19** — and the forced-event
differential.

Instruments: `qa/toybox-stock.js` (per-chapter prop inventory by class),
`qa/witness-break.js`, `qa/put-in.js`, `qa/eng-rate6.js`.
`game.capy.putAudit()` is the way in from outside.

Related: [[capy3-noticed-and-given]], [[capy3-measure-the-premise]],
[[capy3-ghosts-and-noise]], [[capy3-shared-module-blindness]]
