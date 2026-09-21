---
name: capy3-people-have-bodies
description: "B11: the local figure has no legs and no torso, no local holds anything, and a spring kicked in both value and velocity collapses instead of swinging"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0399a747-7207-4778-9720-3ffe4ce144bc
  modified: 2026-09-07T08:21:36.119Z
---

Items 4e and 5d of ROADMAP-FUN, built 7 Sep 2026 as `f5f751d`. Item 4 closed.

**FOUR FACTS ABOUT THE CHAPTER-NEUTRAL CAST** (`locals` — the cast in seventeen
of nineteen chapters; Sydney is `humans` and Pasto is `paHumans`):

1. **`buildLocalFigure` publishes `group`, `head`, `armL`, `armR` and a face —
   no legs, no torso.** Any whole-body pose has to be the group's own
   `position.y`, `rotation.x` and `rotation.z`, which are written as one
   additive sum per frame. A sit is a 0.34 m drop plus a 0.42 rad lean back, and
   at this scale and the resting 29° camera that is what a sit looks like.
2. **No local anywhere holds anything.** `heldProp` is not a field on the
   record; the probe reads zero holders in all nineteen chapters. Sydney's and
   Pasto's rosters do hold props and drop them (`npcFumble`, `npcDRINK`).
   Anything of the form "the person drops what they are carrying" is a
   two-chapter feature.
3. **A local never writes its own x/z.** B7 established it and B11 re-confirms
   it: anything that moves a person (an approach, a plunge, being knocked into
   a canal) is a state machine on a cast that deliberately has none. Ten
   chapters have a local standing at a water edge, so the *reachability* is
   there; the architecture is not.
4. **`localsReact` cannot be published** — it opens `if (!locals.length) return`
   and knows only one of the two casts. `castReact` asks both, and
   `game.startlePeople` is its first caller from outside npc.js. Fourth time
   this pass; see [[capy3-a-thing-inside-a-thing]].

**THE HERD REGISTRY IS THE ONE PLACE TO REACH EVERY ANIMAL.** `herdKinds` in
systems.js, with `count()`/`at(i,v)`/`put(...)` per kind, and `game.herdDebug()`
as the read-only window. Sixteen chapters register into it, so a behaviour that
would otherwise mean editing sixteen biome files is one call inside
`herdUpdate`. Measured: **eight of nineteen chapters have a herd animal** —
Venice 180 pigeons, Antarctica 42 gentoos, Manly 30 gulls, Iceland 14 sheep, the
Pantanal 13 cows, Cappadocia 9 cats, Sydney 6 ibises, Kyoto 1 heron — and three
of them keep the animals 35–71 m from the nearest person.

**The herd skill is earned in chapter 15 and `sysSKILLS` rewrites it from the
task table EVERY FRAME**, so `capy.learn('herd', true)` is undone on the next
one. A probe wraps `capy.can` instead. Anything gated on `capy.can('herd')` does
not exist for a player until the Pantanal.

**THE TRAP, AND IT IS ABOUT SPRINGS.** A spring kicked in BOTH its value and its
velocity collapses instead of swinging: `stum = 0.6` with `stumV = -5.7` crosses
zero in a tenth of a second, and the measured peak was **0.025 rad — 1.4
degrees**. Kick the velocity only, from rest, the way the flinch spring beside it
has always been driven. And then check the amplitude against the note that is
already in the file: `localsReact`'s own comment says **3.7 degrees is under the
threshold at which anybody can tell a person reacted at all**, which caught a
*second* invisible version in the same afternoon. A flinch lean is 3.6°, a
point-blank crate is 8.6°, and being shouldered belongs at about 6.7°.
Related: [[capy3-springs-are-clipped]].

Instruments: `qa/bodies-animals.js` (the reachability table),
`qa/bodies.js` (peak-sampled at 20 Hz — a stagger settles in a second and an
end-of-window sample reads zero), `qa/animals-scare.js` (with/without a
recruited herd), `qa/b11-shot.js`.

Related: [[capy3-the-locals]], [[capy3-the-herd-anywhere]],
[[capy3-mischief-radii]], [[capy3-noticed-and-given]]
